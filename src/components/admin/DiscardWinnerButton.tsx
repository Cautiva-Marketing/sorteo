"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { adminFetch } from "@/lib/admin-fetch";

export interface DiscardWinnerButtonProps {
  /** Id del giro (`spins/{id}`). */
  spinId: string;
  /** Número de ganador, para el texto de confirmación. */
  number: number;
}

const MESSAGES = {
  failed: "No pudimos descartar al ganador. Inténtalo de nuevo.",
  forbidden: "No tienes permisos de administrador para hacer este cambio.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
} as const;

/**
 * Descarta a un ganador desde el historial (FR-078): pide confirmación, llama al servidor y
 * refresca. La unidad vuelve al premio y la persona no vuelve a la ruleta.
 */
export function DiscardWinnerButton({ spinId, number }: DiscardWinnerButtonProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discard(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const response = await adminFetch(`/api/admin/spins/${spinId}/discard`, { method: "POST" });
      if (response.ok || response.status === 409) {
        // 409: ya estaba descartado (otra sesión); la pantalla solo necesita refrescarse.
        setOpen(false);
        startRefresh(() => router.refresh());
        return;
      }
      setError(response.status === 403 ? MESSAGES.forbidden : MESSAGES.failed);
    } catch {
      setError(MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label={`Descartar al ganador #${number}`}
      >
        Descartar
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`¿Descartar al ganador #${number}?`}
      >
        <p className="text-base text-ink-900">
          La unidad volverá a estar disponible y esta persona no volverá a participar.
        </p>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void discard()} loading={pending}>
            Sí, descartar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
