import { PageHeader } from "@/components/admin/PageHeader";
import { WinnerHistory } from "@/components/admin/WinnerHistory";
import { requireAdmin } from "@/services/admin-auth.service";
import { listWinnerRecords } from "../data";

// El historial cambia con cada giro: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

/** /admin/ganadores — historial de ganadores (FR-082, FR-083). */
export default async function WinnersPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const records = await listWinnerRecords();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Historial de ganadores" subtitle="Lista oficial de premiados." />
      <WinnerHistory records={records} />
    </div>
  );
}
