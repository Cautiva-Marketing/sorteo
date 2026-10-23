import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { RegistrationInput } from "@/lib/validation/schemas";
import type { ParticipantListItem } from "@/types";
import { getDb } from "@/services/firebase/admin";

/** Las inscripciones están cerradas (`settings/registration.open === false`). */
export class RegistrationClosedError extends Error {
  constructor() {
    super("Las inscripciones están cerradas.");
    this.name = "RegistrationClosedError";
  }
}

/** El celular ya está registrado (no incluye datos del registro existente). */
export class AlreadyRegisteredError extends Error {
  constructor() {
    super("Este celular ya está participando.");
    this.name = "AlreadyRegisteredError";
  }
}

/** Código gRPC 6 (`ALREADY_EXISTS`) que devuelve Firestore al crear un documento existente. */
const GRPC_ALREADY_EXISTS = 6;

function isAlreadyExists(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === GRPC_ALREADY_EXISTS || error.code === "already-exists";
}

const PARTICIPANTS_COLLECTION = "participants";
const SETTINGS_COLLECTION = "settings";
const REGISTRATION_DOC = "registration";

/**
 * Registra un participante. En una sola transacción comprueba que las inscripciones estén
 * abiertas y crea `participants/{phone}` (el celular E.164 de cualquier país es el ID del documento). Solo se
 * guardan los campos del modelo de datos (minimización).
 */
export async function registerParticipant(input: RegistrationInput): Promise<void> {
  const db = getDb();
  const settingsRef = db.collection(SETTINGS_COLLECTION).doc(REGISTRATION_DOC);
  const participantRef = db.collection(PARTICIPANTS_COLLECTION).doc(input.phone);

  try {
    await db.runTransaction(async (transaction) => {
      const settings = await transaction.get(settingsRef);
      // Si el documento no existe, las inscripciones se consideran abiertas.
      if (settings.exists && settings.data()?.open === false) {
        throw new RegistrationClosedError();
      }

      transaction.create(participantRef, {
        fullName: input.fullName,
        phone: input.phone,
        company: input.company,
        crmInterest: input.crmInterest,
        createdAt: FieldValue.serverTimestamp(),
        drawId: null,
      });
    });
  } catch (error) {
    // Unicidad garantizada por la base de datos: el ID del documento es el celular.
    if (isAlreadyExists(error)) {
      throw new AlreadyRegisteredError();
    }
    throw error;
  }
}

/** Convierte una marca de tiempo de Firestore en `Date` (época Unix si faltara el campo). */
function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

/**
 * Lista todos los participantes, del más reciente al más antiguo (FR-016). Devuelve solo los
 * campos que muestra el panel; el celular se entrega en E.164 y cualquier otro campo que
 * traiga un documento anterior (p. ej. `consent`) no sale de esta capa.
 */
export async function listParticipants(): Promise<ParticipantListItem[]> {
  const snapshot = await getDb()
    .collection(PARTICIPANTS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const drawId: unknown = data.drawId;
    return {
      fullName: String(data.fullName ?? ""),
      phone: String(data.phone ?? doc.id),
      company: String(data.company ?? ""),
      crmInterest: data.crmInterest === true,
      createdAt: toDate(data.createdAt),
      drawId: typeof drawId === "string" ? drawId : null,
    };
  });
}

/** Total de participantes con la agregación `count()` (no descarga los documentos). */
export async function countParticipants(): Promise<number> {
  const snapshot = await getDb().collection(PARTICIPANTS_COLLECTION).count().get();
  return snapshot.data().count;
}

/** Las inscripciones siguen abiertas: no se pueden borrar los datos de la campaña (FR-030). */
export class RegistrationOpenError extends Error {
  constructor() {
    super("Cierra primero las inscripciones.");
    this.name = "RegistrationOpenError";
  }
}

const DRAWS_COLLECTION = "draws";
const SPINS_COLLECTION = "spins";

/** Participantes que se eliminan por lote; el `BulkWriter` agrupa y reintenta las escrituras. */
const PURGE_PAGE_SIZE = 500;

