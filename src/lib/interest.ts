import type { Interest } from "@/types";

/** Los tres valores de interés, en el orden en que se ofrecen. */
export const INTEREST_VALUES = ["yes", "maybe", "no"] as const satisfies readonly Interest[];

const LABELS: Record<Interest, string> = { yes: "Sí", maybe: "Tal vez", no: "No" };

/** Etiqueta para la tabla del panel; `null` = el participante no respondió (registro anterior). */
export function interestLabel(value: Interest | null): string {
  return value === null ? "Sin respuesta" : LABELS[value];
}

/** Etiqueta para el CSV: igual que la de la tabla, pero vacía si no hubo respuesta. */
export function interestCsvLabel(value: Interest | null): string {
  return value === null ? "" : LABELS[value];
}

export interface InterestOption {
  value: Interest;
  label: string;
}

/** Opciones de «¿Deseas adquirir el CRM con Agente IA de Cautiva?». */
export const CRM_OPTIONS: readonly InterestOption[] = [
  { value: "yes", label: "Sí, me interesa" },
  { value: "maybe", label: "Tal vez, envíenme más información" },
  { value: "no", label: "No, por ahora" },
];

/** Opciones de «¿Te interesa un GPS satelital o una cámara para tu vehículo (Satelcom)?». */
export const GPS_OPTIONS: readonly InterestOption[] = [
  { value: "yes", label: "Sí, me interesa" },
  { value: "maybe", label: "Tal vez, envíenme una cotización" },
  { value: "no", label: "No, por ahora" },
];

/** Filtro de la tabla: todas las respuestas, una en concreto o «Sin respuesta» (`none`). */
export type InterestFilter = "all" | Interest | "none";

export interface InterestFilterOption {
  value: InterestFilter;
  label: string;
}

/**
 * Filtro del CRM: sin «Sin respuesta», porque el CRM de un participante anterior siempre es Sí o No
 * (la casilla de la feature 004).
 */
export const CRM_FILTER_OPTIONS: readonly InterestFilterOption[] = [
  { value: "all", label: "Todas" },
  { value: "yes", label: "Sí" },
  { value: "maybe", label: "Tal vez" },
  { value: "no", label: "No" },
];

/** Filtro de GPS / cámara: añade «Sin respuesta» para aislar a los participantes anteriores. */
export const GPS_FILTER_OPTIONS: readonly InterestFilterOption[] = [
  ...CRM_FILTER_OPTIONS,
  { value: "none", label: "Sin respuesta" },
];

/** `true` si una respuesta (o su ausencia, `null`) pasa el filtro elegido. */
export function matchesInterestFilter(value: Interest | null, filter: InterestFilter): boolean {
  if (filter === "all") {
    return true;
  }
  return filter === "none" ? value === null : value === filter;
}

function isInterest(value: unknown): value is Interest {
  return (INTEREST_VALUES as readonly unknown[]).includes(value);
}

/**
 * Lee el `crmInterest` guardado. Los documentos de la feature 004 lo guardaban como booleano (la
 * casilla): `true` ⇒ `yes`; `false`, ausente o cualquier otro valor ⇒ `no`.
 */
export function normalizeStoredInterest(value: unknown): Interest {
  if (isInterest(value)) {
    return value;
  }
  return value === true ? "yes" : "no";
}

/** Lee el `gpsInterest` guardado: solo los tres valores válidos; ausente u otro valor ⇒ `null`. */
export function normalizeStoredOptionalInterest(value: unknown): Interest | null {
  return isInterest(value) ? value : null;
}
