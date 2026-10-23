import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthUsers,
  clearFirestore,
  createSessionCookieValue,
  seedLegacyDraw,
  seedParticipants,
  seedPrize,
  seedRegistrationStatus,
  sessionCookieHeader,
} from "./helpers";
import { DELETE } from "@/app/api/admin/participants/route";
import { getDb } from "@/services/firebase/admin";
import { purgeAllParticipantData, RegistrationOpenError } from "@/services/participants.service";
import { discardSpin, NoEligibleError, spin } from "@/services/spins.service";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

const ADMIN = { uid: "admin-uid-1", email: "admin@example.com" };

function purgeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/admin/participants", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function adminHeaders(): Promise<Record<string, string>> {
  const cookie = await createSessionCookieValue("admin-purge@example.com", { admin: true });
  return { cookie: sessionCookieHeader(cookie) };
}

async function participantCount(): Promise<number> {
  return (await getDb().collection("participants").count().get()).data().count;
}

/** Los ganadores de una ronda sembrada reducidos a `{ fullName }`, como los deja el borrado. */
async function reducedWinnersOf(drawId: string): Promise<Array<{ fullName: string }>> {
  const snapshot = await getDb().collection("draws").doc(drawId).get();
  const winners = (snapshot.data()?.winners ?? []) as Array<{ fullName: string }>;
  return winners.map((winner) => ({ fullName: winner.fullName }));
}

