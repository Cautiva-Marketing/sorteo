import type { ZodError } from "zod";
import type { ApiError, ApiErrorCode, FieldErrors } from "@/types";

/** Respuesta de error con el formato común de la API (contracts/http-api.md). */
export function errorResponse(
  code: ApiErrorCode,
  status: number,
  message: string,
  fieldErrors?: FieldErrors,
): Response {
  const body: ApiError = fieldErrors ? { code, message, fieldErrors } : { code, message };
  return Response.json(body, { status });
}

/** Agrupa los mensajes de un error de Zod por nombre de campo (ruta separada por puntos). */
export function zodToFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    const messages = fieldErrors[key] ?? [];
    messages.push(issue.message);
    fieldErrors[key] = messages;
  }
  return fieldErrors;
}

/**
 * Defensa adicional contra CSRF en los métodos que modifican datos: el encabezado `Origin`
 * debe corresponder al host de la petición. Devuelve `null` si es válido o la respuesta
 * `403 FORBIDDEN` si no coincide.
 *
 * Los navegadores siempre envían `Origin` en peticiones POST/PUT/DELETE; si falta, la petición no
 * proviene de un navegador (no es CSRF) y se deja pasar. En el panel protege la sesión; el registro
 * público no tiene verificación anti-automatización por decisión de la empresa (constitución III).
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return null;
  }
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let originHost: string | null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (originHost === host) {
    return null;
  }
  return errorResponse("FORBIDDEN", 403, "Solicitud no permitida desde este origen.");
}
