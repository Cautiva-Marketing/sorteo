import { assertSameOrigin, errorResponse, zodToFieldErrors } from "@/lib/http";
import { sessionRequestSchema } from "@/lib/validation/schemas";
import { AdminAuthError, clearSession, createSession } from "@/services/admin-auth.service";

/** POST /api/admin/session — inicia sesión con un ID token de Firebase Auth (contracts/http-api.md). */
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
  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      400,
      "Los datos enviados no son válidos.",
      zodToFieldErrors(parsed.error),
    );
  }

  try {
    const setCookie = await createSession(parsed.data.idToken);
    return new Response(null, { status: 204, headers: { "Set-Cookie": setCookie } });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return errorResponse(error.code, error.code === "FORBIDDEN" ? 403 : 401, error.message);
    }
    throw error;
  }
}

/** DELETE /api/admin/session — cierra la sesión expirando la cookie. */
export async function DELETE(request: Request): Promise<Response> {
  const originError = assertSameOrigin(request);
  if (originError) {
    return originError;
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSession() } });
}
