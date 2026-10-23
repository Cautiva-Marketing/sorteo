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
import { RouletteWheel, type SpinTarget } from "@/components/admin/RouletteWheel";
import { useFullscreen } from "@/components/admin/useFullscreen";
import { WinnerDialog } from "@/components/admin/WinnerDialog";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Logo } from "@/components/ui/Logo";
import { adminFetch } from "@/lib/admin-fetch";
import { getMuted, playVictory, primeAudio, setMuted, subscribeMuted } from "@/lib/victory-sound";
import type { PrizeView, WheelParticipant } from "@/types";

export interface DrawStageProps {
  prizes: PrizeView[];
  /** Elegibles de la ruleta, leídos en el servidor. */
  participants: WheelParticipant[];
  /** Las inscripciones siguen abiertas: el primer giro real pide confirmar el cierre (FR-089). */
  registrationOpen: boolean;
}

type Phase = "idle" | "confirming" | "requesting" | "spinning" | "result" | "discarding";

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
const MAX_SIZE = 560;
/** Tamaño máximo de la ruleta en pantalla completa y ancho desde el que se usan dos columnas. */
const MAX_FULLSCREEN_SIZE = 960;
const WIDE_VIEWPORT = 1024;

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
 * Escenario del sorteo (FR-064 a FR-077, FR-089, FR-090): premio en juego, ruleta, botón de girar,
 * modo de práctica, silencio y ventana del ganador. El servidor decide y guarda al ganador antes de
 * la animación; aquí solo se anima hacia el resultado recibido.
 */
