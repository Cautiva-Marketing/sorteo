"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { adminFetch } from "@/lib/admin-fetch";

export interface RegistrationToggleProps {
  /** Estado actual leído en el servidor. */
  initialOpen: boolean;
}

const MESSAGES = {
  failed: "No pudimos cambiar el estado de las inscripciones. Inténtalo de nuevo.",
  forbidden: "No tienes permisos de administrador para hacer este cambio.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
} as const;

/** Lee el campo `open` de la respuesta; `null` si no tiene el formato esperado. */
async function readOpen(response: Response): Promise<boolean | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "open" in body) {
      return typeof body.open === "boolean" ? body.open : null;
    }
  } catch {
    // Cuerpo vacío o que no es JSON.
  }
  return null;
}

/** Muestra el estado de las inscripciones y permite abrirlas o cerrarlas (FR-029). */
export function RegistrationToggle({ initialOpen }: RegistrationToggleProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [open, setOpen] = useState(initialOpen);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function toggle(): Promise<void> {
    const target = !open;
    setPending(true);
    setError(null);
    setConfirmation("");
    try {
      const response = await adminFetch("/api/admin/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: target }),
      });
      if (!response.ok) {
        setError(response.status === 403 ? MESSAGES.forbidden : MESSAGES.failed);
        return;
      }
      const confirmed = (await readOpen(response)) ?? target;
      setOpen(confirmed);
      // Las demás secciones de la página (p. ej. el borrado de datos) dependen de este estado.
      startRefresh(() => router.refresh());
      setConfirmation(
        confirmed
          ? "Listo: las inscripciones quedaron abiertas."
          : "Listo: las inscripciones quedaron cerradas.",
      );
    } catch {
      setError(MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="registration-heading" className="flex flex-col gap-4">
      <h2 id="registration-heading" className="font-display text-lg font-extrabold text-ink-900">
        Inscripciones
      </h2>
      <p className="text-base text-ink-900">
        {open ? "Las inscripciones están abiertas" : "Las inscripciones están cerradas"}
      </p>
      <p className="text-base text-ink-600">
        {open
          ? "Los visitantes pueden registrarse desde la página principal."
          : "La página principal muestra un aviso y no se aceptan nuevos registros."}
      </p>
      <div>
        <Button variant={open ? "danger" : "primary"} loading={pending} onClick={toggle}>
          {open ? "Cerrar inscripciones" : "Abrir inscripciones"}
        </Button>
      </div>
      <div aria-live="polite" className="min-h-6 text-base text-success-700">
        {confirmation}
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </section>
  );
}
