import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { prizeSchema } from "@/lib/validation/schemas";
import { requireAdminApi } from "@/services/admin-auth.service";
import { createPrize, DuplicatePrizeNameError } from "@/services/prizes.service";

/** POST /api/admin/prizes — crea un premio (FR-060). */
export async function POST(request: Request): Promise<Response> {
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
  const parsed = prizeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    const prize = await createPrize(parsed.data, admin.uid);
    return Response.json(prize, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicatePrizeNameError) {
      return errorResponse("VALIDATION_ERROR", 400, error.message, { name: [error.message] });
    }
    console.error("Error al crear el premio:", error instanceof Error ? error.name : "desconocido");
    return errorResponse(
      "INTERNAL_ERROR",
      500,
      "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
    );
  }
}
