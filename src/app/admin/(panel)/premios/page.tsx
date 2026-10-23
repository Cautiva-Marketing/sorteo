import { PrizePanel } from "@/components/admin/PrizePanel";
import { WinnerHistory } from "@/components/admin/WinnerHistory";
import { requireAdmin } from "@/services/admin-auth.service";
import { listPrizes } from "@/services/prizes.service";
import { listWinnerRecords } from "@/services/spins.service";

// Premios e historial cambian con cada giro: nunca se sirven desde caché.
export const dynamic = "force-dynamic";

/** /admin/premios — configuración de premios e historial de ganadores (FR-060 a FR-063, FR-080+). */
export default async function PrizesPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const [prizes, records] = await Promise.all([listPrizes(), listWinnerRecords()]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold text-ink-900">Premios</h1>
      <PrizePanel prizes={prizes} />
      <WinnerHistory records={records} />
    </div>
  );
}
