import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore, seedPrize } from "./helpers";
import { getDb } from "@/services/firebase/admin";
import {
  createPrize,
  deletePrize,
  DuplicatePrizeNameError,
  listPrizes,
  PrizeHasHistoryError,
  PrizeNotFoundError,
  PrizeOrderMismatchError,
  QuantityBelowDeliveredError,
  reorderPrizes,
  updatePrize,
} from "@/services/prizes.service";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const ADMIN_UID = "admin-uid-1";

beforeEach(async () => {
  await clearFirestore();
});

async function readPrize(id: string): Promise<Record<string, unknown>> {
  const snapshot = await getDb().collection("prizes").doc(id).get();
  return snapshot.data() ?? {};
}

describe("createPrize", () => {
  it("guarda nameKey en minúsculas, order = máximo + 1 y contadores en cero", async () => {
    const first = await createPrize({ name: "Alexa", quantity: 2 }, ADMIN_UID);
    const second = await createPrize({ name: "Box de Bienvenida", quantity: 1 }, ADMIN_UID);

    expect(first.order).toBe(1);
    expect(second.order).toBe(2);
    expect(first.pending).toBe(2);

    const saved = await readPrize(second.id);
    expect(saved.name).toBe("Box de Bienvenida");
    expect(saved.nameKey).toBe("box de bienvenida");
    expect(saved.quantity).toBe(1);
    expect(saved.delivered).toBe(0);
    expect(saved.spinCount).toBe(0);
    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
  });

  it("rechaza un nombre repetido sin distinguir mayúsculas", async () => {
    await createPrize({ name: "Alexa", quantity: 1 }, ADMIN_UID);

    await expect(createPrize({ name: "alexa", quantity: 3 }, ADMIN_UID)).rejects.toBeInstanceOf(
      DuplicatePrizeNameError,
    );
    expect(await listPrizes()).toHaveLength(1);
  });

  it("dos altas simultáneas del mismo nombre crean solo un premio", async () => {
    const results = await Promise.allSettled([
      createPrize({ name: "Termo", quantity: 1 }, ADMIN_UID),
      createPrize({ name: "Termo", quantity: 1 }, ADMIN_UID),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(DuplicatePrizeNameError);
    expect(await listPrizes()).toHaveLength(1);
  });
});

describe("updatePrize", () => {
  it("edita nombre y cantidad y actualiza nameKey", async () => {
    const created = await createPrize({ name: "Alexa", quantity: 1 }, ADMIN_UID);

    const updated = await updatePrize(created.id, { name: "Alexa Echo", quantity: 4 });

    expect(updated.name).toBe("Alexa Echo");
    expect(updated.quantity).toBe(4);
    expect((await readPrize(created.id)).nameKey).toBe("alexa echo");
  });

  it("permite conservar su propio nombre (solo cambia la cantidad)", async () => {
    const created = await createPrize({ name: "Alexa", quantity: 1 }, ADMIN_UID);

    const updated = await updatePrize(created.id, { name: "ALEXA", quantity: 2 });

    expect(updated.quantity).toBe(2);
  });

  it("rechaza renombrar a un nombre de otro premio", async () => {
    await createPrize({ name: "Alexa", quantity: 1 }, ADMIN_UID);
    const other = await createPrize({ name: "Box", quantity: 1 }, ADMIN_UID);

    await expect(updatePrize(other.id, { name: "alexa", quantity: 1 })).rejects.toBeInstanceOf(
      DuplicatePrizeNameError,
    );
  });

  it("no permite bajar la cantidad por debajo de las unidades entregadas", async () => {
    const id = await seedPrize({ name: "Alexa", quantity: 3, delivered: 2, spinCount: 2 });

    const error = await updatePrize(id, { name: "Alexa", quantity: 1 }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(QuantityBelowDeliveredError);
    expect((error as QuantityBelowDeliveredError).message).toContain("(2)");
    expect(await updatePrize(id, { name: "Alexa", quantity: 2 })).toMatchObject({ quantity: 2 });
  });

  it("un premio inexistente lanza PrizeNotFoundError", async () => {
    await expect(updatePrize("no-existe", { name: "Alexa", quantity: 1 })).rejects.toBeInstanceOf(
      PrizeNotFoundError,
    );
  });
});

describe("deletePrize", () => {
  it("elimina un premio sin historial", async () => {
    const created = await createPrize({ name: "Alexa", quantity: 1 }, ADMIN_UID);

    await deletePrize(created.id);

    expect(await listPrizes()).toHaveLength(0);
  });

  it("no elimina un premio con giros (activos o descartados)", async () => {
    const id = await seedPrize({ name: "Alexa", quantity: 1, delivered: 0, spinCount: 1 });

    await expect(deletePrize(id)).rejects.toBeInstanceOf(PrizeHasHistoryError);
    expect(await listPrizes()).toHaveLength(1);
  });

  it("un premio inexistente lanza PrizeNotFoundError", async () => {
    await expect(deletePrize("no-existe")).rejects.toBeInstanceOf(PrizeNotFoundError);
  });
});

describe("reorderPrizes", () => {
  it("reescribe order = índice con la lista completa", async () => {
    const a = await seedPrize({ name: "A1", order: 1 });
    const b = await seedPrize({ name: "B2", order: 2 });
    const c = await seedPrize({ name: "C3", order: 3 });

    await reorderPrizes([c, a, b]);

    const names = (await listPrizes()).map((prize) => prize.name);
    expect(names).toEqual(["C3", "A1", "B2"]);
    expect((await readPrize(c)).order).toBe(0);
  });

  it("rechaza ids faltantes, sobrantes o repetidos", async () => {
    const a = await seedPrize({ name: "A1", order: 1 });
    const b = await seedPrize({ name: "B2", order: 2 });

    await expect(reorderPrizes([a])).rejects.toBeInstanceOf(PrizeOrderMismatchError);
    await expect(reorderPrizes([a, b, "otro"])).rejects.toBeInstanceOf(PrizeOrderMismatchError);
    await expect(reorderPrizes([a, a])).rejects.toBeInstanceOf(PrizeOrderMismatchError);
  });
});

describe("listPrizes", () => {
  it("ordena por order y calcula pending y exhausted", async () => {
    await seedPrize({ name: "Segundo", quantity: 2, order: 2, delivered: 2, spinCount: 2 });
    await seedPrize({ name: "Primero", quantity: 3, order: 1, delivered: 1, spinCount: 1 });

    const prizes = await listPrizes();

    expect(prizes.map((prize) => prize.name)).toEqual(["Primero", "Segundo"]);
    expect(prizes[0]).toMatchObject({ pending: 2, exhausted: false, delivered: 1 });
    expect(prizes[1]).toMatchObject({ pending: 0, exhausted: true });
  });
});
