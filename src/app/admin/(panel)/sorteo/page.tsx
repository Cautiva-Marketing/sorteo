import { DrawStage } from "@/components/admin/DrawStage";
import { requireAdmin } from "@/services/admin-auth.service";
import { listPrizes } from "@/services/prizes.service";
import { listWheelParticipants, listWinnerRecords } from "@/services/spins.service";

// Premios y participantes cambian con cada giro: nunca se sirven desde caché.
export const dynamic = "force-dynamic";

/**
 * /admin/sorteo — la ruleta lista para proyectar, con el premio en juego y los ganadores del
 * evento al lado. La configuración de premios y el historial completo viven en sus propias pantallas.
 */
export default async function DrawPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const [prizes, participants, records] = await Promise.all([
    listPrizes(),
    listWheelParticipants(),
    listWinnerRecords(),
  ]);

  return (
    <DrawStage
      prizes={prizes}
      participants={participants}
      winners={records.filter((record) => record.status === "active")}
    />
  );
}
