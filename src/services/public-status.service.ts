import "server-only";
import type { PublicStatus } from "@/types";
import { countParticipants } from "@/services/participants.service";
import { getRegistrationStatus } from "@/services/registration-status.service";

/** Vigencia de la memoria por instancia: acota las lecturas a Firestore sin retrasar el contador. */
const TTL_MS = 1000;

interface CacheEntry {
  expiresAt: number;
  value: Promise<PublicStatus>;
}

let cache: CacheEntry | null = null;

async function readPublicStatus(): Promise<PublicStatus> {
  const [status, count] = await Promise.all([getRegistrationStatus(), countParticipants()]);
  return { open: status.open, count };
}

/**
 * Estado público de la campaña: si las inscripciones están abiertas y cuántos participantes hay.
 * Se memoriza 1 s por instancia y se comparte la lectura en curso entre peticiones simultáneas;
 * un error no se guarda en la memoria.
 */
export function getPublicStatus(): Promise<PublicStatus> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  const value = readPublicStatus();
  const entry: CacheEntry = { expiresAt: now + TTL_MS, value };
  cache = entry;
  value.catch(() => {
    if (cache === entry) {
      cache = null;
    }
  });
  return value;
}

/**
 * Descarta la memoria. Lo llaman los Route Handlers de administrador tras abrir o cerrar las
 * inscripciones y tras el borrado definitivo, para que esa instancia lo refleje de inmediato.
 * (Los servicios no importan este módulo: la dependencia va en un solo sentido.)
 */
export function invalidatePublicStatus(): void {
  cache = null;
}
