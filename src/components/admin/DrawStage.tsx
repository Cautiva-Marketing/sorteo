"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { DiscardWinnerButton } from "@/components/admin/DiscardWinnerButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { RouletteWheel, type SpinTarget } from "@/components/admin/RouletteWheel";
import { useFullscreen } from "@/components/admin/useFullscreen";
import { WinnerDialog } from "@/components/admin/WinnerDialog";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  ExpandIcon,
  GiftIcon,
  PlusIcon,
  ShrinkIcon,
  SparklesIcon,
  TrophyIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { adminFetch } from "@/lib/admin-fetch";
import { getMuted, playVictory, primeAudio, setMuted, subscribeMuted } from "@/lib/victory-sound";
import type { PrizeView, WheelParticipant, WinnerRecord } from "@/types";

export interface DrawStageProps {
  prizes: PrizeView[];
  /** Elegibles de la ruleta, leídos en el servidor. */
  participants: WheelParticipant[];
  /** Ganadores activos (más reciente primero): se listan junto a la ruleta. */
  winners: WinnerRecord[];
}

type Phase = "idle" | "requesting" | "spinning" | "result" | "discarding";

interface ResultState {
  /** Id del giro guardado; `null` en práctica. */
  spinId: string | null;
  /** `ref` del ganador: se excluye de la ruleta si se descarta. */
  winnerRef: string;
  number: number;
  prizeName: string;
  winnerName: string;
  practice: boolean;
  /** El ganador no estaba en la lista del panel (otra sesión giró): hay que refrescar. */
  stale: boolean;
}

