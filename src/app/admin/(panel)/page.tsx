import { ParticipantsTable } from "@/components/admin/ParticipantsTable";
import { requireAdmin } from "@/services/admin-auth.service";
import { countParticipants, listParticipants } from "@/services/participants.service";

/** /admin — conteo total y listado de participantes con búsqueda y paginación (FR-016, FR-017). */
export default async function ParticipantsPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const [rows, total] = await Promise.all([listParticipants(), countParticipants()]);

  return <ParticipantsTable rows={rows} total={total} />;
}