async function readDraws() {
  const snapshot = await getDb().collection("draws").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

beforeAll(async () => {
  await clearAuthUsers();
});

beforeEach(async () => {
  await clearFirestore();
});

describe("DELETE /api/admin/participants", () => {
  it("sin sesión responde 401 y no borra nada", async () => {
    await seedParticipants(3);
    await seedRegistrationStatus(false);

    const response = await DELETE(purgeRequest({ confirm: "BORRAR" }));

    expect(response.status).toBe(401);
    expect(await participantCount()).toBe(3);
  });

  it("con una cuenta sin claim admin responde 403", async () => {
    await seedParticipants(3);
    await seedRegistrationStatus(false);
    const cookie = await createSessionCookieValue("normal-purge@example.com", { admin: false });

    const response = await DELETE(
      purgeRequest({ confirm: "BORRAR" }, { cookie: sessionCookieHeader(cookie) }),
    );

    expect(response.status).toBe(403);
    expect(await participantCount()).toBe(3);
  });

  it("con un Origin ajeno responde 403", async () => {
    await seedParticipants(3);
    await seedRegistrationStatus(false);

    const response = await DELETE(
      purgeRequest(
        { confirm: "BORRAR" },
        { ...(await adminHeaders()), origin: "https://evil.test" },
      ),
    );

    expect(response.status).toBe(403);
    expect(await participantCount()).toBe(3);
  });

  it("con inscripciones abiertas responde 409 REGISTRATION_OPEN y no borra nada", async () => {
    await seedParticipants(3);
    await seedRegistrationStatus(true);

    const response = await DELETE(purgeRequest({ confirm: "BORRAR" }, await adminHeaders()));

    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("REGISTRATION_OPEN");
    expect(await participantCount()).toBe(3);
    const settings = await getDb().collection("settings").doc("registration").get();
    expect(settings.data()?.dataPurgedAt).toBeUndefined();
  });

  it("sin documento de configuración (inscripciones abiertas por defecto) también responde 409", async () => {
    await seedParticipants(2);

    const response = await DELETE(purgeRequest({ confirm: "BORRAR" }, await adminHeaders()));

    expect(response.status).toBe(409);
    expect(await participantCount()).toBe(2);
  });

  it("una frase distinta de BORRAR responde 400 VALIDATION_ERROR y no borra nada", async () => {
    await seedParticipants(3);
    await seedRegistrationStatus(false);
    const headers = await adminHeaders();

    for (const body of [{ confirm: "borrar" }, { confirm: "BORRAR " }, { confirm: "" }, {}]) {
      const response = await DELETE(purgeRequest(body, headers));
      expect(response.status).toBe(400);
      const json = (await response.json()) as {
        code: string;
        fieldErrors?: Record<string, string[]>;
      };
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.fieldErrors?.confirm?.length).toBeGreaterThan(0);
    }
    const invalidJson = await DELETE(
      new Request("http://localhost:3000/api/admin/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
        body: "no es json",
      }),
    );
    expect(invalidJson.status).toBe(400);
    expect(await participantCount()).toBe(3);
  });

  it("cerradas y con la frase correcta elimina los participantes y reduce los ganadores a { fullName }", async () => {
    const phones = await seedParticipants(12);
    await seedLegacyDraw(phones.slice(0, 3));
    await seedLegacyDraw(phones.slice(3, 5));
    await seedRegistrationStatus(false);

    const response = await DELETE(purgeRequest({ confirm: "BORRAR" }, await adminHeaders()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedParticipants: 12 });
    expect(await participantCount()).toBe(0);

    const draws = await readDraws();
    expect(draws).toHaveLength(2);
    for (const { data } of draws) {
      const winners = data.winners as Array<Record<string, unknown>>;
      expect(winners.length).toBe(data.requestedCount);
      for (const winner of winners) {
        // Exactamente { fullName }: sin celular ni empresa (FR-031, SC-011).
        expect(Object.keys(winner)).toEqual(["fullName"]);
        expect(winner.fullName).toMatch(/^Participante /);
      }
      expect(data.purgedAt).toBeDefined();
      expect(data.purgedAt).not.toBeNull();
      // Se conservan fecha, cantidad y administrador.
      expect(data.createdAt).toBeDefined();
      expect(data.createdBy).toEqual({ uid: "seed", email: "seed@example.com" });
    }

    const settings = await getDb().collection("settings").doc("registration").get();
    expect(settings.data()?.dataPurgedAt).toBeDefined();
    // Las inscripciones siguen cerradas.
    expect(settings.data()?.open).toBe(false);
  });

  it("es idempotente: repetir la operación no cambia nada más", async () => {
    const phones = await seedParticipants(5);
    await seedLegacyDraw(phones.slice(0, 2));
    await seedRegistrationStatus(false);
    const headers = await adminHeaders();

    const first = await DELETE(purgeRequest({ confirm: "BORRAR" }, headers));
    expect(await first.json()).toEqual({ deletedParticipants: 5 });
    const before = await readDraws();

    const second = await DELETE(purgeRequest({ confirm: "BORRAR" }, headers));

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ deletedParticipants: 0 });
    expect(await participantCount()).toBe(0);
    const after = await readDraws();
    expect(after).toEqual(before);
  });

  it("con más de 500 participantes los elimina todos", async () => {
    await seedParticipants(1200);
    await seedRegistrationStatus(false);

    const response = await DELETE(purgeRequest({ confirm: "BORRAR" }, await adminHeaders()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedParticipants: 1200 });
    expect(await participantCount()).toBe(0);
  });
});

describe("purgeAllParticipantData", () => {
  it("lanza RegistrationOpenError con las inscripciones abiertas", async () => {
    await seedParticipants(2);
    await seedRegistrationStatus(true);

    await expect(purgeAllParticipantData(ADMIN.uid)).rejects.toBeInstanceOf(RegistrationOpenError);
    expect(await participantCount()).toBe(2);
  });

  it("se puede reintentar tras una ejecución a medias sin duplicar efectos", async () => {
    const phones = await seedParticipants(6);
    const drawId = await seedLegacyDraw(phones.slice(0, 2));
    const reduced = await reducedWinnersOf(drawId);
    await seedRegistrationStatus(false);

    // Estado de una ejecución interrumpida: el paso 1 terminó y quedan participantes.
    const purgedAt = new Date("2026-10-21T12:00:00.000Z");
    await getDb().collection("draws").doc(drawId).update({ winners: reduced, purgedAt });

    const deleted = await purgeAllParticipantData(ADMIN.uid);

    expect(deleted).toBe(6);
    expect(await participantCount()).toBe(0);
    const [saved] = await readDraws();
    expect(saved?.data.winners).toEqual(reduced);
    // La marca de borrado original se conserva.
    expect(saved?.data.purgedAt.toDate().toISOString()).toBe(purgedAt.toISOString());
    const settings = await getDb().collection("settings").doc("registration").get();
    expect(settings.data()?.dataPurgedAt).toBeDefined();
  });

  it("reduce ganadores con campos de más aunque purgedAt ya exista", async () => {
    const phones = await seedParticipants(3);
    const drawId = await seedLegacyDraw(phones.slice(0, 1));
    const reduced = await reducedWinnersOf(drawId);
    await seedRegistrationStatus(false);
    await getDb().collection("draws").doc(drawId).update({ purgedAt: new Date() });

    await purgeAllParticipantData(ADMIN.uid);

    const [saved] = await readDraws();
    expect(saved?.data.winners).toEqual(reduced);
  });
});

