import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { errorResponse } from "@/lib/http";
import { getAdminAuth } from "@/services/firebase/admin";
import type { AdminIdentity } from "@/types";

/** Nombre de la cookie de sesión del panel. */
export const SESSION_COOKIE_NAME = "admin_session";

/** Duración de la sesión: 8 horas. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** El ID token debe provenir de un inicio de sesión de hace 5 minutos o menos. */
const MAX_AUTH_AGE_SECONDS = 5 * 60;

const LOGIN_PATH = "/admin/login";

/** Error de autenticación/autorización con el código HTTP de la API (401 o 403). */
export class AdminAuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
  }
}

/**
 * La cookie solo es `Secure` fuera de los emuladores: contra el emulador de Auth se trabaja por
 * `http://localhost`, donde el navegador descartaría una cookie `Secure`.
 */
function isSecureCookie(): boolean {
  return !process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

function serializeCookie(value: string, maxAgeSeconds: number): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (isSecureCookie()) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

/**
 * Verifica el ID token que envía el login y crea la cookie de sesión de 8 horas. Devuelve el valor
 * del encabezado `Set-Cookie`. Falla con `AdminAuthError`: 401 si el token es inválido o el inicio
 * de sesión no es reciente, 403 si la cuenta no tiene el claim `admin === true`.
 */
export async function createSession(idToken: string): Promise<string> {
  const auth = getAdminAuth();

  let decoded: Awaited<ReturnType<typeof auth.verifyIdToken>>;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    throw new AdminAuthError("UNAUTHORIZED", "La sesión no es válida. Inicia sesión de nuevo.");
  }
  if (decoded.admin !== true) {
    throw new AdminAuthError("FORBIDDEN", "No tienes permisos de administrador.");
  }
  if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
    throw new AdminAuthError(
      "UNAUTHORIZED",
      "El inicio de sesión es antiguo. Vuelve a intentarlo.",
    );
  }

  let sessionCookie: string;
  try {
    sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
  } catch {
    throw new AdminAuthError("UNAUTHORIZED", "La sesión no es válida. Inicia sesión de nuevo.");
  }
  return serializeCookie(sessionCookie, SESSION_MAX_AGE_SECONDS);
}

/** Valor del encabezado `Set-Cookie` que expira la cookie de sesión. */
export function clearSession(): string {
  return serializeCookie("", 0);
}

type CookieCheck =
  { status: "ok"; identity: AdminIdentity } | { status: "unauthorized" } | { status: "forbidden" };

/** Verifica la cookie de sesión (con revocación) y el claim `admin`. */
async function checkSessionCookie(cookie: string | undefined): Promise<CookieCheck> {
  if (!cookie) {
    return { status: "unauthorized" };
  }
  const auth = getAdminAuth();
  let decoded: Awaited<ReturnType<typeof auth.verifySessionCookie>>;
  try {
    decoded = await auth.verifySessionCookie(cookie, true);
  } catch {
    return { status: "unauthorized" };
  }
  if (decoded.admin !== true) {
    return { status: "forbidden" };
  }
  return { status: "ok", identity: { uid: decoded.uid, email: decoded.email ?? "" } };
}

/**
 * Para páginas y layouts del panel: exige una sesión de administrador o redirige a
 * `/admin/login`. Debe llamarse en el servidor antes de leer cualquier dato.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const cookieStore = await cookies();
  const result = await checkSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (result.status !== "ok") {
    redirect(LOGIN_PATH);
  }
  return result.identity;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator !== -1 && pair.slice(0, separator).trim() === name) {
      return pair.slice(separator + 1).trim();
    }
  }
  return undefined;
}

/**
 * Para Route Handlers: devuelve la identidad del administrador o la `Response` de error
 * (401 `UNAUTHORIZED` sin sesión válida, 403 `FORBIDDEN` sin el claim `admin`).
 */
export async function requireAdminApi(request: Request): Promise<AdminIdentity | Response> {
  const result = await checkSessionCookie(readCookie(request, SESSION_COOKIE_NAME));
  if (result.status === "unauthorized") {
    return errorResponse("UNAUTHORIZED", 401, "Inicia sesión para continuar.");
  }
  if (result.status === "forbidden") {
    return errorResponse("FORBIDDEN", 403, "No tienes permisos de administrador.");
  }
  return result.identity;
}
