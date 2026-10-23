import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { purgeRequestSchema } from "@/lib/validation/schemas";
import { requireAdminApi } from "@/services/admin-auth.service";
import { purgeAllParticipantData, RegistrationOpenError } from "@/services/participants.service";
import { invalidatePublicStatus } from "@/services/public-status.service";

// Borrar miles de documentos por lotes puede tardar unos segundos.
export const maxDuration = 60;

/**
 * DELETE /api/admin/participants — borrado definitivo de los datos personales de la campaña
 * (FR-030, FR-031). Solo con las inscripciones cerradas; reintentable.
 */
export async function DELETE(request: Request): Promise<Response> {
  const originError = assertSameOrigin(request);
  if (originError) {
    return originError;
  }

  const admin = await requireAdminApi(request);
  if (admin instanceof Response) {
    return admin;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", 400, "Los datos enviados no son válidos.");
  }
  const parsed = purgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    const deletedParticipants = await purgeAllParticipantData(admin.uid);
    // El contador público debe volver a 0 de inmediato.
    invalidatePublicStatus();
    return Response.json({ deletedParticipants });
  } catch (error) {
    if (error instanceof RegistrationOpenError) {
      return errorResponse("REGISTRATION_OPEN", 409, error.message);
    }
    // Sin datos personales en los logs: solo el tipo de error.
    console.error(
      "Error al borrar los datos de la campaña:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse(
      "INTERNAL_ERROR",
      500,
      "No pudimos completar el borrado. Vuelve a intentarlo: la operación se puede repetir.",
    );
  }
}
