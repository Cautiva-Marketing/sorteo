import type { Metadata } from "next";
import { BackToHomeLink } from "@/components/registration/BackToHomeLink";
import { ClosedNotice } from "@/components/registration/ClosedNotice";
import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { Logo } from "@/components/ui/Logo";
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
      <header className="flex justify-center px-4 py-8">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">
        <h1 className="mb-1 text-center font-display text-3xl font-bold tracking-tight text-ink-900">
          Regístrate en el sorteo
        </h1>
        {open ? (
          <>
            <p className="mb-6 text-center text-base text-ink-600">
              Completa tus 3 datos para participar en el sorteo.
            </p>
            <div className="rounded-2xl border border-line bg-paper p-6">
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
      <footer className="border-t border-line px-4 py-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-ink-600">
          Cautiva Marketing
        </p>
      </footer>
    </div>
  );
}
