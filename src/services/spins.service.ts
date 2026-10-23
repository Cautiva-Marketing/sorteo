import "server-only";
import { FieldValue, Timestamp, type QuerySnapshot } from "firebase-admin/firestore";
import { participantRef, pickWinners, type RandomInt } from "@/lib/draw";
import type { SpinRequestInput } from "@/lib/validation/schemas";
import type {
  AdminIdentity,
  PracticeResult,
  SpinResult,
  WheelParticipant,
  WinnerRecord,
} from "@/types";
import { getDb } from "@/services/firebase/admin";
import { PrizeNotFoundError } from "@/services/prizes.service";

export { PrizeNotFoundError };

export const PARTICIPANTS_COLLECTION = "participants";
export const PRIZES_COLLECTION = "prizes";
export const SPINS_COLLECTION = "spins";
export const DRAWS_COLLECTION = "draws";
export const SETTINGS_COLLECTION = "settings";
export const DRAW_COUNTER_DOC = "draw";
export const REGISTRATION_DOC = "registration";

/** El premio ya entregó todas sus unidades (FR-073, FR-072). */
export class PrizeExhaustedError extends Error {
  constructor() {
    super("El premio ya no tiene unidades pendientes.");
    this.name = "PrizeExhaustedError";
  }
}

/** No quedan participantes elegibles (todos ganaron, fueron descartados o se borraron los datos). */
export class NoEligibleError extends Error {
  constructor() {
    super("No hay participantes elegibles para sortear.");
    this.name = "NoEligibleError";
  }
}

/** Otro giro simultáneo se llevó al participante elegido tras reintentar. */
export class DrawConflictError extends Error {
  constructor() {
    super("Otro giro se estaba ejecutando al mismo tiempo. Inténtalo de nuevo.");
    this.name = "DrawConflictError";
  }
}

/** El giro indicado no existe. */
export class SpinNotFoundError extends Error {
  constructor() {
    super("El giro no existe.");
    this.name = "SpinNotFoundError";
  }
}

/** El giro ya estaba descartado (no hay reactivación, FR-079). */
export class SpinNotActiveError extends Error {
  constructor() {
    super("Este ganador ya estaba descartado.");
    this.name = "SpinNotActiveError";
  }
}

export function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

/**
 * Ganadores de las rondas de la feature 001 (`draws`, solo lectura): un `WinnerRecord` por cada
 * elemento de `winners`, numerados 1…k por fecha de ronda y posición (research D-203). Como
 * `draws` es inmutable —el borrado definitivo conserva la cantidad de ganadores— la numeración es
 * estable. `company` y `phone` faltan tras el borrado definitivo.
 */
export async function readLegacyWinners(): Promise<WinnerRecord[]> {
  const snapshot = await getDb().collection(DRAWS_COLLECTION).orderBy("createdAt", "asc").get();
  const records: WinnerRecord[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const createdBy = (data.createdBy ?? {}) as Record<string, unknown>;
    const winners: unknown[] = Array.isArray(data.winners) ? data.winners : [];
    winners.forEach((entry, position) => {
      const item = (typeof entry === "object" && entry !== null ? entry : {}) as Record<
        string,
        unknown
      >;
      const record: WinnerRecord = {
        key: `${doc.id}#${position}`,
        number: records.length + 1,
        prizeId: null,
        prizeName: null,
        fullName: String(item.fullName ?? ""),
        createdAt: toDate(data.createdAt) ?? new Date(0),
        status: "active",
        createdByEmail: String(createdBy.email ?? ""),
        discardedAt: null,
        discardedByEmail: null,
        legacy: true,
      };
      if (typeof item.company === "string") {
        record.company = item.company;
      }
      if (typeof item.phone === "string") {
        record.phone = item.phone;
      }
      records.push(record);
    });
  }
  return records;
}

/** Intentos máximos cuando otro giro simultáneo se lleva al participante elegido. */
const MAX_ATTEMPTS = 3;

