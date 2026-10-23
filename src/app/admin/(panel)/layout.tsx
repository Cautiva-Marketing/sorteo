import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/ui/Logo";
import { requireAdmin } from "@/services/admin-auth.service";

export const metadata: Metadata = {
  title: "Panel de administración",
  robots: { index: false, follow: false },
};

// Sesión y datos se leen en cada petición.
export const dynamic = "force-dynamic";

/**
 * Layout del panel: exige sesión de administrador en el servidor antes de renderizar cualquier
 * página hija. `/admin/login` queda fuera de este grupo para evitar un bucle de redirección.
 */
export default async function PanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-paper px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <Logo />
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
