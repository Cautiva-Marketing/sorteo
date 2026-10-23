"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { adminFetch } from "@/lib/admin-fetch";
import { PURGE_CONFIRMATION, purgeRequestSchema } from "@/lib/validation/schemas";

export interface PurgeDialogProps {
  /** Las inscripciones siguen abiertas: el borrado está bloqueado (FR-030). */
  registrationOpen: boolean;
}

const MESSAGES = {
  open: "Cierra primero las inscripciones.",
  invalidPhrase: `Escribe ${PURGE_CONFIRMATION} para confirmar el borrado.`,
  failed: "No pudimos completar el borrado. Vuelve a intentarlo: la operación se puede repetir.",
  forbidden: "No tienes permisos de administrador para borrar los datos.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
} as const;

async function readDeleted(response: Response): Promise<number | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "deletedParticipants" in body) {
      return typeof body.deletedParticipants === "number" ? body.deletedParticipants : null;
    }
  } catch {
    // Cuerpo vacío o que no es JSON.
  }
  return null;
}

async function readCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return typeof body.code === "string" ? body.code : null;
    }
  } catch {
    // Cuerpo vacío o que no es JSON.
  }
  return null;
}

function deletedMessage(count: number): string {
  if (count === 0) {
    return "Listo: no quedaban participantes por eliminar. Los datos de los ganadores ya conservan solo el nombre.";
  }
  return count === 1
    ? "Listo: se eliminó 1 participante. Los ganadores de los sorteos conservan solo el nombre."
    : `Listo: se eliminaron ${count} participantes. Los ganadores de los sorteos conservan solo el nombre.`;
}

/**
 * Botón y diálogo de confirmación para borrar definitivamente los datos personales de la campaña
 * (FR-030, FR-031). Advierte que es irreversible, sugiere exportar antes y exige escribir `BORRAR`.
 */
export function PurgeDialog({ registrationOpen }: PurgeDialogProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [phraseError, setPhraseError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);

  const phraseValid = purgeRequestSchema.safeParse({ confirm: phrase }).success;

  function openDialog(): void {
    setPhrase("");
    setPhraseError(undefined);
    setError(null);
    setDialogOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = purgeRequestSchema.safeParse({ confirm: phrase });
    if (!parsed.success) {
      setPhraseError(MESSAGES.invalidPhrase);
      return;
    }

    setPending(true);
    setError(null);
    setPhraseError(undefined);
    try {
      const response = await adminFetch("/api/admin/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setDeleted((await readDeleted(response)) ?? 0);
        setDialogOpen(false);
        startRefresh(() => router.refresh());
        return;
      }
      const code = await readCode(response);
      if (code === "REGISTRATION_OPEN") {
        setError(MESSAGES.open);
        // El estado pudo cambiar desde otra pestaña: se actualiza la pantalla.
        startRefresh(() => router.refresh());
      } else if (response.status === 400) {
        setPhraseError(MESSAGES.invalidPhrase);
      } else {
        setError(response.status === 403 ? MESSAGES.forbidden : MESSAGES.failed);
      }
    } catch {
      setError(MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="danger"
          disabled={registrationOpen}
          aria-describedby={registrationOpen ? "purge-blocked" : undefined}
          onClick={openDialog}
        >
          Borrar datos de participantes
        </Button>
      </div>
      {registrationOpen ? (
        <p id="purge-blocked" className="text-base text-ink-600">
          Cierra primero las inscripciones
        </p>
      ) : null}

      <div aria-live="polite">
        {deleted !== null ? <Alert variant="success">{deletedMessage(deleted)}</Alert> : null}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Borrar los datos de los participantes"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Alert variant="error">
            Esta acción es irreversible. Se eliminarán para siempre el nombre, el celular y la
            empresa u ocupación de todos los participantes, incluidos los ganadores. De cada sorteo
            solo se conservan los nombres de los ganadores, la fecha y la cantidad.
          </Alert>
          <p className="text-base text-ink-900">
            Antes de continuar, te recomendamos exportar la lista de participantes.{" "}
            <a
              href="/api/admin/participants/export"
              download
              className="font-medium text-accent-600 underline"
            >
              Exportar CSV
            </a>
          </p>
          <TextField
            label={`Escribe ${PURGE_CONFIRMATION} para confirmar`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={phrase}
            error={phraseError}
            onChange={(event) => {
              setPhrase(event.target.value);
              setPhraseError(undefined);
            }}
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={pending} disabled={!phraseValid}>
              Borrar definitivamente
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