describe("borrado definitivo y giros (feature 003, FR-086)", () => {
  async function seedSpins() {
    await seedParticipants(6);
    await seedRegistrationStatus(false);
    const prizeId = await seedPrize({ name: "Alexa", quantity: 3 });
    const first = await spin({ prizeId }, ADMIN);
    const second = await spin({ prizeId }, ADMIN);
    await discardSpin(first.id, ADMIN);
    return { prizeId, first, second };
  }

  async function readSpins() {
    const snapshot = await getDb().collection("spins").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }

  it("reduce el ganador de cada giro a { fullName } y conserva número, premio, estado y fechas", async () => {
    const { prizeId, first, second } = await seedSpins();
    const before = Object.fromEntries((await readSpins()).map((entry) => [entry.id, entry.data]));

    await purgeAllParticipantData(ADMIN.uid);

    const after = await readSpins();
    expect(after).toHaveLength(2);
    for (const { id, data } of after) {
      expect(Object.keys(data.winner as object)).toEqual(["fullName"]);
      expect((data.winner as { fullName: string }).fullName).toMatch(/^Participante /);
      expect(data.purgedAt).toBeDefined();
      expect(data.purgedAt).not.toBeNull();
      const original = before[id] as Record<string, unknown>;
      expect(data.number).toBe(original.number);
      expect(data.prizeId).toBe(prizeId);
      expect(data.status).toBe(original.status);
      expect(data.createdAt).toEqual(original.createdAt);
      expect(data.createdBy).toEqual(original.createdBy);
      // El giro no guarda el id del participante: no queda ningún celular en el documento.
      expect(Object.keys(data)).not.toContain("participantId");
    }
    const discarded = after.find((entry) => entry.id === first.id);
    const active = after.find((entry) => entry.id === second.id);
    expect(discarded?.data.status).toBe("discarded");
    expect(discarded?.data.discardedBy).toEqual({ uid: ADMIN.uid, email: ADMIN.email });
    expect(active?.data.status).toBe("active");
  });

  it("es idempotente: repetir el borrado no cambia los giros", async () => {
    await seedSpins();
    await purgeAllParticipantData(ADMIN.uid);
    const before = await readSpins();

    await purgeAllParticipantData(ADMIN.uid);

    expect(await readSpins()).toEqual(before);
  });

  it("conserva el purgedAt original si ya existía", async () => {
    const { first } = await seedSpins();
    const purgedAt = new Date("2026-10-21T12:00:00.000Z");
    await getDb().collection("spins").doc(first.id).update({ purgedAt });

    await purgeAllParticipantData(ADMIN.uid);

    const saved = (await getDb().collection("spins").doc(first.id).get()).data();
    expect(saved?.purgedAt.toDate().toISOString()).toBe(purgedAt.toISOString());
    expect(Object.keys(saved?.winner as object)).toEqual(["fullName"]);
  });

  it("después del borrado ya no se puede girar", async () => {
    const { prizeId } = await seedSpins();
    await purgeAllParticipantData(ADMIN.uid);

    await expect(spin({ prizeId }, ADMIN)).rejects.toBeInstanceOf(NoEligibleError);
  });
});
