import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { registrationStatusSchema } from "@/lib/validation/schemas";
import { requireAdminApi } from "@/services/admin-auth.service";
import { invalidatePublicStatus } from "@/services/public-status.service";
import { setRegistrationOpen } from "@/services/registration-status.service";

/** PUT /api/admin/registration — abre o cierra las inscripciones (FR-029). */
export async function PUT(request: Request): Promise<Response> {
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
  const parsed = registrationStatusSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  const status = await setRegistrationOpen(parsed.data.open, admin.uid);
  // La pantalla pública del QR debe reflejar el cambio de inmediato.
  invalidatePublicStatus();
  return Response.json({
    open: status.open,
    updatedAt: (status.updatedAt ?? new Date()).toISOString(),
  });
}
