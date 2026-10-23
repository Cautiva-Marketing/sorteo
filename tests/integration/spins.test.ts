import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFirestore,
  seedLegacyDraw,
  seedParticipants,
  seedPrize,
  seedRegistrationStatus,
  snapshotCollections,
} from "./helpers";
import { participantRef } from "@/lib/draw";
import { getDb } from "@/services/firebase/admin";
import { purgeAllParticipantData } from "@/services/participants.service";
import {
  discardSpin,
  getWinnerLookup,
  listWheelParticipants,
  listWinnerRecords,
  NoEligibleError,
  practiceSpin,
  PrizeExhaustedError,
  PrizeNotFoundError,
  SpinNotActiveError,
  SpinNotFoundError,
  spin,
} from "@/services/spins.service";
import type { AdminIdentity } from "@/types";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 30_000 });

const ADMIN: AdminIdentity = { uid: "admin-uid-1", email: "admin@example.com" };

beforeEach(async () => {
  await clearFirestore();
  // Salvo donde se indique, las inscripciones están cerradas.
  await seedRegistrationStatus(false);
});

async function readDoc(path: string): Promise<Record<string, unknown> | undefined> {
  const snapshot = await getDb().doc(path).get();
  return snapshot.data();
}

async function participantOfSpin(spinId: string) {
  const snapshot = await getDb().collection("participants").where("drawId", "==", spinId).get();
  return snapshot.docs;
}

