import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { PrizeInput } from "@/lib/validation/schemas";
import type { PrizeView } from "@/types";
import { getDb } from "@/services/firebase/admin";

const PRIZES_COLLECTION = "prizes";
const SETTINGS_COLLECTION = "settings";
const DRAW_COUNTER_DOC = "draw";

/** Ya existe otro premio con ese nombre (sin distinguir mayúsculas, FR-060). */
export class DuplicatePrizeNameError extends Error {
  constructor() {
    super("Ya existe un premio con ese nombre.");
    this.name = "DuplicatePrizeNameError";
  }
}

/** La cantidad pedida es menor que las unidades ya entregadas (FR-061). */
export class QuantityBelowDeliveredError extends Error {
  readonly delivered: number;

  constructor(delivered: number) {
    super(`No puede ser menor que las unidades ya entregadas (${delivered}).`);
    this.name = "QuantityBelowDeliveredError";
    this.delivered = delivered;
  }
}

/** El premio tiene ganadores (activos o descartados) y no se puede eliminar (FR-061). */
export class PrizeHasHistoryError extends Error {
  constructor() {
    super("Este premio ya tiene ganadores y no se puede eliminar.");
    this.name = "PrizeHasHistoryError";
  }
}

/** El premio indicado no existe. */
export class PrizeNotFoundError extends Error {
  constructor() {
    super("El premio no existe.");
    this.name = "PrizeNotFoundError";
  }
}

/** La lista de orden no coincide con los premios existentes. */
export class PrizeOrderMismatchError extends Error {
  constructor() {
    super("La lista de premios no coincide con los premios existentes.");
    this.name = "PrizeOrderMismatchError";
  }
}

function prizesCollection() {
  return getDb().collection(PRIZES_COLLECTION);
}

function counterRef() {
  return getDb().collection(SETTINGS_COLLECTION).doc(DRAW_COUNTER_DOC);
}

/** Clave de unicidad: el nombre en minúsculas (ya viene normalizado por el esquema). */
function nameKeyOf(name: string): string {
  return name.toLowerCase();
}

function toPrizeView(id: string, data: Record<string, unknown>): PrizeView {
  const quantity = Number(data.quantity ?? 0);
  const delivered = Number(data.delivered ?? 0);
  return {
    id,
    name: String(data.name ?? ""),
    quantity,
    order: Number(data.order ?? 0),
    delivered,
    spinCount: Number(data.spinCount ?? 0),
    pending: Math.max(quantity - delivered, 0),
    exhausted: quantity - delivered <= 0,
  };
}

/** Lista los premios por `order` (FR-062: con unidades entregadas y pendientes). */
export async function listPrizes(): Promise<PrizeView[]> {
  const snapshot = await prizesCollection().orderBy("order", "asc").get();
  return snapshot.docs.map((doc) => toPrizeView(doc.id, doc.data()));
}

/**
 * Crea un premio con `order = máximo + 1`. La transacción lee y escribe `settings/draw` para
 * serializar altas y renombres: dos altas simultáneas del mismo nombre no pueden crearse las dos
 * (research D-214).
 */
export async function createPrize(input: PrizeInput, adminUid: string): Promise<PrizeView> {
  const db = getDb();
  const prizeRef = prizesCollection().doc();
  const nameKey = nameKeyOf(input.name);

  const order = await db.runTransaction(async (transaction) => {
    await transaction.get(counterRef());
    const duplicate = await transaction.get(
      prizesCollection().where("nameKey", "==", nameKey).limit(1),
    );
    if (!duplicate.empty) {
      throw new DuplicatePrizeNameError();
    }
    const last = await transaction.get(prizesCollection().orderBy("order", "desc").limit(1));
    const nextOrder = last.empty ? 1 : Number(last.docs[0]?.data().order ?? 0) + 1;

    transaction.set(
      counterRef(),
      { updatedAt: FieldValue.serverTimestamp(), updatedBy: adminUid },
      { merge: true },
    );
    transaction.create(prizeRef, {
      name: input.name,
      nameKey,
      quantity: input.quantity,
      order: nextOrder,
      delivered: 0,
      spinCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return nextOrder;
  });

  return toPrizeView(prizeRef.id, {
    name: input.name,
    quantity: input.quantity,
    order,
    delivered: 0,
    spinCount: 0,
  });
}

/**
 * Edita nombre y cantidad. El nombre puede coincidir con el propio; `quantity` no puede quedar
 * por debajo de las unidades entregadas (ganadores activos).
 */
export async function updatePrize(id: string, input: PrizeInput): Promise<PrizeView> {
  const db = getDb();
  const prizeRef = prizesCollection().doc(id);
  const nameKey = nameKeyOf(input.name);

  return db.runTransaction(async (transaction) => {
    await transaction.get(counterRef());
    const snapshot = await transaction.get(prizeRef);
    const current = snapshot.data();
    if (!snapshot.exists || !current) {
      throw new PrizeNotFoundError();
    }
    const duplicates = await transaction.get(
      prizesCollection().where("nameKey", "==", nameKey).limit(2),
    );
    if (duplicates.docs.some((doc) => doc.id !== id)) {
      throw new DuplicatePrizeNameError();
    }
    const delivered = Number(current.delivered ?? 0);
    if (input.quantity < delivered) {
      throw new QuantityBelowDeliveredError(delivered);
    }

    transaction.set(counterRef(), { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.update(prizeRef, {
      name: input.name,
      nameKey,
      quantity: input.quantity,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return toPrizeView(id, { ...current, name: input.name, quantity: input.quantity });
  });
}

/** Elimina un premio solo si nunca tuvo giros (`spinCount == 0`). */
export async function deletePrize(id: string): Promise<void> {
  const prizeRef = prizesCollection().doc(id);
  await getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(prizeRef);
    if (!snapshot.exists) {
      throw new PrizeNotFoundError();
    }
    if (Number(snapshot.data()?.spinCount ?? 0) > 0) {
      throw new PrizeHasHistoryError();
    }
    transaction.delete(prizeRef);
  });
}

/**
 * Reescribe `order = índice` con la lista completa de ids. La lista debe ser exactamente el
 * conjunto de premios existentes, sin repetidos.
 */
export async function reorderPrizes(ids: readonly string[]): Promise<void> {
  await getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(prizesCollection());
    const existing = new Set(snapshot.docs.map((doc) => doc.id));
    const requested = new Set(ids);
    if (
      requested.size !== ids.length ||
      requested.size !== existing.size ||
      ids.some((id) => !existing.has(id))
    ) {
      throw new PrizeOrderMismatchError();
    }
    ids.forEach((id, index) => {
      transaction.update(prizesCollection().doc(id), {
        order: index,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  });
}
