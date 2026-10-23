/**
 * Repara la coherencia entre `participants`, `spins`, `prizes` y `settings/draw` tras borrar giros
 * a mano en la consola de Firebase.
 *
 * Uso: npm run admin:repair            (solo informa)
 *      npm run admin:repair -- --apply (escribe los cambios)
 *
 * - Participantes con `drawId` que ya no existe en `spins` ni en `draws` (o sin el campo) vuelven a
 *   ser elegibles (`drawId: null`).
 * - Cada premio recalcula `delivered` (giros activos) y `spinCount` (todos sus giros).
 * - `settings/draw.nextNumber` pasa a ser el mayor número en uso + 1.
 * - Solo imprime conteos: nunca nombres ni celulares.
 * - Con `FIRESTORE_EMULATOR_HOST` apunta al emulador; si no, usa la cuenta de servicio de
 *   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` (entorno o `.env.local`).
 */
import { existsSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function loadLocalEnv(): void {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
}

function initApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: projectId ?? "demo-sorteo" });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY (o define FIRESTORE_EMULATOR_HOST para usar el emulador).",
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

interface PrizeTotals {
  delivered: number;
  spinCount: number;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  loadLocalEnv();
  const db = getFirestore(initApp());

  const [spins, draws, participants, prizes] = await Promise.all([
    db.collection("spins").get(),
    db.collection("draws").get(),
    db.collection("participants").select("drawId").get(),
    db.collection("prizes").get(),
  ]);

  const knownDrawIds = new Set<string>([...spins.docs, ...draws.docs].map((doc) => doc.id));

  let legacyWinners = 0;
  for (const doc of draws.docs) {
    const winners: unknown = doc.data().winners;
    legacyWinners += Array.isArray(winners) ? winners.length : 0;
  }

  let highestNumber = legacyWinners;
  const totals = new Map<string, PrizeTotals>();
  for (const doc of spins.docs) {
    const data = doc.data();
    highestNumber = Math.max(highestNumber, Number(data.number ?? 0));
    if (typeof data.prizeId === "string") {
      const current = totals.get(data.prizeId) ?? { delivered: 0, spinCount: 0 };
      current.spinCount += 1;
      if (data.status === "active") {
        current.delivered += 1;
      }
      totals.set(data.prizeId, current);
    }
  }

  const orphans = participants.docs.filter((doc) => {
    const drawId: unknown = doc.data().drawId;
    return drawId === undefined || (typeof drawId === "string" && !knownDrawIds.has(drawId));
  });

  const prizeFixes = prizes.docs.flatMap((doc) => {
    const data = doc.data();
    const expected = totals.get(doc.id) ?? { delivered: 0, spinCount: 0 };
    const changed =
      Number(data.delivered ?? 0) !== expected.delivered ||
      Number(data.spinCount ?? 0) !== expected.spinCount;
    return changed ? [{ ref: doc.ref, expected }] : [];
  });

  const nextNumber = highestNumber + 1;
  const counterRef = db.collection("settings").doc("draw");
  const counterSnap = await counterRef.get();
  const counterChanged = counterSnap.data()?.nextNumber !== nextNumber;

  console.log(`Participantes: ${participants.size}`);
  console.log(`  con ganador inexistente (vuelven a la ruleta): ${orphans.length}`);
  console.log(`Giros: ${spins.size} · rondas antiguas: ${draws.size}`);
  console.log(`Premios a corregir: ${prizeFixes.length} de ${prizes.size}`);
  console.log(`Siguiente número de ganador: ${nextNumber}${counterChanged ? " (cambia)" : ""}`);

  if (!apply) {
    console.log("Sin cambios (modo informe). Repite con --apply para escribirlos.");
    return;
  }

  const writer = db.bulkWriter();
  for (const doc of orphans) {
    void writer.update(doc.ref, { drawId: null });
  }
  for (const { ref, expected } of prizeFixes) {
    void writer.update(ref, { ...expected, updatedAt: FieldValue.serverTimestamp() });
  }
  if (counterChanged) {
    void writer.set(
      counterRef,
      { nextNumber, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  await writer.close();
  console.log("Cambios aplicados.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
