import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_COOKIE_NAME,
  clearAuthUsers,
  createSessionCookieValue,
  createUserIdToken,
  sessionCookieHeader,
} from "./helpers";
import { DELETE, POST } from "@/app/api/admin/session/route";
import { requireAdmin, requireAdminApi } from "@/services/admin-auth.service";

// `requireAdmin()` lee la cookie con `cookies()`, que solo existe dentro de una petición de Next:
// se simula únicamente el almacén de cookies; la verificación real corre contra el emulador de Auth.
const currentCookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "admin_session" && currentCookie.value !== undefined
        ? { name, value: currentCookie.value }
        : undefined,
  }),
}));

// La primera llamada a Firestore/Auth del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

function sessionRequest(
  method: "POST" | "DELETE",
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost:3000/api/admin/session", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function apiRequest(cookie?: string): Request {
  return new Request("http://localhost:3000/api/admin/anything", {
    headers: cookie === undefined ? {} : { cookie },
  });
}

/** Valor de la cookie `admin_session` del encabezado `Set-Cookie`. */
function cookieValueFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = new RegExp(`${ADMIN_COOKIE_NAME}=([^;]*)`).exec(header);
  return match?.[1] ?? "";
}

async function redirectTarget(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
  } catch (error) {
    const digest = error instanceof Error && "digest" in error ? String(error.digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) {
      return digest.split(";")[2] ?? null;
    }
    throw error;
  }
  return null;
}

beforeAll(async () => {
  await clearAuthUsers();
});

beforeEach(() => {
  currentCookie.value = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/admin/session", () => {
  it("204: con ID token de un usuario con claim admin crea la cookie httpOnly y SameSite=Strict", async () => {
    const idToken = await createUserIdToken("admin@example.com", { admin: true });

    const response = await POST(sessionRequest("POST", { idToken }));

    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^admin_session=[^;]+/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=28800/);
    // Contra el emulador (http local) la cookie no es Secure para que funcione en localhost.
    expect(setCookie).not.toMatch(/Secure/i);

    // La cookie emitida sirve para autenticarse en los endpoints de administración.
    const identity = await requireAdminApi(
      apiRequest(sessionCookieHeader(cookieValueFrom(response))),
    );
    expect(identity).toMatchObject({ email: "admin@example.com" });
  });

  it("403 FORBIDDEN: usuario sin claim admin", async () => {
    const idToken = await createUserIdToken("normal@example.com", { admin: false });

    const response = await POST(sessionRequest("POST", { idToken }));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("401 UNAUTHORIZED: ID token inválido", async () => {
    const response = await POST(sessionRequest("POST", { idToken: "no-es-un-token" }));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("401 UNAUTHORIZED: ID token con más de 5 minutos desde el inicio de sesión", async () => {
    const idToken = await createUserIdToken("admin@example.com", { admin: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * 60 * 1000);

    const response = await POST(sessionRequest("POST", { idToken }));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
  });

  it("400 VALIDATION_ERROR: cuerpo sin idToken o que no es JSON", async () => {
    const missing = await POST(sessionRequest("POST", {}));
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe("VALIDATION_ERROR");

    const notJson = await POST(
      new Request("http://localhost:3000/api/admin/session", { method: "POST", body: "x" }),
    );
    expect(notJson.status).toBe(400);
  });

  it("403 FORBIDDEN: un encabezado Origin ajeno se rechaza antes de mirar el token", async () => {
    const idToken = await createUserIdToken("admin@example.com", { admin: true });

    const response = await POST(
      sessionRequest("POST", { idToken }, { Origin: "https://otro.example" }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("DELETE /api/admin/session", () => {
  it("204: expira la cookie de sesión", async () => {
    const response = await DELETE(sessionRequest("DELETE"));

    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^admin_session=;/);
    expect(setCookie).toMatch(/Max-Age=0/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\//);
  });

  it("403 FORBIDDEN: un encabezado Origin ajeno se rechaza", async () => {
    const response = await DELETE(
      sessionRequest("DELETE", undefined, { Origin: "https://otro.example" }),
    );
    expect(response.status).toBe(403);
  });
});

describe("requireAdminApi", () => {
  it("devuelve uid y correo con una cookie de sesión de administrador", async () => {
    const cookie = await createSessionCookieValue("admin@example.com", { admin: true });

    const result = await requireAdminApi(apiRequest(sessionCookieHeader(cookie)));

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({ email: "admin@example.com" });
  });

  it("401 UNAUTHORIZED: sin cookie o con otras cookies", async () => {
    for (const request of [apiRequest(), apiRequest("otra=1; tema=oscuro")]) {
      const result = await requireAdminApi(request);
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("UNAUTHORIZED");
    }
  });

  it("401 UNAUTHORIZED: cookie manipulada", async () => {
    const valid = await createSessionCookieValue("admin@example.com", { admin: true });
    const tampered = [`${valid}x`, valid.slice(0, -8), "abc.def.ghi", "basura"];

    for (const value of tampered) {
      const result = await requireAdminApi(apiRequest(sessionCookieHeader(value)));
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    }
  });

  it("403 FORBIDDEN: cookie válida de un usuario sin claim admin", async () => {
    const cookie = await createSessionCookieValue("normal@example.com", { admin: false });

    const result = await requireAdminApi(apiRequest(sessionCookieHeader(cookie)));

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN");
  });
});

describe("requireAdmin (páginas)", () => {
  it("devuelve la identidad con una cookie de administrador", async () => {
    currentCookie.value = await createSessionCookieValue("admin@example.com", { admin: true });

    await expect(requireAdmin()).resolves.toMatchObject({ email: "admin@example.com" });
  });

  it("redirige a /admin/login si falta la cookie", async () => {
    expect(await redirectTarget(requireAdmin)).toBe("/admin/login");
  });

  it("redirige a /admin/login con una cookie manipulada", async () => {
    currentCookie.value = "cookie.manipulada.falsa";
    expect(await redirectTarget(requireAdmin)).toBe("/admin/login");
  });

  it("redirige a /admin/login con una cookie válida sin claim admin", async () => {
    currentCookie.value = await createSessionCookieValue("normal@example.com", { admin: false });
    expect(await redirectTarget(requireAdmin)).toBe("/admin/login");
  });
});
