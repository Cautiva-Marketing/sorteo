import { headers } from "next/headers";
import { LiveRegistrationPanel } from "@/components/qr/LiveRegistrationPanel";
import { QrCode } from "@/components/qr/QrCode";
import { Alert } from "@/components/ui/Alert";
import { Logo } from "@/components/ui/Logo";
import { PartnerLogos } from "@/components/ui/PartnerLogos";
import { buildOrigin } from "@/lib/origin";
import { getPublicStatus } from "@/services/public-status.service";

// El estado se lee en cada petición para reflejar el cierre de inmediato.
export const dynamic = "force-dynamic";

/**
 * Pantalla del QR (la dirección raíz): para proyectar en el evento. El QR lleva a `/registro`; el
 * contador se actualiza solo y, con las inscripciones cerradas, el QR se reemplaza por el aviso.
 * Nunca muestra el formulario (FR-047) ni un botón para registrarse desde el mismo dispositivo.
 */
export default async function HomePage() {
  const status = await getPublicStatus();
  const origin = buildOrigin(await headers());
  const registrationUrl = origin ? `${origin}/registro` : null;
  if (!registrationUrl) {
    // Sin valores de encabezados en el registro: solo el hecho.
    console.error("No se pudo determinar el origen del QR");
  }

  return (
    // Todo el bloque (logo, título, tarjeta y logos aliados) va centrado en la ventana: el espacio
    // sobrante queda arriba y abajo, nunca entre la tarjeta y los logos aliados.
    <div className="flex min-h-dvh flex-col justify-center">
      <header className="flex justify-center px-4 pt-6 pb-3">
        <Logo size={72} />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4">
        <h1 className="text-center font-display text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          Regístrate y participa en el sorteo
        </h1>
        <p className="mt-2 mb-6 text-center text-base text-ink-600 md:text-lg">
          Escanea el código QR y completa tus datos para ingresar al sorteo.
        </p>
        <LiveRegistrationPanel
          initial={status}
          qr={
            registrationUrl ? (
              // El alto de la pantalla limita el QR para que todo quepa sin desplazarse (28 rem ≈
              // lo que ocupa todo lo que no es el QR); nunca baja de 16 rem para seguir legible.
              <QrCode
                url={registrationUrl}
                className="mx-auto h-auto w-full max-w-[min(100%,max(16rem,calc(100dvh-28rem)))]"
              />
            ) : (
              <Alert variant="info">No pudimos generar el código QR. Recarga la página.</Alert>
            )
          }
        />
      </main>
      <PartnerLogos />
    </div>
  );
}
