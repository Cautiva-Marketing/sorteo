import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { clearAuthUsers, createSessionCookieValue, sessionCookieHeader } from "./helpers";
import { DELETE as prizeDelete, PUT as prizePut } from "@/app/api/admin/prizes/[id]/route";
import { PUT as prizeOrderPut } from "@/app/api/admin/prizes/order/route";
import { POST as prizesPost } from "@/app/api/admin/prizes/route";
import { DELETE as participantsDelete } from "@/app/api/admin/participants/route";
import { GET as exportGet } from "@/app/api/admin/participants/export/route";
import { POST as discardPost } from "@/app/api/admin/spins/[id]/discard/route";
import { POST as practicePost } from "@/app/api/admin/spins/practice/route";
import { POST as spinsPost } from "@/app/api/admin/spins/route";
import { PUT as registrationPut } from "@/app/api/admin/registration/route";

// La primera llamada a Auth del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

interface AdminRoute {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  handler: (request: Request) => Promise<Response>;
  /** Modifica datos: debe rechazar un `Origin` ajeno. */
  mutates: boolean;
}

// SC-005: todas las rutas de /api/admin/* (excepto la sesión, que se prueba en admin-auth.test.ts)
// rechazan a quien no sea administrador y, si modifican datos, las peticiones de otro origen.
const ROUTES: AdminRoute[] = [
  {
    name: "PUT /api/admin/registration",
    method: "PUT",
    path: "/api/admin/registration",
    body: { open: false },
    handler: registrationPut,
    mutates: true,
  },
  {
    name: "POST /api/admin/prizes",
    method: "POST",
    path: "/api/admin/prizes",
    body: { name: "Alexa", quantity: 1 },
    handler: prizesPost,
    mutates: true,
  },
  {
    name: "PUT /api/admin/prizes/{id}",
    method: "PUT",
    path: "/api/admin/prizes/x",
    body: { name: "Alexa", quantity: 1 },
    handler: (request) => prizePut(request, { params: Promise.resolve({ id: "x" }) }),
    mutates: true,
  },
  {
    name: "DELETE /api/admin/prizes/{id}",
    method: "DELETE",
    path: "/api/admin/prizes/x",
    handler: (request) => prizeDelete(request, { params: Promise.resolve({ id: "x" }) }),
    mutates: true,
  },
  {
    name: "PUT /api/admin/prizes/order",
    method: "PUT",
    path: "/api/admin/prizes/order",
    body: { ids: ["x"] },
    handler: prizeOrderPut,
    mutates: true,
  },
  {
    name: "POST /api/admin/spins",
    method: "POST",
    path: "/api/admin/spins",
    body: { prizeId: "x" },
    handler: spinsPost,
    mutates: true,
  },
  {
    name: "POST /api/admin/spins/practice",
    method: "POST",
    path: "/api/admin/spins/practice",
    body: {},
    handler: practicePost,
    mutates: true,
  },
  {
    name: "POST /api/admin/spins/{id}/discard",
    method: "POST",
    path: "/api/admin/spins/x/discard",
    handler: (request) => discardPost(request, { params: Promise.resolve({ id: "x" }) }),
    mutates: true,
  },
  {
    name: "GET /api/admin/participants/export",
    method: "GET",
    path: "/api/admin/participants/export",
    handler: exportGet,
    mutates: false,
  },
  {
    name: "DELETE /api/admin/participants",
    method: "DELETE",
    path: "/api/admin/participants",
    body: { confirm: "BORRAR" },
    handler: participantsDelete,
    mutates: true,
  },
];

function buildRequest(route: AdminRoute, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000${route.path}`, {
    method: route.method,
    headers: { "Content-Type": "application/json", ...headers },
    body: route.body === undefined ? undefined : JSON.stringify(route.body),
  });
}

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as { code: string }).code;
}

beforeAll(async () => {
  await clearAuthUsers();
});

describe.each(ROUTES)("$name", (route) => {
  it("sin cookie responde 401 UNAUTHORIZED", async () => {
    const response = await route.handler(buildRequest(route));

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("UNAUTHORIZED");
  });

  it("con una cookie inválida responde 401 UNAUTHORIZED", async () => {
    const response = await route.handler(
      buildRequest(route, { cookie: sessionCookieHeader("no-es-una-sesion") }),
    );

    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("UNAUTHORIZED");
  });

  it("con la cookie de un usuario sin claim admin responde 403 FORBIDDEN", async () => {
    const cookie = await createSessionCookieValue("normal-routes@example.com", { admin: false });

    const response = await route.handler(
      buildRequest(route, { cookie: sessionCookieHeader(cookie) }),
    );

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("FORBIDDEN");
  });

  if (route.mutates) {
    it("con un encabezado Origin ajeno responde 403 FORBIDDEN, incluso con sesión admin", async () => {
      const cookie = await createSessionCookieValue("admin-routes@example.com", { admin: true });

      const response = await route.handler(
        buildRequest(route, {
          cookie: sessionCookieHeader(cookie),
          origin: "https://sitio-malicioso.example",
        }),
      );

      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("FORBIDDEN");
    });
  }
});

describe("POST /api/admin/draws (eliminada en la feature 003)", () => {
  it("ya no existe la ruta del sorteo de N ganadores", () => {
    expect(existsSync(path.resolve(import.meta.dirname, "../../src/app/api/admin/draws"))).toBe(
      false,
    );
  });
});
