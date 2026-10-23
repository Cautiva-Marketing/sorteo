import { assertSameOrigin, errorResponse } from "@/lib/http";
import { requireAdminApi } from "@/services/admin-auth.service";
import { NoEligibleError, practiceSpin } from "@/services/spins.service";

// Listar los elegibles puede tardar con muchos participantes.
export const maxDuration = 60;

/**
 * POST /api/admin/spins/practice — giro de práctica (FR-090). No escribe nada: ni ganador, ni
 * número, ni cambios en premios, participantes o inscripciones.
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

  try {
    return Response.json(await practiceSpin());
  } catch (error) {
    if (error instanceof NoEligibleError) {
      return errorResponse("NO_ELIGIBLE", 409, error.message);
    }
    // Sin datos personales en los logs: solo el tipo de error.
    console.error(
      "Error en el giro de práctica:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse(
      "INTERNAL_ERROR",
      500,
      "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
    );
  }
}
