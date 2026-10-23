import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { registrationCheckSchema } from "@/lib/validation/schemas";
import {
  AlreadyRegisteredError,
  RegistrationClosedError,
  checkRegistrationAvailable,
} from "@/services/participants.service";

/**
 * POST /api/registrations/check — paso 1 del formulario: indica si el celular puede registrarse
 * (contracts/http-api.md). Solo lectura: no crea ni modifica nada. Es informativa; la unicidad la
 * garantiza `POST /api/registrations`. Como el `409` de ese endpoint, revela si un celular ya está
 * registrado, pero no devuelve ningún dato de la persona (riesgo aceptado, plan.md → Complexity
 * Tracking; constitución III no exige protección anti-automatización).
 */
export async function POST(request: Request): Promise<Response> {
  const originError = assertSameOrigin(request);
  if (originError) {
    return originError;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", 400, "Los datos enviados no son válidos.");
  }

  const parsed = registrationCheckSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    await checkRegistrationAvailable(parsed.data.phone);
    return Response.json({ status: "available" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RegistrationClosedError) {
      return errorResponse("REGISTRATION_CLOSED", 403, "Las inscripciones están cerradas.");
    }
    if (error instanceof AlreadyRegisteredError) {
      return errorResponse("ALREADY_REGISTERED", 409, "Este celular ya está participando.");
    }
    // Sin datos personales en los logs: solo el tipo de error.
    console.error(
      "Error al comprobar un celular:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse("INTERNAL_ERROR", 500, "Ocurrió un error inesperado. Inténtalo de nuevo.");
  }
}
