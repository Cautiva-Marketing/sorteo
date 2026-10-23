"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { adminFetch } from "@/lib/admin-fetch";
import { prizeSchema, type PrizeFormInput, type PrizeInput } from "@/lib/validation/schemas";
import type { PrizeView } from "@/types";

export interface PrizePanelProps {
  /** Premios leídos en el servidor, ordenados por `order`. */
  prizes: PrizeView[];
}

const MESSAGES = {
  failed: "No pudimos guardar el cambio. Inténtalo de nuevo.",
  forbidden: "No tienes permisos de administrador para hacer este cambio.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  hasHistory: "Este premio ya tiene ganadores y no se puede eliminar.",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface ApiResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/** Llama a la API del panel y devuelve estado y cuerpo JSON (o `null` si no lo hay). */
async function send(url: string, method: string, body?: unknown): Promise<ApiResult> {
  const response = await adminFetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Respuesta sin cuerpo (204) o que no es JSON.
  }
  return { ok: response.ok, status: response.status, body: parsed };
}

/** Pasa los `fieldErrors` del 400 a los campos del formulario; `true` si colocó alguno. */
function applyFieldErrors(body: unknown, setError: UseFormSetError<PrizeFormInput>): boolean {
  if (!isRecord(body) || !isRecord(body.fieldErrors)) {
    return false;
  }
  let applied = false;
  for (const field of ["name", "quantity"] as const) {
    const messages = body.fieldErrors[field];
    const first: unknown = Array.isArray(messages) ? messages[0] : undefined;
    if (typeof first === "string") {
      setError(field, { message: first });
      applied = true;
    }
  }
  return applied;
}

function isPrizeView(value: unknown): value is PrizeView {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.quantity === "number" &&
    typeof value.delivered === "number" &&
    typeof value.spinCount === "number" &&
    typeof value.pending === "number" &&
    typeof value.exhausted === "boolean"
  );
}

function generalMessage(result: ApiResult): string {
  if (result.status === 403) {
    return MESSAGES.forbidden;
  }
  if (isRecord(result.body) && typeof result.body.message === "string") {
    return result.body.message;
  }
  return MESSAGES.failed;
}