describe("spin", () => {
  it("guarda el giro, marca al ganador y actualiza premio y contador", async () => {
    await seedParticipants(10);
    const prizeId = await seedPrize({ name: "Alexa", quantity: 2 });

    const result = await spin({ prizeId }, ADMIN);

    expect(result.number).toBe(1);
    expect(result.status).toBe("active");
    expect(result.prize).toEqual({ id: prizeId, name: "Alexa" });
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const saved = await readDoc(`spins/${result.id}`);
    expect(saved).toBeDefined();
    expect(saved?.number).toBe(1);
    expect(saved?.status).toBe("active");
    expect(saved?.prizeId).toBe(prizeId);
    expect(saved?.createdBy).toEqual({ uid: ADMIN.uid, email: ADMIN.email });
    expect(saved?.discardedAt).toBeNull();
    expect(saved?.discardedBy).toBeNull();
    expect(saved?.purgedAt).toBeNull();
    expect(saved?.createdAt).toBeDefined();
    const winner = saved?.winner as { fullName: string; company: string; phone: string };
    // El snapshot guarda el celular en E.164 (feature 004).
    expect(winner.phone).toMatch(/^\+519\d{8}$/);
    expect(winner.fullName).toMatch(/^Participante /);
    expect(winner.company).toMatch(/^Empresa /);
    // El giro no guarda el id del participante (que es su celular).
    expect(Object.keys(saved ?? {})).not.toContain("participantId");

    const marked = await participantOfSpin(result.id);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.id).toBe(winner.phone);
    expect(result.winner.ref).toBe(participantRef(marked[0]?.id ?? ""));
    expect(result.winner.fullName).toBe(winner.fullName);

    const prize = await readDoc(`prizes/${prizeId}`);
    expect(prize?.delivered).toBe(1);
    expect(prize?.spinCount).toBe(1);
    expect((await readDoc("settings/draw"))?.nextNumber).toBe(2);
  });

  it("la respuesta no incluye celular ni empresa", async () => {
    await seedParticipants(5);
    const prizeId = await seedPrize({ quantity: 1 });

    const result = await spin({ prizeId }, ADMIN);

    const json = JSON.stringify(result);
    expect(json).not.toMatch(/9\d{8}/);
    expect(json).not.toContain("Empresa");
    expect(json).not.toContain("phone");
  });

  it("giros sucesivos numeran 1, 2, 3 y excluyen a los ganadores previos", async () => {
    await seedParticipants(6);
    const prizeId = await seedPrize({ quantity: 3 });

    const first = await spin({ prizeId }, ADMIN);
    const second = await spin({ prizeId }, ADMIN);
    const third = await spin({ prizeId }, ADMIN);

    expect([first.number, second.number, third.number]).toEqual([1, 2, 3]);
    expect(new Set([first.winner.ref, second.winner.ref, third.winner.ref]).size).toBe(3);
    expect(await listWheelParticipants()).toHaveLength(3);
  });

  it("con rondas antiguas el primer giro nuevo continúa la numeración y no repite a sus ganadores", async () => {
    const phones = await seedParticipants(10);
    await seedLegacyDraw(phones.slice(0, 3));
    const prizeId = await seedPrize({ quantity: 1 });

    const result = await spin({ prizeId }, ADMIN);

    expect(result.number).toBe(4);
    const legacyRefs = new Set(phones.slice(0, 3).map((phone) => participantRef(phone)));
    expect(legacyRefs.has(result.winner.ref)).toBe(false);
  });

  it("un premio sin unidades pendientes lanza PrizeExhaustedError sin cambios", async () => {
    await seedParticipants(5);
    const prizeId = await seedPrize({ quantity: 1, delivered: 1, spinCount: 1 });
    const before = await snapshotCollections(["participants", "prizes", "spins"]);

    await expect(spin({ prizeId }, ADMIN)).rejects.toBeInstanceOf(PrizeExhaustedError);

    expect(await snapshotCollections(["participants", "prizes", "spins"])).toEqual(before);
  });

  it("un premio inexistente lanza PrizeNotFoundError", async () => {
    await seedParticipants(5);

    await expect(spin({ prizeId: "no-existe" }, ADMIN)).rejects.toBeInstanceOf(PrizeNotFoundError);
  });

  it("sin participantes elegibles lanza NoEligibleError", async () => {
    const prizeId = await seedPrize({ quantity: 1 });

    await expect(spin({ prizeId }, ADMIN)).rejects.toBeInstanceOf(NoEligibleError);
  });

  it("dos giros simultáneos por la última unidad entregan un solo ganador", async () => {
    await seedParticipants(5);
    const prizeId = await seedPrize({ quantity: 1 });

    const results = await Promise.allSettled([spin({ prizeId }, ADMIN), spin({ prizeId }, ADMIN)]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(PrizeExhaustedError);
    const spins = await getDb().collection("spins").get();
    expect(spins.size).toBe(1);
    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(1);
  });

  it("tres giros simultáneos por un premio de 2 unidades: 2 éxitos con números distintos", async () => {
    await seedParticipants(8);
    const prizeId = await seedPrize({ quantity: 2 });

    const results = await Promise.allSettled([
      spin({ prizeId }, ADMIN),
      spin({ prizeId }, ADMIN),
      spin({ prizeId }, ADMIN),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof spin>>> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(PrizeExhaustedError);
    expect(fulfilled.map((result) => result.value.number).sort()).toEqual([1, 2]);
    expect(new Set(fulfilled.map((result) => result.value.winner.ref)).size).toBe(2);
  });

  it("si dos giros simultáneos eligen a la misma persona, ninguna persona gana dos veces", async () => {
    await seedParticipants(5);
    const prizeId = await seedPrize({ quantity: 2 });
    // Ambos giros eligen siempre el primer elegible: el segundo debe reintentar con la lista nueva.
    const first = (lo: number): number => lo;

    const results = await Promise.all([
      spin({ prizeId }, ADMIN, { randomInt: first }),
      spin({ prizeId }, ADMIN, { randomInt: first }),
    ]);

    expect(new Set(results.map((result) => result.winner.ref)).size).toBe(2);
    expect(results.map((result) => result.number).sort()).toEqual([1, 2]);
    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(2);
  });

  describe("inscripciones (FR-106, FR-107)", () => {
    it("abiertas: gira de inmediato y deja las inscripciones cerradas", async () => {
      await seedRegistrationStatus(true);
      await seedParticipants(5);
      const prizeId = await seedPrize({ quantity: 1 });

      const result = await spin({ prizeId }, ADMIN);

      expect(result.number).toBe(1);
      const registration = await readDoc("settings/registration");
      expect(registration?.open).toBe(false);
      expect(registration?.updatedBy).toBe(ADMIN.uid);
    });

    it("sin el documento de configuración también gira y cierra las inscripciones", async () => {
      await getDb().doc("settings/registration").delete();
      await seedParticipants(5);
      const prizeId = await seedPrize({ quantity: 1 });

      await expect(spin({ prizeId }, ADMIN)).resolves.toMatchObject({ number: 1 });
      expect((await readDoc("settings/registration"))?.open).toBe(false);
    });

    it("cerradas: gira y no cambia updatedAt de settings/registration", async () => {
      await seedParticipants(5);
      const prizeId = await seedPrize({ quantity: 1 });
      const before = await readDoc("settings/registration");

      await expect(spin({ prizeId }, ADMIN)).resolves.toMatchObject({ number: 1 });

      const after = await readDoc("settings/registration");
      expect(after?.open).toBe(false);
      expect(after?.updatedAt).toEqual(before?.updatedAt);
    });

    it("si el giro falla (premio agotado o sin elegibles) las inscripciones siguen abiertas", async () => {
      await seedRegistrationStatus(true);
      await seedParticipants(5);
      const exhausted = await seedPrize({ quantity: 1, delivered: 1, spinCount: 1 });

      await expect(spin({ prizeId: exhausted }, ADMIN)).rejects.toBeInstanceOf(PrizeExhaustedError);
      expect((await readDoc("settings/registration"))?.open).toBe(true);

      await clearFirestore();
      await seedRegistrationStatus(true);
      const prizeId = await seedPrize({ quantity: 1 });

      await expect(spin({ prizeId }, ADMIN)).rejects.toBeInstanceOf(NoEligibleError);
      expect((await readDoc("settings/registration"))?.open).toBe(true);
    });

    it("el modo de práctica no cierra inscripciones ni escribe en Firestore", async () => {
      await seedRegistrationStatus(true);
      await seedParticipants(5);
      await seedPrize({ quantity: 1 });
      const names = ["participants", "prizes", "spins", "settings"];
      const before = await snapshotCollections(names);

      await practiceSpin();

      expect(await snapshotCollections(names)).toEqual(before);
      expect((await readDoc("settings/registration"))?.open).toBe(true);
    });
  });
});

describe("practiceSpin", () => {
  it("devuelve un ganador sin escribir nada, ni siquiera con inscripciones abiertas", async () => {
    await seedRegistrationStatus(true);
    await seedParticipants(8);
    await seedPrize({ quantity: 2 });
    const names = ["participants", "prizes", "spins", "settings"];
    const before = await snapshotCollections(names);

    for (let round = 0; round < 5; round += 1) {
      const result = await practiceSpin();
      expect(result.practice).toBe(true);
      expect(result.winner.ref).toMatch(/^[0-9a-f]{16}$/);
      expect(result.winner.fullName).toMatch(/^Participante /);
      expect(Object.keys(result.winner).sort()).toEqual(["fullName", "ref"]);
    }

    expect(await snapshotCollections(names)).toEqual(before);
  });

  it("sin participantes elegibles lanza NoEligibleError", async () => {
    await expect(practiceSpin()).rejects.toBeInstanceOf(NoEligibleError);
  });
});

describe("listWheelParticipants", () => {
  it("devuelve solo elegibles como { ref, fullName }, ordenados por ref", async () => {
    const phones = await seedParticipants(6);
    await seedLegacyDraw(phones.slice(0, 2));

    const wheel = await listWheelParticipants();

    expect(wheel).toHaveLength(4);
    for (const entry of wheel) {
      expect(Object.keys(entry).sort()).toEqual(["fullName", "ref"]);
      expect(entry.ref).toMatch(/^[0-9a-f]{16}$/);
    }
    const refs = wheel.map((entry) => entry.ref);
    expect(refs).toEqual([...refs].sort());
    const excluded = new Set(phones.slice(0, 2).map((phone) => participantRef(phone)));
    expect(refs.some((ref) => excluded.has(ref))).toBe(false);
  });
});

describe("listWinnerRecords", () => {
  it("devuelve los giros por número descendente con el nombre del premio", async () => {
    await seedParticipants(6);
    const prizeId = await seedPrize({ name: "Alexa", quantity: 3 });
    await spin({ prizeId }, ADMIN);
    await spin({ prizeId }, ADMIN);

    const records = await listWinnerRecords();

    expect(records.map((record) => record.number)).toEqual([2, 1]);
    for (const record of records) {
      expect(record.legacy).toBe(false);
      expect(record.prizeName).toBe("Alexa");
      expect(record.prizeId).toBe(prizeId);
      expect(record.status).toBe("active");
      expect(record.createdByEmail).toBe(ADMIN.email);
      expect(record.phone).toMatch(/^\+519\d{8}$/);
      expect(record.discardedAt).toBeNull();
    }
  });
});

describe("discardSpin", () => {
  it("marca el giro como descartado, libera la unidad y deja al participante fuera de la ruleta", async () => {
    await seedParticipants(6);
    const prizeId = await seedPrize({ quantity: 2 });
    const first = await spin({ prizeId }, ADMIN);
    const marked = await participantOfSpin(first.id);

    const result = await discardSpin(first.id, ADMIN);

    expect(result).toMatchObject({ id: first.id, number: 1, status: "discarded" });
    expect(result.discardedAt).toBeInstanceOf(Date);
    const saved = await readDoc(`spins/${first.id}`);
    expect(saved?.status).toBe("discarded");
    expect(saved?.discardedAt).toBeDefined();
    expect(saved?.discardedAt).not.toBeNull();
    expect(saved?.discardedBy).toEqual({ uid: ADMIN.uid, email: ADMIN.email });
    // La unidad vuelve al premio, pero el giro sigue contando como historial.
    const prize = await readDoc(`prizes/${prizeId}`);
    expect(prize?.delivered).toBe(0);
    expect(prize?.spinCount).toBe(1);
    // El participante conserva su drawId: no vuelve a la ruleta.
    expect(await participantOfSpin(first.id)).toHaveLength(1);
    expect(marked[0]?.id).toBe((await participantOfSpin(first.id))[0]?.id);
    const wheel = await listWheelParticipants();
    expect(wheel).toHaveLength(5);
    expect(wheel.some((entry) => entry.ref === first.winner.ref)).toBe(false);
  });

  it("descartar dos veces lanza SpinNotActiveError y un giro inexistente SpinNotFoundError", async () => {
    await seedParticipants(4);
    const prizeId = await seedPrize({ quantity: 1 });
    const first = await spin({ prizeId }, ADMIN);
    await discardSpin(first.id, ADMIN);

    await expect(discardSpin(first.id, ADMIN)).rejects.toBeInstanceOf(SpinNotActiveError);
    await expect(discardSpin("no-existe", ADMIN)).rejects.toBeInstanceOf(SpinNotFoundError);
    // El segundo intento no volvió a bajar las unidades entregadas.
    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(0);
  });

  it("el giro siguiente lleva el número 2 y el descartado conserva el 1", async () => {
    await seedParticipants(6);
    const prizeId = await seedPrize({ quantity: 1 });
    const first = await spin({ prizeId }, ADMIN);
    await discardSpin(first.id, ADMIN);

    const second = await spin({ prizeId }, ADMIN);

    expect(second.number).toBe(2);
    expect(second.winner.ref).not.toBe(first.winner.ref);
    expect((await readDoc(`spins/${first.id}`))?.number).toBe(1);
    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(1);
    const records = await listWinnerRecords();
    expect(records.map((record) => [record.number, record.status])).toEqual([
      [2, "active"],
      [1, "discarded"],
    ]);
    expect(records[1]?.discardedByEmail).toBe(ADMIN.email);
    expect(records[1]?.discardedAt).toBeInstanceOf(Date);
  });

  it("en un premio de 2 unidades solo cuentan los ganadores activos", async () => {
    await seedParticipants(8);
    const prizeId = await seedPrize({ quantity: 2 });
    const first = await spin({ prizeId }, ADMIN);
    await spin({ prizeId }, ADMIN);
    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(2);

    await discardSpin(first.id, ADMIN);

    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(1);
    await expect(spin({ prizeId }, ADMIN)).resolves.toMatchObject({ number: 3 });
  });

  it("si el único elegible fue descartado, ya no se puede girar", async () => {
    await seedParticipants(1);
    const prizeId = await seedPrize({ quantity: 2 });
    const first = await spin({ prizeId }, ADMIN);
    await discardSpin(first.id, ADMIN);

    await expect(spin({ prizeId }, ADMIN)).rejects.toBeInstanceOf(NoEligibleError);
  });

  it("sigue funcionando tras el borrado definitivo (el participante ya no existe)", async () => {
    await seedParticipants(3);
    const prizeId = await seedPrize({ quantity: 1 });
    const first = await spin({ prizeId }, ADMIN);
    await purgeAllParticipantData(ADMIN.uid);

    await expect(discardSpin(first.id, ADMIN)).resolves.toMatchObject({ status: "discarded" });
    expect((await readDoc(`prizes/${prizeId}`))?.delivered).toBe(0);
  });
});

describe("listWinnerRecords con rondas antiguas (feature 003, FR-083)", () => {
  async function seedMixedHistory() {
    const phones = await seedParticipants(10);
    await seedLegacyDraw(phones.slice(0, 2), { createdAt: new Date("2026-10-20T10:00:00.000Z") });
    await seedLegacyDraw(phones.slice(2, 3), { createdAt: new Date("2026-10-21T10:00:00.000Z") });
    const prizeId = await seedPrize({ name: "Alexa", quantity: 3 });
    const spins = [];
    for (let round = 0; round < 3; round += 1) {
      spins.push(await spin({ prizeId }, ADMIN));
    }
    return { phones, spins };
  }

  it("une giros y rondas antiguas por número descendente; las antiguas son «Sin premio»", async () => {
    const { spins } = await seedMixedHistory();

    const records = await listWinnerRecords();

    expect(records.map((record) => record.number)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(records.slice(0, 3).map((record) => record.key)).toEqual(
      [...spins].reverse().map((entry) => entry.id),
    );
    for (const record of records.slice(0, 3)) {
      expect(record.legacy).toBe(false);
      expect(record.prizeName).toBe("Alexa");
    }
    for (const record of records.slice(3)) {
      expect(record.legacy).toBe(true);
      expect(record.prizeId).toBeNull();
      expect(record.prizeName).toBeNull();
      expect(record.status).toBe("active");
      expect(record.phone).toMatch(/^9\d{8}$/);
    }
    // Numeración de las rondas antiguas: por fecha de ronda y posición.
    expect(records[5]?.fullName).toBe("Participante A");
    expect(records[4]?.fullName).toBe("Participante B");
    expect(records[3]?.fullName).toBe("Participante C");
  });

  it("la numeración de las rondas antiguas es estable entre lecturas", async () => {
    await seedMixedHistory();

    const first = await listWinnerRecords();
    const second = await listWinnerRecords();

    expect(second.map((record) => [record.key, record.number])).toEqual(
      first.map((record) => [record.key, record.number]),
    );
  });

  it("tras el borrado definitivo las antiguas conservan número y nombre y pierden celular y empresa", async () => {
    await seedMixedHistory();
    await purgeAllParticipantData(ADMIN.uid);

    const records = await listWinnerRecords();

    const legacy = records.filter((record) => record.legacy);
    expect(legacy.map((record) => record.number)).toEqual([3, 2, 1]);
    for (const record of legacy) {
      expect(record.fullName).toMatch(/^Participante /);
      expect(record.phone).toBeUndefined();
      expect(record.company).toBeUndefined();
    }
  });

  it("getWinnerLookup mapea cada giro por id y cada ganador antiguo por celular", async () => {
    const { phones, spins } = await seedMixedHistory();
    await discardSpin(spins[0]?.id ?? "", ADMIN);

    const lookup = await getWinnerLookup();

    expect(lookup.bySpinId.size).toBe(3);
    expect(lookup.bySpinId.get(spins[0]?.id ?? "")).toEqual({
      prizeName: "Alexa",
      number: 4,
      status: "discarded",
    });
    expect(lookup.bySpinId.get(spins[2]?.id ?? "")).toEqual({
      prizeName: "Alexa",
      number: 6,
      status: "active",
    });
    expect(lookup.byLegacyPhone.size).toBe(3);
    expect(lookup.byLegacyPhone.get(phones[0]?.replace("+51", "") ?? "")).toEqual({
      prizeName: null,
      number: 1,
      status: "active",
    });
    expect(lookup.byLegacyPhone.get(phones[2]?.replace("+51", "") ?? "")?.number).toBe(3);
  });
});
