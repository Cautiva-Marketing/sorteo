import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { prizeOrderSchema } from "@/lib/validation/schemas";
import { requireAdminApi } from "@/services/admin-auth.service";
import { PrizeOrderMismatchError, reorderPrizes } from "@/services/prizes.service";

/** PUT /api/admin/prizes/order — reordena la lista completa de premios (FR-063). */
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
  const parsed = prizeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    await reorderPrizes(parsed.data.ids);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof PrizeOrderMismatchError) {
      return errorResponse("VALIDATION_ERROR", 400, error.message, { ids: [error.message] });
    }
    console.error(
      "Error al reordenar los premios:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse(
      "INTERNAL_ERROR",
      500,
      "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
    );
  }
}
