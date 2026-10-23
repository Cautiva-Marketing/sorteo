import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * Constitución III / quickstart escenario 12: las reglas deniegan TODO acceso directo desde
 * clientes (anónimo, autenticado y administrador). Toda lectura y escritura pasa por el
 * servidor con el Admin SDK, que ignora las reglas.
 */
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-sorteo",
    firestore: {
      rules: readFileSync(path.resolve(import.meta.dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Documentos existentes para probar get/update/delete (con las reglas desactivadas).
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc("participants/+51987654321").set({
      fullName: "Maria Perez",
      phone: "+51987654321",
      company: "Empresa",
      drawId: null,
    });
    await db.doc("draws/sorteo-1").set({ requestedCount: 1, winners: [], purgedAt: null });
    await db.doc("settings/registration").set({ open: true });
    await db.doc("settings/draw").set({ nextNumber: 1 });
    await db.doc("prizes/premio-1").set({ name: "Alexa", nameKey: "alexa", quantity: 1 });
    await db.doc("spins/giro-1").set({ number: 1, prizeId: "premio-1", status: "active" });
  });
});

interface ContextCase {
  name: string;
  create: () => RulesTestContext;
}

const contexts: ContextCase[] = [
  { name: "anónimo", create: () => testEnv.unauthenticatedContext() },
  { name: "autenticado sin claim", create: () => testEnv.authenticatedContext("usuario-1") },
  {
    name: "autenticado con claim admin",
    create: () => testEnv.authenticatedContext("admin-1", { admin: true }),
  },
];

interface Target {
  collection: string;
  existingDoc: string;
  newDoc: string;
}

const targets: Target[] = [
  { collection: "participants", existingDoc: "+51987654321", newDoc: "+51900000000" },
  { collection: "draws", existingDoc: "sorteo-1", newDoc: "sorteo-nuevo" },
  { collection: "settings", existingDoc: "registration", newDoc: "otro" },
  // Feature 003: el contador del sorteo (`settings/draw`), los premios y los giros.
  { collection: "settings", existingDoc: "draw", newDoc: "otro-contador" },
  { collection: "prizes", existingDoc: "premio-1", newDoc: "premio-nuevo" },
  { collection: "spins", existingDoc: "giro-1", newDoc: "giro-nuevo" },
];

describe.each(contexts)("reglas de Firestore - contexto $name", ({ create }) => {
  describe.each(targets)("$collection", ({ collection, existingDoc, newDoc }) => {
    it("deniega get", async () => {
      const db = create().firestore();
      await assertFails(db.collection(collection).doc(existingDoc).get());
    });

    it("deniega list", async () => {
      const db = create().firestore();
      await assertFails(db.collection(collection).get());
    });

    it("deniega create", async () => {
      const db = create().firestore();
      await assertFails(db.collection(collection).doc(newDoc).set({ fullName: "Ana Lopez" }));
    });

    it("deniega update", async () => {
      const db = create().firestore();
      await assertFails(db.collection(collection).doc(existingDoc).update({ company: "Otra" }));
    });

    it("deniega delete", async () => {
      const db = create().firestore();
      await assertFails(db.collection(collection).doc(existingDoc).delete());
    });
  });
});