interface PrizeRowProps {
  prize: PrizeView;
  index: number;
  total: number;
  busy: boolean;
  onMove: (index: number, delta: -1 | 1) => void;
  onDelete: (prize: PrizeView) => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

/** Una fila de la lista: datos del premio, edición en línea, orden y baja. */
function PrizeRow({
  prize,
  index,
  total,
  busy,
  onMove,
  onDelete,
  onSaved,
  onError,
}: PrizeRowProps) {
  const [editing, setEditing] = useState(false);
  const noteId = useId();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PrizeFormInput, unknown, PrizeInput>({
    resolver: zodResolver(prizeSchema),
    defaultValues: { name: prize.name, quantity: prize.quantity },
  });

  async function save(values: PrizeInput): Promise<void> {
    try {
      const result = await send(`/api/admin/prizes/${prize.id}`, "PUT", values);
      if (result.ok) {
        setEditing(false);
        onSaved();
        return;
      }
      if (result.status === 400 && applyFieldErrors(result.body, setError)) {
        return;
      }
      onError(generalMessage(result));
    } catch {
      onError(MESSAGES.network);
    }
  }

  function cancel(): void {
    reset({ name: prize.name, quantity: prize.quantity });
    setEditing(false);
  }

  const hasHistory = prize.spinCount > 0;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-paper px-5 py-4">
      {editing ? (
        <form onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-3">
          <TextField
            label="Nuevo nombre"
            autoComplete="off"
            error={errors.name?.message}
            {...register("name")}
          />
          <TextField
            label="Nueva cantidad"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={1}
            error={errors.quantity?.message}
            {...register("quantity")}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={isSubmitting}>
              Guardar
            </Button>
            <Button variant="secondary" onClick={cancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-display text-lg font-extrabold text-ink-900">{prize.name}</p>
            <p className="text-base text-ink-600">
              {`${prize.delivered} de ${prize.quantity} entregadas`}
              {prize.exhausted ? " · Sorteado" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                // Los datos pudieron cambiar tras refrescar: el formulario parte de los actuales.
                reset({ name: prize.name, quantity: prize.quantity });
                setEditing(true);
              }}
              disabled={busy}
              aria-label={`Editar ${prize.name}`}
            >
              Editar
            </Button>
            <Button
              variant="secondary"
              onClick={() => onMove(index, -1)}
              disabled={busy || index === 0}
              aria-label={`Subir ${prize.name}`}
            >
              Subir
            </Button>
            <Button
              variant="secondary"
              onClick={() => onMove(index, 1)}
              disabled={busy || index === total - 1}
              aria-label={`Bajar ${prize.name}`}
            >
              Bajar
            </Button>
            <Button
              variant="secondary"
              onClick={() => onDelete(prize)}
              disabled={busy || hasHistory}
              aria-describedby={hasHistory ? noteId : undefined}
              aria-label={`Eliminar ${prize.name}`}
            >
              Eliminar
            </Button>
          </div>
          {hasHistory ? (
            <p id={noteId} className="text-sm text-ink-600">
              Ya tiene ganadores
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

/**
 * Lista de premios del sorteo (FR-060 a FR-063): alta, edición en línea, orden con botones
 * Subir/Bajar y baja con confirmación. Tras cada cambio refresca los datos del servidor.
 */
export function PrizePanel({ prizes }: PrizePanelProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PrizeView | null>(null);
  // Cambio ya guardado que se muestra sin esperar al refresco del servidor. Solo vale
  // mientras `prizes` sea la misma lista sobre la que se calculó: al llegar la nueva, se ignora.
  const [overlay, setOverlay] = useState<{ base: PrizeView[]; list: PrizeView[] } | null>(null);
  const shown = overlay !== null && overlay.base === prizes ? overlay.list : prizes;

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PrizeFormInput, unknown, PrizeInput>({
    resolver: zodResolver(prizeSchema),
    defaultValues: { name: "", quantity: 1 },
  });

  function refresh(): void {
    startRefresh(() => router.refresh());
  }

  async function add(values: PrizeInput): Promise<void> {
    setError(null);
    try {
      const result = await send("/api/admin/prizes", "POST", values);
      if (result.ok) {
        reset({ name: "", quantity: 1 });
        if (isPrizeView(result.body)) {
          setOverlay({ base: prizes, list: [...shown, result.body] });
        }
        refresh();
        return;
      }
      if (result.status === 400 && applyFieldErrors(result.body, setFieldError)) {
        return;
      }
      setError(generalMessage(result));
    } catch {
      setError(MESSAGES.network);
    }
  }

  async function move(index: number, delta: -1 | 1): Promise<void> {
    const reordered = [...shown];
    const target = index + delta;
    const moved = reordered[index];
    const swapped = reordered[target];
    if (moved === undefined || swapped === undefined) {
      return;
    }
    reordered[index] = swapped;
    reordered[target] = moved;
    setBusy(true);
    setError(null);
    try {
      const result = await send("/api/admin/prizes/order", "PUT", {
        ids: reordered.map((prize) => prize.id),
      });
      if (result.ok) {
        // Ya guardado: se muestra sin esperar al refresco del servidor.
        setOverlay({ base: prizes, list: reordered });
        refresh();
      } else {
        setError(generalMessage(result));
      }
    } catch {
      setError(MESSAGES.network);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    const prize = toDelete;
    setToDelete(null);
    if (!prize) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await send(`/api/admin/prizes/${prize.id}`, "DELETE");
      if (result.ok) {
        setOverlay({ base: prizes, list: shown.filter((entry) => entry.id !== prize.id) });
        refresh();
      } else if (result.status === 409) {
        setError(MESSAGES.hasHistory);
        refresh();
      } else {
        setError(generalMessage(result));
      }
    } catch {
      setError(MESSAGES.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Premios" className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit(add)}
        noValidate
        className="flex max-w-md flex-col gap-4 rounded-3xl border border-line bg-paper p-6"
      >
        <TextField
          label="Nombre del premio"
          autoComplete="off"
          error={errors.name?.message}
          {...register("name")}
        />
        <TextField
          label="Cantidad"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          step={1}
          error={errors.quantity?.message}
          {...register("quantity")}
        />
        <div>
          <Button type="submit" loading={isSubmitting}>
            Agregar premio
          </Button>
        </div>
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {shown.length === 0 ? (
        <p className="rounded-3xl border border-line bg-paper px-4 py-10 text-center text-base text-ink-900">
          Aún no hay premios. Agrega el primero.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((prize, index) => (
            <PrizeRow
              key={prize.id}
              prize={prize}
              index={index}
              total={shown.length}
              busy={busy}
              onMove={move}
              onDelete={setToDelete}
              onSaved={refresh}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={toDelete ? `¿Eliminar el premio “${toDelete.name}”?` : "Eliminar premio"}
      >
        <p className="text-base text-ink-900">Esta acción no se puede deshacer.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Sí, eliminar
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
