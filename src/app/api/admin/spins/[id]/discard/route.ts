import { assertSameOrigin, errorResponse } from "@/lib/http";
import { requireAdminApi } from "@/services/admin-auth.service";
import { discardSpin, SpinNotActiveError, SpinNotFoundError } from "@/services/spins.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/spins/{id}/discard — descarta a un ganador ausente (FR-078): queda en el
 * historial como «descartado», la unidad vuelve al premio y la persona no vuelve a la ruleta.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const originError = assertSameOrigin(request);
  if (originError) {
    return originError;
  }

  const admin = await requireAdminApi(request);
  if (admin instanceof Response) {
    return admin;
  }

  const { id } = await params;
  try {
    const result = await discardSpin(id, admin);
    return Response.json({ ...result, discardedAt: result.discardedAt.toISOString() });
  } catch (error) {
    if (error instanceof SpinNotFoundError) {
      return errorResponse("NOT_FOUND", 404, error.message);
    }
    if (error instanceof SpinNotActiveError) {
      return errorResponse("SPIN_NOT_ACTIVE", 409, error.message);
    }
    // Sin datos personales en los logs: solo el tipo de error.
    console.error(
      "Error al descartar el giro:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse(
      "INTERNAL_ERROR",
      500,
      "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
    );
  }
}
