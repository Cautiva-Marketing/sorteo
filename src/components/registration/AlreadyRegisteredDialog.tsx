"use client";

import { PersonIcon } from "@/components/registration/WelcomeDialog";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export interface AlreadyRegisteredDialogProps {
  open: boolean;
  /** «Listo, muchas gracias» o Escape. */
  onDone: () => void;
  /** «Registrar a otra persona»: el formulario queda vacío. */
  onRegisterAnother: () => void;
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-14 text-gold-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/**
 * Ventana cuando el celular ya estaba registrado (FR-040): mismo estilo que la bienvenida, sin
 * ticket ni confeti y sin mostrar ningún dato del registro existente.
 */
export function AlreadyRegisteredDialog({
  open,
  onDone,
  onRegisterAnother,
}: AlreadyRegisteredDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onDone}
      title="Ya estás participando en el sorteo"
      centered
      blurBackdrop
      icon={<InfoIcon />}
    >
      <div className="flex flex-col gap-4 text-center">
        <p className="text-base text-ink-600">
          Ese celular ya está registrado, no necesitas hacer nada más. ¡Mucha suerte!
        </p>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={onDone}>
            Listo, muchas gracias
          </Button>
          <Button variant="secondary" className="w-full gap-2" onClick={onRegisterAnother}>
            <PersonIcon />
            Registrar a otra persona
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
