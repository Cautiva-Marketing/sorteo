import { headers } from "next/headers";
import Link from "next/link";
import { LiveRegistrationPanel } from "@/components/qr/LiveRegistrationPanel";
import { QrCode } from "@/components/qr/QrCode";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { buildOrigin } from "@/lib/origin";
import { getPublicStatus } from "@/services/public-status.service";

// El estado se lee en cada petición para reflejar el cierre de inmediato.
export const dynamic = "force-dynamic";

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

/**
 * Pantalla del QR (la dirección raíz): para proyectar en el evento. El QR lleva a `/registro`; el
 * contador se actualiza solo y, con las inscripciones cerradas, el QR se reemplaza por el aviso.
 * Nunca muestra el formulario (FR-047).
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
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-center px-4 py-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8">
        <h1 className="text-center font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
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
              <Alert variant="info">
                No pudimos generar el código QR. Usa el botón para registrarte.
              </Alert>
            )
          }
          action={
            <Link href="/registro" className={buttonClassName("primary", "w-full gap-2")}>
              Registrarme desde este dispositivo
              <ExternalLinkIcon />
            </Link>
          }
        />
      </main>
      <footer className="border-t border-line px-4 py-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-ink-600">
          Cautiva Marketing
        </p>
      </footer>
    </div>
  );
}
