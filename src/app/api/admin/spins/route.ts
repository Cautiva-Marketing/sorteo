import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { spinRequestSchema } from "@/lib/validation/schemas";
import { requireAdminApi } from "@/services/admin-auth.service";
import { invalidatePublicStatus } from "@/services/public-status.service";
import {
  DrawConflictError,
  NoEligibleError,
  PrizeExhaustedError,
  PrizeNotFoundError,
  spin,
} from "@/services/spins.service";

// Listar los elegibles y escribir la transacción puede tardar con muchos participantes.
export const maxDuration = 60;

/**
 * POST /api/admin/spins — gira la ruleta por un premio (FR-064, FR-065, FR-072, FR-106). El
 * ganador queda guardado antes de responder; la respuesta no incluye celular ni empresa.
 */
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
  const parsed = spinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    const result = await spin(parsed.data, admin);
    // El primer giro real pudo cerrar las inscripciones: la pantalla del QR debe reflejarlo ya.
    invalidatePublicStatus();
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PrizeNotFoundError) {
      return errorResponse("NOT_FOUND", 404, error.message);
    }
    if (error instanceof PrizeExhaustedError) {
      return errorResponse("PRIZE_EXHAUSTED", 409, error.message);
    }
    if (error instanceof NoEligibleError) {
      return errorResponse("NO_ELIGIBLE", 409, error.message);
    }
    if (error instanceof DrawConflictError) {
      return errorResponse("DRAW_CONFLICT", 409, error.message);
    }
    // Sin datos personales en los logs: solo el tipo de error.
    console.error("Error al girar la ruleta:", error instanceof Error ? error.name : "desconocido");
    return errorResponse(
      "INTERNAL_ERROR",
      500,
      "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
    );
  }
}