/** El participante elegido ya ganó en otro giro simultáneo (se reintenta con la lista nueva). */
class StaleWinnerError extends Error {
  constructor() {
    super("El participante elegido cambió durante el giro.");
    this.name = "StaleWinnerError";
  }
}

export interface SpinOptions {
  /** Generador de enteros uniformes; solo se inyecta en pruebas. */
  randomInt?: RandomInt;
}

/** Ids (celular E.164) de los participantes elegibles: los que aún no tienen `drawId`. */
async function listEligibleIds(): Promise<string[]> {
  const snapshot = await getDb()
    .collection(PARTICIPANTS_COLLECTION)
    .where("drawId", "==", null)
    .select()
    .get();
  return snapshot.docs.map((doc) => doc.id);
}

/**
 * Datos de la ruleta: solo los elegibles, como `{ ref, fullName }` y ordenados por `ref`. El `ref`
 * es un hash del celular: no se envía el número a una vista que se proyecta (research D-207).
 */
export async function listWheelParticipants(): Promise<WheelParticipant[]> {
  const snapshot = await getDb()
    .collection(PARTICIPANTS_COLLECTION)
    .where("drawId", "==", null)
    .select("fullName")
    .get();
  return snapshot.docs
    .map((doc) => ({ ref: participantRef(doc.id), fullName: String(doc.data().fullName ?? "") }))
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}

/**
 * Giro de práctica (FR-090): elige un elegible con el mismo azar que un giro real y lo devuelve,
 * pero **no escribe nada** (ni ganador, ni número, ni cambios en premios, participantes o
 * inscripciones).
 */
export async function practiceSpin(options: SpinOptions = {}): Promise<PracticeResult> {
  const eligibleIds = await listEligibleIds();
  if (eligibleIds.length === 0) {
    throw new NoEligibleError();
  }
  const [chosenId] = pickWinners(eligibleIds, 1, options.randomInt);
  const id = chosenId as string;
  const snapshot = await getDb().collection(PARTICIPANTS_COLLECTION).doc(id).get();
  return {
    practice: true,
    winner: { ref: participantRef(id), fullName: String(snapshot.data()?.fullName ?? "") },
  };
}

/** Cantidad de ganadores de las rondas antiguas (`draws`): semilla del contador (research D-203). */
function countLegacyWinners(draws: QuerySnapshot): number {
  let total = 0;
  for (const doc of draws.docs) {
    const winners: unknown = doc.data().winners;
    total += Array.isArray(winners) ? winners.length : 0;
  }
  return total;
}

interface CommittedSpin {
  id: string;
  number: number;
  prizeName: string;
  fullName: string;
}

/**
 * Una sola transacción (research D-204): lee premio, contador, inscripciones y participante;
 * comprueba unidades y que el elegido siga sin ganar; y escribe giro, `drawId`, contadores del
 * premio y del evento y, si las inscripciones siguen abiertas, su cierre (FR-107): ese cierre es
 * atómico con el giro, así que un giro que falla las deja abiertas.
 */
