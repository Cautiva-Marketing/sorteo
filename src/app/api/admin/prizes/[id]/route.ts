import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { prizeSchema } from "@/lib/validation/schemas";
import { requireAdminApi } from "@/services/admin-auth.service";
import {
  deletePrize,
  DuplicatePrizeNameError,
  PrizeHasHistoryError,
  PrizeNotFoundError,
  QuantityBelowDeliveredError,
  updatePrize,
} from "@/services/prizes.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function internalError(action: string, error: unknown): Response {
  // Sin datos personales en los logs: solo el tipo de error.
  console.error(
    `Error al ${action} el premio:`,
    error instanceof Error ? error.name : "desconocido",
  );
  return errorResponse(
    "INTERNAL_ERROR",
    500,
    "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
  );
}

/** PUT /api/admin/prizes/{id} — edita nombre y cantidad (FR-060, FR-061). */
export async function PUT(request: Request, { params }: RouteContext): Promise<Response> {
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

  const { id } = await params;
  try {
    return Response.json(await updatePrize(id, parsed.data));
  } catch (error) {
    if (error instanceof DuplicatePrizeNameError) {
      return errorResponse("VALIDATION_ERROR", 400, error.message, { name: [error.message] });
    }
    if (error instanceof QuantityBelowDeliveredError) {
      return errorResponse("VALIDATION_ERROR", 400, error.message, { quantity: [error.message] });
    }
    if (error instanceof PrizeNotFoundError) {
      return errorResponse("NOT_FOUND", 404, error.message);
    }
    return internalError("editar", error);
  }
}

/** DELETE /api/admin/prizes/{id} — elimina un premio sin historial (FR-061). */
export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
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
    await deletePrize(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof PrizeNotFoundError) {
      return errorResponse("NOT_FOUND", 404, error.message);
    }
    if (error instanceof PrizeHasHistoryError) {
      return errorResponse("PRIZE_HAS_HISTORY", 409, error.message);
    }
    return internalError("eliminar", error);
  }
}
