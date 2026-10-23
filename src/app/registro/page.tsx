import type { Metadata } from "next";
import { BackToHomeLink } from "@/components/registration/BackToHomeLink";
import { ClosedNotice } from "@/components/registration/ClosedNotice";
import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { Logo } from "@/components/ui/Logo";
import { PartnerLogos } from "@/components/ui/PartnerLogos";
import { getRegistrationStatus } from "@/services/registration-status.service";

export const metadata: Metadata = {
  title: "Registro | Sorteo",
};

// El estado de las inscripciones se lee en cada petición para reflejar el cierre de inmediato.
export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const { open } = await getRegistrationStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-center px-4 pt-8 pb-4">
        <Logo size={52} />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
        <h1 className="mb-1 text-center font-display text-3xl font-extrabold tracking-tight text-ink-900">
          Regístrate en el sorteo
        </h1>
        {open ? (
          <>
            <p className="mb-6 text-center text-base text-ink-600">
              Completa tus 3 datos para participar en el sorteo.
            </p>
            <div className="rounded-3xl border border-line bg-paper p-6">
              <RegistrationForm />
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <ClosedNotice />
            <BackToHomeLink />
          </div>
        )}
      </main>
      <PartnerLogos />
    </div>
  );
}