export function DrawStage({
  prizes,
  participants: serverParticipants,
  registrationOpen,
}: DrawStageProps) {
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
  // El primer giro real cierra las inscripciones; hasta que el servidor refresque la página, la
  // propiedad `registrationOpen` sigue vieja y no debe volver a pedirse la confirmación.
  const [closedBySpin, setClosedBySpin] = useState(false);
  const [size, setSize] = useState(MIN_SIZE);
  const spinCounter = useRef(0);
  const wheelBox = useRef<HTMLDivElement>(null);
  const reasonId = useId();
  const radioName = useId();

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

  // En pantalla completa la ruleta ocupa el alto disponible (y hasta el 55 % del ancho si es ancha).
  const wheelSize = fullscreen
    ? Math.max(
        MIN_SIZE,
        Math.min(
          MAX_FULLSCREEN_SIZE,
          viewportHeight - 64,
          viewportWidth >= WIDE_VIEWPORT ? Math.floor(viewportWidth * 0.55) : viewportWidth - 48,
        ),
      )
    : size;

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
    setError(null);
    if (!practice && registrationOpen && !closedBySpin) {
      setPhase("confirming");
      return;
    }
    void startSpin(false);
  }

  async function startSpin(confirmClose: boolean): Promise<void> {
    setPhase("requesting");
    setError(null);
    try {
      const response = practice
        ? await adminFetch("/api/admin/spins/practice", { method: "POST" })
        : await adminFetch("/api/admin/spins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              confirmClose
                ? { prizeId: activePrize?.id, confirmCloseRegistration: true }
                : { prizeId: activePrize?.id },
            ),
          });
      const body = await readJson(response);

      if (response.ok) {
        const parsed = parseSpin(body, practice);
        if (parsed) {
          const known = participants.some((entry) => entry.ref === parsed.winnerRef);
          const instant = !known || window.matchMedia(REDUCED_MOTION_QUERY).matches;
          spinCounter.current += 1;
          if (!practice) {
            setClosedBySpin(true);
          }
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
      } else if (codeOf(body) === "CONFIRMATION_REQUIRED") {
        setPhase("confirming");
        return;
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
    await startSpin(false);
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

  const bigButton = fullscreen ? "min-h-14 px-8 text-xl" : undefined;

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
      className={`mx-auto flex w-full items-center justify-center rounded-2xl border border-ink-300 bg-paper-soft px-4 py-2 text-center ${
        fullscreen ? "min-h-24 max-w-3xl" : "min-h-14 max-w-xl"
      }`}
    >
      <p
        aria-hidden="true"
        className={`font-display font-bold break-words text-ink-900 ${
          fullscreen ? "text-[2.5rem] leading-tight" : "text-xl"
        }`}
      >
        {pointerName || " "}
      </p>
      <p className="sr-only" aria-live="polite">
        {phase === "result" && result ? `Ganador: ${result.winnerName}` : ""}
      </p>
    </section>
  );

  const actionRow = (
    <div
      className={`flex flex-wrap items-center gap-3 ${fullscreen ? "justify-center gap-4" : ""}`}
    >
      <Button
        className={bigButton}
        onClick={handleSpinClick}
        disabled={busy || reason !== null}
        loading={phase === "requesting"}
        aria-describedby={reason ? reasonId : undefined}
      >
        {spinLabel}
      </Button>
      <Button
        variant="secondary"
        className={bigButton}
        aria-pressed={muted}
        onClick={() => setMuted(!muted)}
      >
        Silenciar sonido
      </Button>
      {fullscreen ? (
        <Button variant="secondary" className={bigButton} onClick={() => void exitFullscreen()}>
          Salir de pantalla completa
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => void enterFullscreen()} disabled={busy}>
          Pantalla completa
        </Button>
      )}
    </div>
  );

  const reasonAndError = (
    <>
      {reason ? (
        <p id={reasonId} className={`text-ink-600 ${fullscreen ? "text-xl" : "text-base"}`}>
          {reason}
        </p>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </>
  );

  return (
    <section
      ref={stageRef}
      aria-labelledby="stage-heading"
      data-testid={fullscreen ? "stage-fullscreen" : undefined}
      className={
        fullscreen ? "fixed inset-0 z-50 overflow-auto bg-paper p-6" : "flex flex-col gap-4"
      }
    >
      {fullscreen ? (
        <div className="mx-auto flex min-h-full max-w-[1800px] flex-col items-center justify-center gap-8 lg:flex-row">
          <h2 id="stage-heading" className="sr-only">
            Ruleta
          </h2>
          <div className="shrink-0">{wheel}</div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-6 text-center">
            <Logo />
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold tracking-wide text-ink-600 uppercase">
                Premio en juego
              </p>
              <p
                data-testid="fullscreen-prize"
                className="font-display text-5xl font-bold break-words text-ink-900"
              >
                {activePrize?.name ?? (practice ? "Práctica" : "Sin premio en juego")}
              </p>
            </div>
            {practice ? <Alert variant="info">Práctica: no se guarda</Alert> : null}
            {pointerNameBox}
            {actionRow}
            {reasonAndError}
          </div>
        </div>
      ) : (
        <>
          <h2 id="stage-heading" className="font-display text-xl font-bold text-ink-900">
            Ruleta
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
            <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
              <p className="text-base text-ink-600">{`Participantes elegibles: ${participants.length}`}</p>

              <div
                role="radiogroup"
                aria-labelledby={`${radioName}-legend`}
                className="flex flex-col gap-2"
              >
                <p
                  id={`${radioName}-legend`}
                  className="text-sm font-semibold tracking-wide uppercase"
                >
                  Premio en juego
                </p>
                {prizesWithUnits.length === 0 ? (
                  <p className="text-base text-ink-600">
                    {prizes.length === 0
                      ? "No hay premios para elegir."
                      : "Todos los premios ya fueron sorteados."}{" "}
                    <Link href="/admin/premios" className="underline hover:text-accent-600">
                      Configurar premios
                    </Link>
                  </p>
                ) : (
                  prizesWithUnits.map((prize) => (
                    <label
                      key={prize.id}
                      className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 py-2 text-base text-ink-900"
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
                      <span>{prize.name}</span>
                      <span className="ml-auto text-sm text-ink-600">
                        {`${prize.pending} pendiente${prize.pending === 1 ? "" : "s"}`}
                      </span>
                    </label>
                  ))
                )}
              </div>

              <label className="flex min-h-11 items-center gap-3 text-base text-ink-900">
                <input
                  type="checkbox"
                  checked={practice}
                  disabled={busy}
                  onChange={(event) => setPractice(event.target.checked)}
                  className="size-4 accent-ink-900"
                />
                Modo de práctica
              </label>
              {practice ? <Alert variant="info">Práctica: no se guarda</Alert> : null}
            </div>
            <div className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div ref={wheelBox} className="w-full min-w-0">
                {wheel}
              </div>
              {pointerNameBox}
            </div>
            <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
              {actionRow}
              {reasonAndError}
            </div>
          </div>
        </>
      )}

      {/* Las ventanas van dentro de este contenedor para verse también en pantalla completa. */}
      <Dialog
        open={phase === "confirming"}
        onClose={() => setPhase("idle")}
        title="Se cerrarán las inscripciones"
      >
        <p className="text-base text-ink-900">
          Al girar por primera vez se cerrarán las inscripciones para que la lista de participantes
          quede fija durante el sorteo. Podrás reabrirlas desde Campaña.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setPhase("idle")}>
            Cancelar
          </Button>
          <Button onClick={() => void startSpin(true)}>Sí, girar</Button>
        </div>
      </Dialog>

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
