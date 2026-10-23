import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { registrationSchema } from "@/lib/validation/schemas";
import {
  AlreadyRegisteredError,
  RegistrationClosedError,
  registerParticipant,
} from "@/services/participants.service";

/**
 * POST /api/registrations — registra un participante (contracts/http-api.md). No exige ninguna
 * verificación anti-automatización: por decisión de la empresa el registro queda abierto
 * (constitución III, riesgo aceptado).
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

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Revisa los campos marcados.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    await registerParticipant(parsed.data);
    return Response.json({ status: "registered" }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationClosedError) {
      return errorResponse("REGISTRATION_CLOSED", 403, "Las inscripciones están cerradas.");
    }
    if (error instanceof AlreadyRegisteredError) {
      return errorResponse("ALREADY_REGISTERED", 409, "Este celular ya está participando.");
    }
    // Sin datos personales en los logs: solo el tipo de error.
    console.error(
      "Error al registrar un participante:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse("INTERNAL_ERROR", 500, "Ocurrió un error inesperado. Inténtalo de nuevo.");
  }
}
