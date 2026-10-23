"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ClosedNotice } from "@/components/registration/ClosedNotice";
import type { PublicStatus } from "@/types";

/** Cada cuánto se consulta `/api/status`: con la memoria de 1 s del servidor, el cambio se ve en ~4 s. */
const POLL_INTERVAL_MS = 3000;

export interface LiveRegistrationPanelProps {
  /** Estado leído en el servidor al renderizar la página. */
  initial: PublicStatus;
  /** El QR (renderizado en el servidor); se muestra mientras las inscripciones están abiertas. */
  qr: ReactNode;
}

function isPublicStatus(value: unknown): value is PublicStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    "open" in value &&
    typeof value.open === "boolean" &&
    "count" in value &&
    typeof value.count === "number" &&
    Number.isInteger(value.count) &&
    value.count >= 0
  );
}

/**
 * Isla de cliente de la pantalla del QR: muestra el contador de registrados y lo mantiene al día
 * con un sondeo de `/api/status`; si las inscripciones se cierran, reemplaza el QR y el botón por
 * el aviso de cierre. Ante un fallo de red conserva el último valor, sin mostrar errores.
 *
 * Diseño: una sola columna en todos los tamaños (QR y contador en una tarjeta redondeada). El
 * tamaño del QR lo limita la página según el alto de la pantalla para que nada exija desplazarse.
 */
export function LiveRegistrationPanel({ initial, qr }: LiveRegistrationPanelProps) {
  const [status, setStatus] = useState<PublicStatus>(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const body: unknown = await response.json();
        if (!cancelled && isPublicStatus(body)) {
          setStatus((current) =>
            current.open === body.open && current.count === body.count ? current : body,
          );
        }
      } catch {
        // Sin conexión o respuesta inválida: se conserva el último valor conocido.
      }
    }

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    // Al volver a estar visible se consulta de inmediato, sin esperar al siguiente intervalo.
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const label = status.count === 1 ? "registrado" : "registrados";

  const counter = (
    <div className="flex items-center justify-center gap-3">
      <span aria-hidden="true" className="relative flex size-3.5 shrink-0">
        <span className="absolute inline-flex size-full rounded-full bg-gold-300 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-3.5 rounded-full bg-gold-600" />
      </span>
      <p className="font-display text-2xl font-semibold text-ink-900">
        <span className="font-extrabold text-gold-700">{status.count.toLocaleString("es-PE")}</span>
        {` ${label}`}
      </p>
    </div>
  );

  // Una sola columna en todos los tamaños, como el ejemplo: tarjeta con el QR y el contador. Con
  // las inscripciones cerradas, el aviso reemplaza a la tarjeta.
  if (!status.open) {
    return (
      <div className="flex flex-col gap-5">
        <ClosedNotice />
        {counter}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-paper p-5 md:p-6">
      {qr}
      <div className="border-t border-line pt-4">{counter}</div>
    </div>
  );
}
