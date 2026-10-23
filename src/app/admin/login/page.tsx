import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Acceso de administración",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { expirada } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col bg-paper-soft">
      <header className="flex justify-center px-4 pt-10 pb-4">
        <Logo size={52} />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        <div className="rounded-3xl border border-line bg-paper p-6">
          <h1 className="mb-6 font-display text-2xl font-extrabold text-ink-900">
            Acceso de administración
          </h1>
          <LoginForm sessionExpired={expirada === "1"} />
        </div>
      </main>
    </div>
  );
}