async function commitSpin(
  prizeId: string,
  chosenId: string,
  admin: AdminIdentity,
): Promise<CommittedSpin> {
  const db = getDb();
  const prizeRef = db.collection(PRIZES_COLLECTION).doc(prizeId);
  const counterRef = db.collection(SETTINGS_COLLECTION).doc(DRAW_COUNTER_DOC);
  const registrationRef = db.collection(SETTINGS_COLLECTION).doc(REGISTRATION_DOC);
  const chosenRef = db.collection(PARTICIPANTS_COLLECTION).doc(chosenId);
  const spinRef = db.collection(SPINS_COLLECTION).doc();

  return db.runTransaction(async (transaction) => {
    const [prizeSnap, counterSnap, registrationSnap, participantSnap] = await transaction.getAll(
      prizeRef,
      counterRef,
      registrationRef,
      chosenRef,
    );

    const prize = prizeSnap.data();
    if (!prizeSnap.exists || !prize) {
      throw new PrizeNotFoundError();
    }
    if (Number(prize.delivered ?? 0) >= Number(prize.quantity ?? 0)) {
      throw new PrizeExhaustedError();
    }

    const registrationOpen = !registrationSnap.exists || registrationSnap.data()?.open !== false;

    const participant = participantSnap.data();
    if (!participantSnap.exists || !participant || participant.drawId !== null) {
      throw new StaleWinnerError();
    }

    const storedNumber: unknown = counterSnap.data()?.nextNumber;
    const number =
      typeof storedNumber === "number"
        ? storedNumber
        : countLegacyWinners(await transaction.get(db.collection(DRAWS_COLLECTION))) + 1;

    const fullName = String(participant.fullName ?? "");
    transaction.create(spinRef, {
      number,
      prizeId,
      winner: {
        fullName,
        company: String(participant.company ?? ""),
        // E.164 (feature 004); los giros y rondas anteriores guardan 9 dígitos, que se leen como Perú.
        phone: String(participant.phone ?? participantSnap.id),
      },
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: { uid: admin.uid, email: admin.email },
      discardedAt: null,
      discardedBy: null,
      purgedAt: null,
    });
    transaction.update(chosenRef, { drawId: spinRef.id });
    transaction.update(prizeRef, {
      delivered: Number(prize.delivered ?? 0) + 1,
      spinCount: Number(prize.spinCount ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      counterRef,
      { nextNumber: number + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    if (registrationOpen) {
      transaction.set(
        registrationRef,
        { open: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: admin.uid },
        { merge: true },
      );
    }
    return { id: spinRef.id, number, prizeName: String(prize.name ?? ""), fullName };
  });
}

/**
 * Gira por un premio (FR-064, FR-065, FR-072, FR-106, FR-107): elige un ganador al azar entre los
 * elegibles y lo guarda **antes** de responder. Un giro concurrente que se lleve al elegido hace
 * reintentar hasta 3 veces (`DrawConflictError` después); uno que se lleve la última unidad del
 * premio hace lanzar `PrizeExhaustedError`. El primer giro real cierra las inscripciones dentro de
 * la misma transacción, sin pedir confirmación. La respuesta no incluye celular ni empresa.
 */
export async function spin(
  { prizeId }: SpinRequestInput,
  admin: AdminIdentity,
  options: SpinOptions = {},
): Promise<SpinResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const eligibleIds = await listEligibleIds();
    if (eligibleIds.length === 0) {
      throw new NoEligibleError();
    }
    const [chosen] = pickWinners(eligibleIds, 1, options.randomInt);
    const chosenId = chosen as string;

    try {
      const committed = await commitSpin(prizeId, chosenId, admin);
      const saved = await getDb().collection(SPINS_COLLECTION).doc(committed.id).get();
      const createdAt = toDate(saved.data()?.createdAt) ?? new Date();
      return {
        id: committed.id,
        number: committed.number,
        status: "active",
        createdAt: createdAt.toISOString(),
        prize: { id: prizeId, name: committed.prizeName },
        winner: { ref: participantRef(chosenId), fullName: committed.fullName },
      };
    } catch (error) {
      if (!(error instanceof StaleWinnerError)) {
        throw error;
      }
    }
  }
  throw new DrawConflictError();
}

/**
 * Historial de ganadores, del número más alto al más bajo (FR-082, FR-083): los giros y, como
 * «Sin premio», los ganadores de las rondas de la feature 001 (`draws`, solo lectura).
 */
export async function listWinnerRecords(): Promise<WinnerRecord[]> {
  const [spinRecords, legacyRecords] = await Promise.all([listSpinRecords(), readLegacyWinners()]);
  return [...spinRecords, ...legacyRecords].sort((a, b) => b.number - a.number);
}

/** Solo los giros (`spins`), con el nombre del premio leído de `prizes`. */
async function listSpinRecords(): Promise<WinnerRecord[]> {
  const db = getDb();
  const [spins, prizes] = await Promise.all([
    db.collection(SPINS_COLLECTION).orderBy("number", "desc").get(),
    db.collection(PRIZES_COLLECTION).get(),
  ]);
  const prizeNames = new Map(prizes.docs.map((doc) => [doc.id, String(doc.data().name ?? "")]));

  return spins.docs.map((doc): WinnerRecord => {
    const data = doc.data();
    const winner = (data.winner ?? {}) as Record<string, unknown>;
    const createdBy = (data.createdBy ?? {}) as Record<string, unknown>;
    const discardedBy = (data.discardedBy ?? null) as Record<string, unknown> | null;
    const prizeId = typeof data.prizeId === "string" ? data.prizeId : null;
    const record: WinnerRecord = {
      key: doc.id,
      number: Number(data.number ?? 0),
      prizeId,
      prizeName: prizeId === null ? null : (prizeNames.get(prizeId) ?? null),
      fullName: String(winner.fullName ?? ""),
      createdAt: toDate(data.createdAt) ?? new Date(0),
      status: data.status === "discarded" ? "discarded" : "active",
      createdByEmail: String(createdBy.email ?? ""),
      discardedAt: toDate(data.discardedAt),
      discardedByEmail: discardedBy ? String(discardedBy.email ?? "") : null,
      legacy: false,
    };
    if (typeof winner.company === "string") {
      record.company = winner.company;
    }
    if (typeof winner.phone === "string") {
      record.phone = winner.phone;
    }
    return record;
  });
}

export interface DiscardedSpin {
  id: string;
  number: number;
  status: "discarded";
  discardedAt: Date;
}

/**
 * Descarta a un ganador ausente (FR-078): marca el giro como `discarded` con quién y cuándo y
 * devuelve la unidad al premio. **No** toca `participants.drawId`, así que la persona sigue fuera
 * de la ruleta; no existe operación inversa (FR-079). Una sola transacción.
 */
export async function discardSpin(spinId: string, admin: AdminIdentity): Promise<DiscardedSpin> {
  const db = getDb();
  const spinRef = db.collection(SPINS_COLLECTION).doc(spinId);

  const committed = await db.runTransaction(async (transaction) => {
    const spinSnap = await transaction.get(spinRef);
    const data = spinSnap.data();
    if (!spinSnap.exists || !data) {
      throw new SpinNotFoundError();
    }
    if (data.status !== "active") {
      throw new SpinNotActiveError();
    }
    const prizeRef = db.collection(PRIZES_COLLECTION).doc(String(data.prizeId));
    const prizeSnap = await transaction.get(prizeRef);

    transaction.update(spinRef, {
      status: "discarded",
      discardedAt: FieldValue.serverTimestamp(),
      discardedBy: { uid: admin.uid, email: admin.email },
    });
    if (prizeSnap.exists) {
      transaction.update(prizeRef, {
        delivered: Math.max(Number(prizeSnap.data()?.delivered ?? 0) - 1, 0),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return Number(data.number ?? 0);
  });

  const saved = await spinRef.get();
  return {
    id: spinId,
    number: committed,
    status: "discarded",
    discardedAt: toDate(saved.data()?.discardedAt) ?? new Date(),
  };
}

export interface WinnerInfo {
  prizeName: string | null;
  number: number;
  status: "active" | "discarded";
}

export interface WinnerLookup {
  /** Clave = `participants.drawId` de un giro (id del giro). */
  bySpinId: Map<string, WinnerInfo>;
  /** Clave = celular de 9 dígitos de un ganador de una ronda antigua (comparten el `drawId`). */
  byLegacyPhone: Map<string, WinnerInfo>;
}

/**
 * Premio, número y estado de cada ganador, para unirlos con la lista de participantes en el CSV
 * (FR-084). Los ganadores antiguos solo se pueden resolver por celular mientras exista.
 */
export async function getWinnerLookup(): Promise<WinnerLookup> {
  const lookup: WinnerLookup = { bySpinId: new Map(), byLegacyPhone: new Map() };
  for (const record of await listWinnerRecords()) {
    const info: WinnerInfo = {
      prizeName: record.prizeName,
      number: record.number,
      status: record.status,
    };
    if (!record.legacy) {
      lookup.bySpinId.set(record.key, info);
    } else if (record.phone !== undefined) {
      lookup.byLegacyPhone.set(record.phone, info);
    }
  }
  return lookup;
}
