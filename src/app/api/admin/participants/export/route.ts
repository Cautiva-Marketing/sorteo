import { toCsv } from "@/lib/csv";
import { formatLimaDateTime } from "@/lib/format";
import { peruNational } from "@/lib/validation/phone";
import { requireAdminApi } from "@/services/admin-auth.service";
import { listParticipants } from "@/services/participants.service";
import { getWinnerLookup } from "@/services/spins.service";

// Con miles de participantes la lectura y la serialización pueden tardar unos segundos.
export const maxDuration = 60;

/** Fecha de hoy en Lima como `AAAAMMDD`. */
function limaDateStamp(date: Date): string {
  return formatLimaDateTime(date).slice(0, 10).replaceAll("-", "");
}

/**
 * GET /api/admin/participants/export — descarga el CSV con la lista completa y, de quienes ganaron, premio, número y estado (FR-018, FR-084). No usa
 * `assertSameOrigin` porque se invoca por navegación (enlace de descarga), pero exige sesión.
 */
export async function GET(request: Request): Promise<Response> {
  const admin = await requireAdminApi(request);
  if (admin instanceof Response) {
    return admin;
  }

  const [participants, lookup] = await Promise.all([listParticipants(), getWinnerLookup()]);
  const rows = participants.map((participant) => {
    // Un giro se resuelve por `drawId`; una ronda antigua, por el celular de 9 dígitos (solo Perú).
    const legacyPhone = peruNational(participant.phone);
    const info =
      (participant.drawId === null ? undefined : lookup.bySpinId.get(participant.drawId)) ??
      (legacyPhone === null ? undefined : lookup.byLegacyPhone.get(legacyPhone));
    return info
      ? {
          ...participant,
          prizeName: info.prizeName,
          winnerNumber: info.number,
          winnerStatus: info.status,
        }
      : participant;
  });
  return new Response(toCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participantes-${limaDateStamp(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
