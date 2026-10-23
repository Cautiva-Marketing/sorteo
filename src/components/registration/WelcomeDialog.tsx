"use client";

import { Confetti } from "@/components/ui/Confetti";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Logo } from "@/components/ui/Logo";
import { formatNationalPhone } from "@/lib/validation/phone";

export interface WelcomeDialogProps {
  open: boolean;
  fullName: string;
  /** Los 9 dígitos nacionales del celular recién registrado. */
  phone: string;
  /** «Listo, muchas gracias» o Escape. */
  onDone: () => void;
  /** «Registrar a otra persona»: el formulario queda vacío. */
  onRegisterAnother: () => void;
}

function TicketIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0 text-accent-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
      <path d="M13 5v14" strokeDasharray="2 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0 text-success-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16 9.5" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

/**
 * Ventana de bienvenida al completar el registro (FR-037 a FR-039, FR-041): nombre, ticket con el
 * celular completo y estado «En sorteo», y las dos acciones. Los datos salen de lo que la persona
 * acaba de escribir; el servidor no los devuelve.
 */
export function WelcomeDialog({
  open,
  fullName,
  phone,
  onDone,
  onRegisterAnother,
}: WelcomeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onDone}
      title="¡Bienvenido(a)!"
      centered
      icon={<Logo variant="icon" size={56} />}
    >
      {open ? <Confetti /> : null}
      <div className="flex flex-col gap-4 text-center">
        <p className="font-display text-xl font-bold break-words text-ink-900">{fullName}</p>
        <p className="text-base text-ink-600">
          Tu registro se completó con éxito. Ya estás participando en el sorteo. ¡Te deseamos mucha
          suerte!
        </p>
        <div className="rounded-xl border border-line bg-paper-soft p-4 text-left">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <TicketIcon />
            <span className="text-sm font-semibold tracking-wide text-ink-900 uppercase">
              Ticket registrado
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-600 uppercase">
                Celular:
              </dt>
              <dd className="font-display text-lg font-semibold text-ink-900">
                {formatNationalPhone(phone)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-600 uppercase">
                Estado:
              </dt>
              <dd className="flex items-center gap-1.5 font-display text-lg font-semibold text-ink-900">
                <CheckIcon />
                En sorteo
              </dd>
            </div>
          </dl>
        </div>
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
