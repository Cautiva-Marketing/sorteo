import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/ui/Logo";
import { requireAdmin } from "@/services/admin-auth.service";
import { countParticipants, listPrizes, listWinnerRecords } from "./data";

export const metadata: Metadata = {
  title: "Panel de administración",
  robots: { index: false, follow: false },
};

// Sesión y datos se leen en cada petición.
export const dynamic = "force-dynamic";

/**
 * Layout del panel: exige sesión de administrador en el servidor antes de renderizar cualquier
 * página hija y dibuja la barra lateral con los contadores de cada sección. `/admin/login` queda
 * fuera de este grupo para evitar un bucle de redirección.
 */
export default async function PanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAdmin();
  const [participants, prizes, records] = await Promise.all([
    countParticipants(),
    listPrizes(),
    listWinnerRecords(),
  ]);

  const counts = {
    participants,
    prizesDone: prizes.filter((prize) => prize.exhausted).length,
    prizesTotal: prizes.length,
    winners: records.filter((record) => record.status === "active").length,
  };

  return (
    <div className="min-h-dvh bg-paper-soft lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 border-b border-line bg-paper px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:gap-6 lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <div className="flex justify-center lg:px-2 lg:py-2">
          <Logo size={44} />
        </div>
        <AdminNav counts={counts} />
      </aside>
      <main className="min-w-0 px-4 py-6 lg:px-6">{children}</main>
    </div>
  );
}
