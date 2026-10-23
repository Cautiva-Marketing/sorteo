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
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-center border-b border-line bg-paper px-4 py-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <h1 className="mb-6 font-display text-2xl font-bold text-ink-900">
          Acceso de administración
        </h1>
        <LoginForm sessionExpired={expirada === "1"} />
      </main>
    </div>
  );
}