/** `winners` reducido a `{ fullName }` y si hubo que quitar algún campo (celular, empresa…). */
function reduceWinners(value: unknown): { winners: Array<{ fullName: string }>; changed: boolean } {
  const entries: unknown[] = Array.isArray(value) ? value : [];
  let changed = false;
  const winners = entries.map((entry) => {
    const item = (typeof entry === "object" && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    if (Object.keys(item).some((key) => key !== "fullName")) {
      changed = true;
    }
    return { fullName: String(item.fullName ?? "") };
  });
  return { winners, changed };
}

/**
 * Evita un rechazo sin manejar mientras el `BulkWriter` sigue trabajando: el error se vuelve a
 * lanzar al esperar la promesa original con `Promise.all`.
 */
function tracked<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

/**
 * Borra definitivamente los datos personales de la campaña (FR-030, FR-031). Solo con las
 * inscripciones cerradas (`RegistrationOpenError` si siguen abiertas o si la configuración aún no
 * existe, que equivale a abiertas). Pasos, en este orden y reintentables sin duplicar efectos:
 *
 * 1. cada `draws/{id}` (rondas de la feature 001) y cada `spins/{id}` (feature 003) conserva solo
 *    `{ fullName }` por ganador y fija `purgedAt` (si ya tenía, se conserva el original); del giro
 *    se mantienen número, premio, estado y fechas (FR-086);
 * 2. se eliminan todos los `participants` con `BulkWriter`, por lotes;
 * 3. se fija `settings/registration.dataPurgedAt`.
 *
 * Devuelve cuántos participantes eliminó esta ejecución (0 si ya estaba todo borrado).
 */
export async function purgeAllParticipantData(adminUid: string): Promise<number> {
  const db = getDb();
  const settingsRef = db.collection(SETTINGS_COLLECTION).doc(REGISTRATION_DOC);

  const settings = await settingsRef.get();
  if (!settings.exists || settings.data()?.open !== false) {
    throw new RegistrationOpenError();
  }

  // 1) Rondas antiguas y giros: los ganadores quedan solo con el nombre.
  const draws = await db.collection(DRAWS_COLLECTION).get();
  const drawWriter = db.bulkWriter();
  const drawWrites: Array<Promise<unknown>> = [];
  for (const draw of draws.docs) {
    const data = draw.data();
    const { winners, changed } = reduceWinners(data.winners);
    if (changed || data.purgedAt == null) {
      drawWrites.push(
        tracked(
          drawWriter.update(draw.ref, {
            winners,
            purgedAt: data.purgedAt ?? FieldValue.serverTimestamp(),
          }),
        ),
      );
    }
  }

  const spins = await db.collection(SPINS_COLLECTION).get();
  for (const spinDoc of spins.docs) {
    const data = spinDoc.data();
    const { winners, changed } = reduceWinners([data.winner]);
    if (changed || data.purgedAt == null) {
      drawWrites.push(
        tracked(
          drawWriter.update(spinDoc.ref, {
            winner: winners[0],
            purgedAt: data.purgedAt ?? FieldValue.serverTimestamp(),
          }),
        ),
      );
    }
  }
  await drawWriter.close();
  await Promise.all(drawWrites);

  // 2) Participantes: páginas de ids (sin descargar los datos) borradas con BulkWriter.
  let deleted = 0;
  const participantWriter = db.bulkWriter();
  for (;;) {
    const page = await db.collection(PARTICIPANTS_COLLECTION).select().limit(PURGE_PAGE_SIZE).get();
    if (page.empty) {
      break;
    }
    const writes = page.docs.map((doc) => tracked(participantWriter.delete(doc.ref)));
    await participantWriter.flush();
    await Promise.all(writes);
    deleted += page.size;
  }
  await participantWriter.close();

  // 3) Marca de borrado en la configuración de la campaña.
  await settingsRef.set(
    {
      dataPurgedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminUid,
    },
    { merge: true },
  );

  return deleted;
}
