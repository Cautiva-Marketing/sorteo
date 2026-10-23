import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthUsers,
  clearFirestore,
  createSessionCookieValue,
  seedParticipants,
  seedPrize,
  seedRegistrationStatus,
  sessionCookieHeader,
  snapshotCollections,
} from "./helpers";
import { POST as discardPost } from "@/app/api/admin/spins/[id]/discard/route";
import { POST as practicePost } from "@/app/api/admin/spins/practice/route";
import { POST as spinPost } from "@/app/api/admin/spins/route";
import { GET as statusGet } from "@/app/api/status/route";

// La primera llamada a Firestore/Auth del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

beforeAll(async () => {
  await clearAuthUsers();
});

beforeEach(async () => {
  await clearFirestore();
  await seedRegistrationStatus(false);
});

async function adminHeaders(): Promise<Record<string, string>> {
  const cookie = await createSessionCookieValue("admin-spins@example.com", { admin: true });
  return { cookie: sessionCookieHeader(cookie) };
}

async function post(
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown,
): Promise<Response> {
  return handler(
    new Request(`http://localhost:3000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await adminHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("POST /api/admin/spins", () => {
  it("201 con el giro y sin celular ni empresa en ninguna parte del JSON", async () => {
    await seedParticipants(6);
    const prizeId = await seedPrize({ name: "Alexa", quantity: 1 });

    const response = await post(spinPost, "/api/admin/spins", { prizeId });

    expect(response.status).toBe(201);
    const text = await response.clone().text();
    expect(text).not.toMatch(/9\d{8}/);
    expect(text).not.toMatch(/phone|company|Empresa/);
    // El interés en el CRM nunca viaja al giro (feature 004, FR-105).
    expect(text).not.toMatch(/crmInterest/i);
    const body = await json(response);
    expect(Object.keys(body).sort()).toEqual([
      "createdAt",
      "id",
      "number",
      "prize",
      "status",
      "winner",
    ]);
    expect(body.number).toBe(1);
    expect(body.status).toBe("active");
    expect(body.prize).toEqual({ id: prizeId, name: "Alexa" });
    expect(Object.keys(body.winner as object).sort()).toEqual(["fullName", "ref"]);
  });

  it("400 con un cuerpo inválido", async () => {
    const response = await post(spinPost, "/api/admin/spins", { prizeId: "" });

    expect(response.status).toBe(400);
    expect((await json(response)).code).toBe("VALIDATION_ERROR");
  });

  it("201 con inscripciones abiertas y sin confirmación; GET /api/status lo refleja de inmediato", async () => {
    await seedRegistrationStatus(true);
    await seedParticipants(4);
    const prizeId = await seedPrize({ quantity: 1 });
    // Calienta la memoria del estado público con las inscripciones abiertas.
    expect(await json(await statusGet())).toMatchObject({ open: true });

    const response = await post(spinPost, "/api/admin/spins", { prizeId });

    expect(response.status).toBe(201);
    expect(await json(await statusGet())).toMatchObject({ open: false });
  });

  it("201 con un cuerpo antiguo que trae confirmCloseRegistration (la clave se ignora)", async () => {
    await seedRegistrationStatus(true);
    await seedParticipants(4);
    const prizeId = await seedPrize({ quantity: 1 });

    const response = await post(spinPost, "/api/admin/spins", {
      prizeId,
      confirmCloseRegistration: true,
    });

    expect(response.status).toBe(201);
  });

  it("409 PRIZE_EXHAUSTED con un premio sin unidades pendientes", async () => {
    await seedParticipants(4);
    const prizeId = await seedPrize({ quantity: 1, delivered: 1, spinCount: 1 });

    const response = await post(spinPost, "/api/admin/spins", { prizeId });

    expect(response.status).toBe(409);
    expect((await json(response)).code).toBe("PRIZE_EXHAUSTED");
  });

  it("409 NO_ELIGIBLE sin participantes elegibles", async () => {
    const prizeId = await seedPrize({ quantity: 1 });

    const response = await post(spinPost, "/api/admin/spins", { prizeId });

    expect(response.status).toBe(409);
    expect((await json(response)).code).toBe("NO_ELIGIBLE");
  });

  it("404 NOT_FOUND con un premio inexistente", async () => {
    await seedParticipants(4);

    const response = await post(spinPost, "/api/admin/spins", { prizeId: "no-existe" });

    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("NOT_FOUND");
  });
});

describe("POST /api/admin/spins/practice", () => {
  it("200 con un ganador y sin escribir nada", async () => {
    await seedParticipants(5);
    await seedPrize({ quantity: 1 });
    const names = ["participants", "prizes", "spins", "settings"];
    const before = await snapshotCollections(names);

    const response = await post(practicePost, "/api/admin/spins/practice", undefined);

    expect(response.status).toBe(200);
    const text = await response.clone().text();
    const body = await json(response);
    expect(body.practice).toBe(true);
    expect(Object.keys(body.winner as object).sort()).toEqual(["fullName", "ref"]);
    expect(text).not.toMatch(/9\d{8}/);
    expect(await snapshotCollections(names)).toEqual(before);
  });

  it("409 NO_ELIGIBLE sin participantes elegibles", async () => {
    const response = await post(practicePost, "/api/admin/spins/practice", {});

    expect(response.status).toBe(409);
    expect((await json(response)).code).toBe("NO_ELIGIBLE");
  });
});

describe("POST /api/admin/spins/{id}/discard", () => {
  async function discard(id: string): Promise<Response> {
    return discardPost(
      new Request(`http://localhost:3000/api/admin/spins/${id}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await adminHeaders()) },
      }),
      { params: Promise.resolve({ id }) },
    );
  }

  it("200 con el giro descartado y 409 SPIN_NOT_ACTIVE al repetir", async () => {
    await seedParticipants(4);
    const prizeId = await seedPrize({ quantity: 1 });
    const spinResponse = await post(spinPost, "/api/admin/spins", { prizeId });
    const spinned = await json(spinResponse);

    const response = await discard(spinned.id as string);

    expect(response.status).toBe(200);
    const body = await json(response);
    expect(Object.keys(body).sort()).toEqual(["discardedAt", "id", "number", "status"]);
    expect(body.id).toBe(spinned.id);
    expect(body.number).toBe(1);
    expect(body.status).toBe("discarded");
    expect(body.discardedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const again = await discard(spinned.id as string);
    expect(again.status).toBe(409);
    expect((await json(again)).code).toBe("SPIN_NOT_ACTIVE");
  });

  it("404 NOT_FOUND con un giro inexistente", async () => {
    const response = await discard("no-existe");

    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("NOT_FOUND");
  });
});
