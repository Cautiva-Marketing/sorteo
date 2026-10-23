"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  /** Se llama cuando el usuario cierra el diálogo (Escape); no al cerrarlo con `open={false}`. */
  onClose: () => void;
  title: string;
  /** Ícono opcional centrado sobre el título. */
  icon?: ReactNode;
  /** Centra el título (ventanas de resultado); por defecto va alineado a la izquierda. */
  centered?: boolean;
  children: ReactNode;
}

/**
 * Diálogo modal accesible basado en `<dialog>` nativo: `showModal()` atrapa el foco dentro del
 * diálogo, deja inerte el resto de la página y lo cierra con Escape. El título nombra el diálogo
 * con `aria-labelledby`. El contenido solo se monta mientras está abierto, así que cada apertura
 * empieza con el estado limpio.
 *
 * El cierre provocado por pasar `open={false}` NO invoca `onClose`: el padre ya sabe que lo cerró.
 */
export function Dialog({ open, onClose, title, icon, centered = false, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingFromProp = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      closingFromProp.current = true;
      dialog.close();
    }
  }, [open]);

  function handleClose(): void {
    if (closingFromProp.current) {
      closingFromProp.current = false;
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-3xl border border-line bg-paper p-6 text-ink-900 backdrop:bg-ink-900/50 backdrop:backdrop-blur-[2px]"
    >
      {open ? (
        <div className="flex flex-col gap-4">
          {icon ? <div className="flex justify-center">{icon}</div> : null}
          <h2
            id={titleId}
            className={`font-display text-xl font-extrabold text-ink-900${centered ? " text-center" : ""}`}
          >
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
