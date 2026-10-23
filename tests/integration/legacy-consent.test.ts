import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthUsers,
  clearFirestore,
  createSessionCookieValue,
  seedPrize,
  seedRegistrationStatus,
  sessionCookieHeader,
} from "./helpers";
import { GET } from "@/app/api/admin/participants/export/route";
import { getDb } from "@/services/firebase/admin";
import { listParticipants, purgeAllParticipantData } from "@/services/participants.service";
import { spin } from "@/services/spins.service";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const BOM = String.fromCharCode(0xfeff);
const ADMIN = { uid: "u1", email: "admin@example.com" };

/**
 * Documento anterior a la feature 002: todavía trae el mapa `consent` que ya no existe en el
 * modelo. Debe seguir funcionando en todo el sistema sin exponer ese campo.
 */
async function seedLegacyParticipant(): Promise<void> {
  const createdAt = new Date("2026-10-21T20:15:30.000Z");
  await getDb()
    .collection("participants")
    .doc("+51987654321")
    .set({
      fullName: "José Núñez Güemes",
      phone: "+51987654321",
      company: "Cautiva Marketing",
      createdAt,
      consent: { acceptedAt: createdAt, version: "2026-10-v1" },
      drawId: null,
    });
}

beforeAll(async () => {
  await clearAuthUsers();
});

beforeEach(async () => {
  await clearFirestore();
  await seedLegacyParticipant();
});

describe("participantes anteriores con el mapa `consent`", () => {
  it("el listado los devuelve sin el campo consent", async () => {
    const rows = await listParticipants();

    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "company",
      "createdAt",
      "crmInterest",
      "drawId",
      "fullName",
      "phone",
    ]);
    expect(rows[0]?.phone).toBe("+51987654321");
    // Documento anterior sin el campo: no está interesado.
    expect(rows[0]?.crmInterest).toBe(false);
  });

  it("la exportación CSV incluye su fila y no tiene columna de consentimiento", async () => {
    const cookie = await createSessionCookieValue("admin-legacy@example.com", { admin: true });

    const response = await GET(
      new Request("http://localhost:3000/api/admin/participants/export", {
        method: "GET",
        headers: { cookie: sessionCookieHeader(cookie) },
      }),
    );

    expect(response.status).toBe(200);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      new Uint8Array(await response.arrayBuffer()),
    );
    expect(text.split("\r\n")).toEqual([
      BOM +
        "Nombres,Celular (con código de país),Empresa u ocupación,Interesado en CRM,Fecha de registro,Premio,N.º de ganador,Estado",
      "José Núñez Güemes,51 987654321,Cautiva Marketing,No,2026-10-21 15:15:30,,,",
    ]);
  });

  it("pueden ganar un giro y el giro guarda solo nombre, empresa y celular", async () => {
    await seedRegistrationStatus(false);
    const prizeId = await seedPrize({ quantity: 1 });

    const result = await spin({ prizeId }, ADMIN);

    expect(result.winner.fullName).toBe("José Núñez Güemes");
    const saved = (await getDb().collection("spins").doc(result.id).get()).data();
    expect(saved?.winner).toEqual({
      fullName: "José Núñez Güemes",
      company: "Cautiva Marketing",
      phone: "+51987654321",
    });
  });

  it("el borrado definitivo los elimina", async () => {
    await seedRegistrationStatus(false);

    const deleted = await purgeAllParticipantData(ADMIN.uid);

    expect(deleted).toBe(1);
    expect((await getDb().collection("participants").count().get()).data().count).toBe(0);
  });
});
