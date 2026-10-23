import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { RegistrationStatus } from "@/types";
import { getDb } from "@/services/firebase/admin";

const SETTINGS_COLLECTION = "settings";
const REGISTRATION_DOC = "registration";

function registrationRef() {
  return getDb().collection(SETTINGS_COLLECTION).doc(REGISTRATION_DOC);
}

function toDate(value: unknown): Date | undefined {
  return value instanceof Timestamp ? value.toDate() : undefined;
}

/**
 * Lee el estado de las inscripciones. Si el documento `settings/registration` no existe se
 * interpreta como abiertas (`open: true`).
 */
export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const snapshot = await registrationRef().get();
  if (!snapshot.exists) {
    return { open: true };
  }
  const data = snapshot.data() ?? {};
  const updatedBy: unknown = data.updatedBy;
  return {
    open: data.open !== false,
    updatedAt: toDate(data.updatedAt),
    updatedBy: typeof updatedBy === "string" ? updatedBy : undefined,
    dataPurgedAt: toDate(data.dataPurgedAt),
  };
}

/**
 * Abre o cierra las inscripciones (solo administradores; la autorización la verifica el
 * Route Handler). Conserva `dataPurgedAt` y devuelve el estado resultante.
 */
export async function setRegistrationOpen(
  open: boolean,
  adminUid: string,
): Promise<RegistrationStatus> {
  await registrationRef().set(
    { open, updatedAt: FieldValue.serverTimestamp(), updatedBy: adminUid },
    { merge: true },
  );
  return getRegistrationStatus();
}
