import { PageHeader } from "@/components/admin/PageHeader";
import { PrizePanel } from "@/components/admin/PrizePanel";
import { requireAdmin } from "@/services/admin-auth.service";
import { listPrizes } from "../data";

// Los premios cambian con cada giro: nunca se sirven desde caché.
export const dynamic = "force-dynamic";

/** /admin/premios — configuración de premios (FR-060 a FR-063). El historial vive en /admin/ganadores. */
export default async function PrizesPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const prizes = await listPrizes();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Premios" subtitle="Configura los premios y el orden en que se sortean." />
      <PrizePanel prizes={prizes} />
    </div>
  );
}
