import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore, phoneForIndex, seedParticipants, seedRegistrationStatus } from "./helpers";
import { GET } from "@/app/api/status/route";
import { getDb } from "@/services/firebase/admin";
import { invalidatePublicStatus } from "@/services/public-status.service";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/** Agrega un participante más (distinto de los que siembra `seedParticipants`). */
async function addParticipant(): Promise<void> {
  const phone = phoneForIndex(5000);
  await getDb().collection("participants").doc(phone).set({
    fullName: "Participante Extra",
    phone,
    company: "Empresa Extra",
    createdAt: new Date(),
    drawId: null,
  });
}

beforeEach(async () => {
  await clearFirestore();
  invalidatePublicStatus();
});

describe("GET /api/status", () => {
  it("sin documentos responde 200 con { open: true, count: 0 } y sin caché", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ open: true, count: 0 });
    expect(Object.keys(body).sort()).toEqual(["count", "open"]);
  });

  it("devuelve el total de participantes", async () => {
    await seedParticipants(3);
    invalidatePublicStatus();

    const body = (await (await GET()).json()) as { count: number };

    expect(body.count).toBe(3);
  });

  it("memoriza 1 s por instancia y se actualiza al invalidar", async () => {
    await seedParticipants(1);
    invalidatePublicStatus();
    expect(((await (await GET()).json()) as { count: number }).count).toBe(1);

    // Un segundo participante dentro de la ventana de 1 s: la memoria devuelve el valor anterior.
    await addParticipant();
    expect(((await (await GET()).json()) as { count: number }).count).toBe(1);

    invalidatePublicStatus();
    expect(((await (await GET()).json()) as { count: number }).count).toBe(2);
  });

  it("refleja las inscripciones cerradas", async () => {
    await seedRegistrationStatus(false);
    invalidatePublicStatus();

    const body = (await (await GET()).json()) as { open: boolean };

    expect(body.open).toBe(false);
  });

  it("no expone nombres, celulares ni otros datos de los participantes", async () => {
    await seedParticipants(2);
    invalidatePublicStatus();

    const text = await (await GET()).text();

    expect(text).not.toMatch(/Participante|Empresa|\+?519\d{8}/);
  });
});
