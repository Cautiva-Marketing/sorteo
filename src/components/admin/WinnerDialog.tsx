"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { Dialog } from "@/components/ui/Dialog";
import { Logo } from "@/components/ui/Logo";

export interface WinnerDialogProps {
  open: boolean;
  /** Número de ganador (FR-082); sin sentido en práctica. */
  number: number;
  prizeName: string;
  winnerName: string;
  /** Giro de práctica: no se guardó nada y la ventana solo ofrece cerrar. */
  practice: boolean;
  /** «Continuar»/«Cerrar» y también Escape: el ganador ya está guardado desde la respuesta del servidor. */
  onContinue: () => void;
  /** «Volver a girar»: descarta al ganador y gira de nuevo. Solo en giros reales (FR-075). */
  onDiscard?: () => void;
  /** Mientras se descarta: deshabilita los botones. */
  busy?: boolean;
  /** Error del descarte, mostrado dentro de la ventana. */
  error?: string | null;
}

/**
 * Ventana «¡Ganador #N!» (FR-074, FR-075): premio y nombre completo del ganador —sin celular ni
 * empresa— con confeti. El nombre se ajusta en varias líneas hasta con 100 caracteres.
 */
export function WinnerDialog({
  open,
  number,
  prizeName,
  winnerName,
  practice,
  onContinue,
  onDiscard,
  busy = false,
  error = null,
}: WinnerDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onContinue}
      title={practice ? "¡Ganador de práctica!" : `¡Ganador #${number}!`}
      centered
      icon={<Logo variant="icon" size={56} />}
    >
      {open ? <Confetti pieces={60} accent /> : null}
      <div className="flex flex-col items-center gap-4 text-center">
        {practice ? (
          <p className="rounded-full border border-ink-300 px-3 py-1 text-sm font-semibold tracking-wide text-ink-900 uppercase">
            Práctica
          </p>
        ) : null}
        <p className="text-sm font-semibold tracking-wide text-ink-600 uppercase">{prizeName}</p>
        <p className="font-display text-2xl font-extrabold break-words text-ink-900">
          {winnerName}
        </p>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex w-full flex-col gap-2">
          <Button className="w-full" onClick={onContinue} disabled={busy}>
            {practice ? "Cerrar" : "Continuar"}
          </Button>
          {!practice && onDiscard ? (
            <Button variant="secondary" className="w-full" onClick={onDiscard} loading={busy}>
              Volver a girar
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
