import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  clearAuthUsers,
  clearFirestore,
  seedParticipants,
  seedPrize,
  seedRegistrationStatus,
} from "./helpers";
import { toCsv } from "@/lib/csv";
import { filterParticipants } from "@/lib/search";
import { listParticipants } from "@/services/participants.service";
import { listWheelParticipants, spin } from "@/services/spins.service";
import type { AdminIdentity } from "@/types";

// SC-010: con 5 000 participantes el listado, la búsqueda, la exportación y los giros siguen siendo
// utilizables. Sembrar y leer 5 000 documentos en el emulador tarda varios segundos.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const TOTAL = 5000;
const SEARCH_LIMIT_MS = 2000;
const ADMIN: AdminIdentity = { uid: "admin-uid-volume", email: "admin-volume@example.com" };

/** Mide una operación asíncrona en milisegundos. */
async function timed<T>(label: string, action: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await action();
  console.info(`[volumen] ${label}: ${(performance.now() - start).toFixed(0)} ms`);
  return result;
}

beforeAll(async () => {
  await clearAuthUsers();
  await clearFirestore();
  await timed(`sembrar ${TOTAL} participantes`, () => seedParticipants(TOTAL));
});

describe(`volumen de ${TOTAL} participantes (SC-010)`, () => {
  it("listParticipants devuelve los 5 000", async () => {
    const rows = await timed("listParticipants", () => listParticipants());

    expect(rows).toHaveLength(TOTAL);
  });

  it("filterParticipants responde en menos de 2 000 ms con una consulta con tildes", async () => {
    const rows = await listParticipants();

    const start = performance.now();
    const matches = filterParticipants(rows, "PARTICIPÁNTE bc");
    const elapsed = performance.now() - start;
    console.info(
      `[volumen] filterParticipants("PARTICIPÁNTE bc"): ${elapsed.toFixed(1)} ms, ${matches.length} coincidencias`,
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((row) => row.fullName === "Participante BC")).toBe(true);
    expect(elapsed).toBeLessThan(SEARCH_LIMIT_MS);
  });

  it("toCsv genera 5 001 líneas (encabezado + 5 000 filas)", async () => {
    const rows = await listParticipants();

    const start = performance.now();
    const csv = toCsv(rows);
    console.info(`[volumen] toCsv: ${(performance.now() - start).toFixed(1)} ms`);

    expect(csv.split("\r\n")).toHaveLength(TOTAL + 1);
  });

  it("la lista de la ruleta trae los 5 000 elegibles", async () => {
    const wheel = await timed("listWheelParticipants", () => listWheelParticipants());

    expect(wheel).toHaveLength(TOTAL);
    expect(new Set(wheel.map((entry) => entry.ref)).size).toBe(TOTAL);
  });

  it("50 giros sucesivos con 5 000 elegibles terminan sin ganadores repetidos", async () => {
    await seedRegistrationStatus(false);
    const prizeId = await seedPrize({ name: "Premio de volumen", quantity: 50 });

    const winners = new Set<string>();
    await timed("50 giros", async () => {
      for (let round = 0; round < 50; round += 1) {
        const result = await spin({ prizeId }, ADMIN);
        winners.add(result.winner.ref);
      }
    });

    expect(winners.size).toBe(50);
  });
});
