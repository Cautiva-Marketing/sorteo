import { createHash, randomInt as cryptoRandomInt } from "node:crypto";

/** Entero uniforme en `[min, max)`. */
export type RandomInt = (min: number, max: number) => number;

/**
 * Elige `count` ids distintos de `ids` con igual probabilidad (Fisher-Yates parcial). Trabaja
 * sobre una copia: no modifica la entrada. El generador es inyectable para las pruebas; por
 * defecto usa `crypto.randomInt` (aleatoriedad criptográfica, research D-008).
 */
export function pickWinners(
  ids: readonly string[],
  count: number,
  randomInt: RandomInt = cryptoRandomInt,
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > ids.length) {
    throw new RangeError(`La cantidad de ganadores debe estar entre 1 y ${ids.length}.`);
  }

  const pool = [...ids];
  for (let index = 0; index < count; index += 1) {
    const chosen = randomInt(index, pool.length);
    const current = pool[index] as string;
    pool[index] = pool[chosen] as string;
    pool[chosen] = current;
  }
  return pool.slice(0, count);
}

/**
 * Referencia opaca de un participante para la ruleta: primeros 16 caracteres hexadecimales del
 * SHA-256 del id del documento. Identifica el segmento sin enviar el celular a una vista que se
 * proyecta (research D-207).
 */
export function participantRef(participantId: string): string {
  return createHash("sha256").update(participantId).digest("hex").slice(0, 16);
}