const MESSAGES = {
  noPrizes: "Elige un premio: aún no hay premios.",
  exhausted: "Este premio ya no tiene unidades pendientes.",
  noEligible: "No hay participantes elegibles para sortear.",
  prizeExhausted: "El premio ya no tiene unidades pendientes.",
  prizeMissing: "El premio ya no existe.",
  conflict: "Otro giro se estaba ejecutando al mismo tiempo. Inténtalo de nuevo.",
  forbidden: "No tienes permisos de administrador para girar la ruleta.",
  failed: "No pudimos girar la ruleta. Inténtalo de nuevo.",
  discardFailed: "No pudimos descartar al ganador. Inténtalo de nuevo.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MIN_SIZE = 280;
const MAX_SIZE = 600;
/** Tamaño máximo de la ruleta en pantalla completa y ancho desde el que se usan dos columnas. */
const MAX_FULLSCREEN_SIZE = 960;
const WIDE_VIEWPORT = 1024;
/** Alto que ocupa todo lo que no es la ruleta en pantalla completa (letrero, botón, márgenes). */
const FULLSCREEN_CHROME_HEIGHT = 300;
/** Alto que ocupa todo lo que no es la ruleta fuera de pantalla completa (encabezado, letrero, botón). */
const NORMAL_CHROME_HEIGHT = 340;
/** Ancho de la columna de premios y ganadores en pantalla completa, con el espacio entre columnas. */
const FULLSCREEN_SIDE_WIDTH = 480;

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** Tamaño de la ventana como texto (valor estable para `useSyncExternalStore`). */
function getViewport(): string {
  return `${window.innerWidth}x${window.innerHeight}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

interface ParsedSpin {
  spinId: string | null;
  winnerRef: string;
  winnerName: string;
  number: number;
  prizeName: string | null;
}

/** Lee el ganador de la respuesta 200/201; `null` si no tiene el formato esperado. */
function parseSpin(body: unknown, practice: boolean): ParsedSpin | null {
  if (!isRecord(body) || !isRecord(body.winner)) {
    return null;
  }
  const { ref, fullName } = body.winner;
  if (typeof ref !== "string" || typeof fullName !== "string") {
    return null;
  }
  if (practice) {
    return { spinId: null, winnerRef: ref, winnerName: fullName, number: 0, prizeName: null };
  }
  const prize = isRecord(body.prize) ? body.prize : null;
  if (
    typeof body.id !== "string" ||
    typeof body.number !== "number" ||
    !prize ||
    typeof prize.name !== "string"
  ) {
    return null;
  }
  return {
    spinId: body.id,
    winnerRef: ref,
    winnerName: fullName,
    number: body.number,
    prizeName: prize.name,
  };
}

function codeOf(body: unknown): string | null {
  return isRecord(body) && typeof body.code === "string" ? body.code : null;
}

/**
 * Escenario del sorteo (FR-064 a FR-077, FR-090, FR-106): premio en juego, ruleta, botón de girar,
 * modo de práctica, silencio y ventana del ganador. «Girar» gira de inmediato, sin ventana de
 * confirmación: el primer giro real cierra las inscripciones en el servidor. El servidor decide y guarda al ganador antes de
 * la animación; aquí solo se anima hacia el resultado recibido.
 */
export function DrawStage({ prizes, participants: serverParticipants, winners }: DrawStageProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [chosenPrizeId, setChosenPrizeId] = useState<string | null>(null);
  const [practice, setPractice] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pointerName, setPointerName] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const [spinTarget, setSpinTarget] = useState<SpinTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Descartados en esta sesión: salen de la ruleta al instante, antes de que se refresque el servidor.
  const [excluded, setExcluded] = useState<string[]>([]);
  const [size, setSize] = useState(MIN_SIZE);
  const spinCounter = useRef(0);
  const wheelBox = useRef<HTMLDivElement>(null);
  const reasonId = useId();
  const radioName = useId();
  const winnersHeadingId = useId();

  const participants = useMemo(
    () =>
      excluded.length === 0
        ? serverParticipants
        : serverParticipants.filter((entry) => !excluded.includes(entry.ref)),
    [serverParticipants, excluded],
  );

  const muted = useSyncExternalStore(subscribeMuted, getMuted, () => false);
  const {
    ref: stageRef,
    active: fullscreen,
    enter: enterFullscreen,
    exit: exitFullscreen,
  } = useFullscreen();
  const viewport = useSyncExternalStore(subscribeResize, getViewport, () => "1280x720");
  const [viewportWidth = 1280, viewportHeight = 720] = viewport.split("x").map(Number);

  // Premio en juego: el elegido si aún tiene unidades; si no, el primero con unidades pendientes.
  const prizesWithUnits = prizes.filter((prize) => prize.pending > 0);
  const activePrize =
    prizesWithUnits.find((prize) => prize.id === chosenPrizeId) ?? prizesWithUnits[0] ?? null;

  const busy = phase !== "idle";
  const noParticipants = participants.length === 0;

  let reason: string | null = null;
  if (noParticipants) {
    reason = MESSAGES.noEligible;
  } else if (!practice && !activePrize) {
    reason = prizes.length === 0 ? MESSAGES.noPrizes : MESSAGES.exhausted;
  }

  // En pantalla completa la ruleta ocupa el alto disponible (y el ancho que deja la columna lateral).
  const wheelSize = fullscreen
    ? Math.max(
        MIN_SIZE,
        Math.min(
          MAX_FULLSCREEN_SIZE,
          viewportHeight - FULLSCREEN_CHROME_HEIGHT,
          viewportWidth >= WIDE_VIEWPORT
            ? viewportWidth - 48 - FULLSCREEN_SIDE_WIDTH
            : viewportWidth - 48,
        ),
      )
    : Math.min(size, Math.max(MIN_SIZE, viewportHeight - NORMAL_CHROME_HEIGHT));

  // Tamaño de la ruleta según el ancho disponible (mínimo 280 px: cabe en 360 px sin desborde).
  useEffect(() => {
    const box = wheelBox.current;
    if (fullscreen || !box) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? MAX_SIZE;
      setSize(Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.floor(width))));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [fullscreen]);

  function refresh(): void {
    startRefresh(() => router.refresh());
  }

  function handleSpinClick(): void {
    // El audio se prepara dentro del gesto del usuario para que el navegador no lo bloquee.
    primeAudio();
    void startSpin();
  }

  async function startSpin(): Promise<void> {
    setPhase("requesting");
    setError(null);
    try {
      const response = practice
        ? await adminFetch("/api/admin/spins/practice", { method: "POST" })
        : await adminFetch("/api/admin/spins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prizeId: activePrize?.id }),
          });
      const body = await readJson(response);

      if (response.ok) {
        const parsed = parseSpin(body, practice);
        if (parsed) {
          const known = participants.some((entry) => entry.ref === parsed.winnerRef);
          const instant = !known || window.matchMedia(REDUCED_MOTION_QUERY).matches;
          spinCounter.current += 1;
          setResult({
            spinId: parsed.spinId,
            winnerRef: parsed.winnerRef,
            number: parsed.number,
            prizeName: parsed.prizeName ?? activePrize?.name ?? "Premio de práctica",
            winnerName: parsed.winnerName,
            practice,
            stale: !known,
          });
          setPointerName("");
          setSpinTarget({ winnerRef: parsed.winnerRef, key: spinCounter.current, instant });
          setPhase("spinning");
          return;
        }
        setError(MESSAGES.failed);
      } else if (codeOf(body) === "PRIZE_EXHAUSTED") {
        setError(MESSAGES.prizeExhausted);
        refresh();
      } else if (codeOf(body) === "NO_ELIGIBLE") {
        setError(MESSAGES.noEligible);
        refresh();
      } else if (codeOf(body) === "NOT_FOUND") {
        setError(MESSAGES.prizeMissing);
        refresh();
      } else if (codeOf(body) === "DRAW_CONFLICT") {
        setError(MESSAGES.conflict);
      } else {
        setError(response.status === 403 ? MESSAGES.forbidden : MESSAGES.failed);
      }
    } catch {
      setError(MESSAGES.network);
    }
    setPhase("idle");
  }

  function handleSpinEnd(): void {
    setPhase("result");
    setPointerName(result?.winnerName ?? "");
    playVictory();
  }

  /** «Volver a girar»: descarta al ganador, lo saca de la ruleta y gira de nuevo (FR-075, FR-078). */
  async function discardAndRespin(): Promise<void> {
    const current = result;
    if (!current?.spinId) {
      return;
    }
    setPhase("discarding");
    setDialogError(null);
    try {
      const response = await adminFetch(`/api/admin/spins/${current.spinId}/discard`, {
        method: "POST",
      });
      if (!response.ok) {
        setDialogError(response.status === 403 ? MESSAGES.forbidden : MESSAGES.discardFailed);
        setPhase("result");
        return;
      }
    } catch {
      setDialogError(MESSAGES.network);
      setPhase("result");
      return;
    }
    setExcluded((list) => [...list, current.winnerRef]);
    setResult(null);
    setSpinTarget(null);
    // El premio sigue en juego (la unidad volvió) y la lista del panel aún no se refrescó.
    await startSpin();
  }

  function closeResult(): void {
    const stale = result?.stale === true;
    const wasPractice = result?.practice === true;
    // El ganador aceptado sale de la ruleta al instante, antes de que se refresque el servidor.
    const accepted = result?.winnerRef;
    if (!wasPractice && accepted !== undefined) {
      setExcluded((list) => (list.includes(accepted) ? list : [...list, accepted]));
    }
    setPhase("idle");
    setResult(null);
    setSpinTarget(null);
    setDialogError(null);
    // Un giro real cambió elegibles, premio e historial; la práctica solo si la lista estaba vieja.
    if (!wasPractice || stale) {
      refresh();
    }
  }

  const spinLabel = practice
    ? "Girar (práctica)"
    : activePrize
      ? `Girar para: ${activePrize.name}`
      : "Girar";

  const bigButton = fullscreen ? "min-h-14 px-8 text-xl" : "";
  // El siguiente número de ganador: el más alto entre los activos + 1.
  const round = winners.reduce((highest, entry) => Math.max(highest, entry.number), 0) + 1;
  const pendingLabel = (count: number): string => `${count} pendiente${count === 1 ? "" : "s"}`;
  const activePrizeName = activePrize?.name ?? (practice ? "Práctica" : "Sin premio en juego");

  const wheel = (
    <RouletteWheel
      participants={participants}
      size={wheelSize}
      spinTarget={spinTarget}
      onPointerName={setPointerName}
      onSpinEnd={handleSpinEnd}
    />
  );

  const pointerNameBox = (
    <section
      aria-label="Nombre bajo el puntero"
      className={`mx-auto flex w-full items-center justify-center rounded-2xl border-2 border-wheel-cyan bg-wheel-purple px-4 py-2 text-center ${
        fullscreen ? "min-h-24 max-w-3xl" : "min-h-14 max-w-md"
      }`}
    >
      <p
        aria-hidden="true"
        className={`font-display font-extrabold break-words text-paper uppercase ${
          fullscreen ? "text-[2.5rem] leading-tight" : "text-lg tracking-wide"
        }`}
      >
        {pointerName || " "}
      </p>
      <p className="sr-only" aria-live="polite">
        {phase === "result" && result ? `Ganador: ${result.winnerName}` : ""}
      </p>
    </section>
  );

  const spinButton = (
    <Button
      className={`w-full ${fullscreen ? "max-w-2xl" : "max-w-md"} ${bigButton}`}
      onClick={handleSpinClick}
      disabled={busy || reason !== null}
      loading={phase === "requesting"}
      aria-describedby={reason ? reasonId : undefined}
    >
      <SparklesIcon className={`shrink-0 text-gold-300 ${fullscreen ? "size-6" : "size-4"}`} />
      {spinLabel}
    </Button>
  );

  const reasonAndError = (
    <>
      {reason ? (
        <p id={reasonId} className={`text-ink-600 ${fullscreen ? "text-xl" : "text-sm"}`}>
          {reason}
        </p>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </>
  );

  const muteButton = (
    <Button
      variant="secondary"
      aria-pressed={muted}
      aria-label="Silenciar sonido"
      title="Silenciar sonido"
      onClick={() => setMuted(!muted)}
      className="px-3"
    >
      {muted ? (
        <VolumeOffIcon className="size-5" />
      ) : (
        <VolumeIcon className="size-5 text-gold-700" />
      )}
    </Button>
  );

  const headerActions = (
    <>
      {muteButton}
      <Button onClick={() => void enterFullscreen()} disabled={busy}>
        <ExpandIcon />
        Pantalla completa
      </Button>
    </>
  );

  const cardClasses = "flex flex-col gap-3 rounded-3xl border border-line bg-paper p-5";
  const cardTitleClasses =
    "flex items-center gap-2 text-sm font-extrabold tracking-wide text-ink-900 uppercase";
  const chipClasses =
    "ml-auto rounded-full border border-line bg-paper-soft px-2.5 py-0.5 text-xs font-semibold text-ink-600";

  const prizesCard = (
    <section aria-label="Premios del sorteo" className={cardClasses}>
      <div className="flex items-center gap-2">
        <h2 className={cardTitleClasses}>
          <GiftIcon className="size-4 text-ink-500" />
          Premios
        </h2>
        <span className={chipClasses}>
          {`${prizes.length} Premio${prizes.length === 1 ? "" : "s"}`}
        </span>
        <Link
          href="/admin/premios"
          className="inline-flex items-center gap-1 rounded-full bg-paper-soft px-2.5 py-0.5 text-xs font-semibold text-ink-900 hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700"
        >
          <PlusIcon className="size-3" />
          Añadir
        </Link>
      </div>

      {fullscreen ? null : (
        <div className="rounded-2xl border border-line bg-paper-soft px-4 py-3">
          <p className="text-[0.65rem] font-semibold tracking-[0.15em] text-ink-500 uppercase">
            {`Premio en juego (ronda #${round})`}
          </p>
          <p className="mt-0.5 text-base font-extrabold text-ink-900">{activePrizeName}</p>
        </div>
      )}

      <div
        role="radiogroup"
        aria-labelledby={`${radioName}-legend`}
        className="flex max-h-56 flex-col gap-2 overflow-y-auto"
      >
        <p id={`${radioName}-legend`} className="sr-only">
          Premio en juego
        </p>
        {prizesWithUnits.length === 0 ? (
          <p className="text-sm text-ink-600">
            {prizes.length === 0
              ? "No hay premios para elegir."
              : "Todos los premios ya fueron sorteados."}{" "}
            <Link href="/admin/premios" className="underline hover:text-gold-700">
              Configurar premios
            </Link>
          </p>
        ) : (
          prizesWithUnits.map((prize) => (
            <label
              key={prize.id}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm text-ink-900 ${
                activePrize?.id === prize.id ? "border-ink-900 bg-paper-soft" : "border-line"
              }`}
            >
              <input
                type="radio"
                name={radioName}
                value={prize.id}
                checked={activePrize?.id === prize.id}
                disabled={busy}
                onChange={() => setChosenPrizeId(prize.id)}
                className="size-4 accent-ink-900"
              />
              <span className="font-semibold">{prize.name}</span>
              <span className="ml-auto shrink-0 text-xs text-ink-500">
                {pendingLabel(prize.pending)}
              </span>
            </label>
          ))
        )}
      </div>

      <label className="flex min-h-9 items-center gap-3 text-sm text-ink-900">
        <input
          type="checkbox"
          checked={practice}
          disabled={busy}
          onChange={(event) => setPractice(event.target.checked)}
          className="size-4 accent-ink-900"
        />
        Modo de práctica
      </label>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-500">
        <p>
          {"Participantes elegibles: "}
          <span className="font-bold text-ink-900">{participants.length}</span>
        </p>
        <p className="flex items-center gap-1">
          <TrophyIcon className="size-3.5 text-gold-600" />
          <span className="font-bold text-ink-900">{winners.length}</span>
          {winners.length === 1 ? " ganador" : " ganadores"}
        </p>
      </div>
    </section>
  );

  const winnersCard = (
    <section aria-labelledby={winnersHeadingId} className={cardClasses}>
      <div className="flex items-center gap-2">
        <h2 id={winnersHeadingId} className={cardTitleClasses}>
          <TrophyIcon className="size-4 text-gold-600" />
          Ganadores del evento
        </h2>
        <span className={chipClasses}>{winners.length}</span>
      </div>
      {winners.length === 0 ? (
        <p className="text-sm text-ink-500">Sin ganadores todavía.</p>
      ) : (
        <ul
          className={`flex flex-col gap-2 overflow-y-auto ${fullscreen ? "max-h-72" : "max-h-80"}`}
        >
          {winners.map((entry) => (
            <li
              key={entry.key}
              className="flex items-center gap-3 rounded-2xl bg-paper-soft px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-xs font-bold text-paper">
                {`#${entry.number}`}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-ink-900 uppercase">
                  {entry.fullName}
                </p>
                <p className="truncate text-xs font-semibold text-gold-700">
                  {entry.prizeName ?? "Sin premio"}
                </p>
              </div>
              {!fullscreen && !entry.legacy ? (
                <DiscardWinnerButton spinId={entry.key} number={entry.number} display="icon" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const sideColumn = (
    <div
      className={`flex w-full flex-col gap-4 ${fullscreen ? "max-w-md lg:w-md lg:shrink-0" : ""}`}
    >
      {fullscreen ? (
        <div className="flex flex-col gap-2 rounded-3xl border border-line bg-paper p-6 text-center">
          <p className="text-lg font-semibold tracking-wide text-ink-500 uppercase">
            Premio en juego
          </p>
          <p
            data-testid="fullscreen-prize"
            className="font-display text-5xl leading-tight font-extrabold break-words text-ink-900"
          >
            {activePrizeName}
          </p>
        </div>
      ) : null}
      {prizesCard}
      {winnersCard}
    </div>
  );

  const mainColumn = (
    <div className="flex min-w-0 flex-col items-center gap-5">
      {practice ? <Alert variant="info">Práctica: no se guarda</Alert> : null}
      {pointerNameBox}
      <div ref={wheelBox} className="w-full min-w-0">
        {wheel}
      </div>
      {spinButton}
      {reasonAndError}
    </div>
  );

  return (
    <section
      ref={stageRef}
      aria-label="Ruleta"
      data-testid={fullscreen ? "stage-fullscreen" : undefined}
      className={
        fullscreen ? "fixed inset-0 z-50 overflow-auto bg-paper-soft p-6" : "flex flex-col gap-4"
      }
    >
      {fullscreen ? (
        <>
          <div className="mx-auto flex min-h-full max-w-[1800px] flex-col items-center justify-center gap-8 pb-16 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">{mainColumn}</div>
            {sideColumn}
          </div>
          <div className="fixed bottom-4 left-6 opacity-90">
            <Logo size={32} />
          </div>
          <div className="fixed right-6 bottom-4 flex items-center gap-2 rounded-2xl border border-line bg-paper p-2">
            {muteButton}
            <Button onClick={() => void exitFullscreen()}>
              <ShrinkIcon />
              Salir de pantalla completa
            </Button>
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title="Control de ruleta y sorteo"
            subtitle="Gestiona las rondas de premiación en vivo."
            actions={headerActions}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
            {mainColumn}
            {sideColumn}
          </div>
        </>
      )}

      {/* La ventana del ganador va dentro de este contenedor para verse también en pantalla completa. */}
      <WinnerDialog
        open={(phase === "result" || phase === "discarding") && result !== null}
        number={result?.number ?? 0}
        prizeName={result?.prizeName ?? ""}
        winnerName={result?.winnerName ?? ""}
        practice={result?.practice ?? false}
        onContinue={closeResult}
        onDiscard={result?.practice === false ? () => void discardAndRespin() : undefined}
        busy={phase === "discarding"}
        error={dialogError}
      />
    </section>
  );
}
