import { DrawStage } from "@/components/admin/DrawStage";
import { requireAdmin } from "@/services/admin-auth.service";
import { listPrizes } from "@/services/prizes.service";
import { getRegistrationStatus } from "@/services/registration-status.service";
import { listWheelParticipants } from "@/services/spins.service";

// Premios y participantes cambian con cada giro: nunca se sirven desde caché.
export const dynamic = "force-dynamic";

/**
 * /admin/sorteo — solo la ruleta, lista para proyectar. Los premios y el historial de ganadores
 * viven en /admin/premios.
 */
export default async function DrawPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const [prizes, participants, registration] = await Promise.all([
    listPrizes(),
    listWheelParticipants(),
    getRegistrationStatus(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold text-ink-900">Sorteo</h1>
      <DrawStage prizes={prizes} participants={participants} registrationOpen={registration.open} />
    </div>
  );
}
