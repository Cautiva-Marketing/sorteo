/** Tipos de dominio compartidos (sin dependencias de Firebase ni de React). */

export interface Participant {
  fullName: string;
  /** Celular normalizado en formato E.164 (`+51XXXXXXXXX`); coincide con el ID del documento. */
  phone: string;
  company: string;
  createdAt: Date;
  /** `null` = elegible; ID del giro (`spins`) o de la ronda antigua (`draws`) en que ganó o fue descartado. */
  drawId: string | null;
}

export interface RegistrationStatus {
  open: boolean;
  updatedAt?: Date;
  updatedBy?: string;
  dataPurgedAt?: Date;
}

/**
 * Estado público de la campaña (`GET /api/status`): solo si las inscripciones están abiertas y el
 * total de participantes. Nunca incluye datos de personas.
 */
export interface PublicStatus {
  open: boolean;
  /** Entero ≥ 0. */
  count: number;
}

/** Códigos de error de la API HTTP (ver contracts/http-api.md). */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "REGISTRATION_CLOSED"
  | "ALREADY_REGISTERED"
  | "CONFIRMATION_REQUIRED"
  | "REGISTRATION_OPEN"
  | "DRAW_CONFLICT"
  | "PRIZE_EXHAUSTED"
  | "NO_ELIGIBLE"
  | "PRIZE_HAS_HISTORY"
  | "SPIN_NOT_ACTIVE"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export type FieldErrors = Record<string, string[]>;

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

/** Fila del listado del panel: solo los campos necesarios, con el celular en 9 dígitos. */
export interface ParticipantListItem {
  fullName: string;
  /** Celular nacional de 9 dígitos. */
  phone: string;
  company: string;
  createdAt: Date;
  drawId: string | null;
}

/** Identidad del administrador autenticado. */
export interface AdminIdentity {
  uid: string;
  email: string;
}

/** Premio que se sortea: nombre único y unidades (feature 003, data-model.md). */
export interface Prize {
  id: string;
  name: string;
  /** `name` en minúsculas; garantiza nombre único sin distinguir mayúsculas. */
  nameKey: string;
  /** 1–100 unidades. */
  quantity: number;
  /** Posición en la lista; define el siguiente premio en juego. */
  order: number;
  /** Unidades con ganador activo. */
  delivered: number;
  /** Giros que alguna vez se hicieron por el premio (activos y descartados). */
  spinCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Fila de la lista de premios con las unidades pendientes ya calculadas. */
export interface PrizeView {
  id: string;
  name: string;
  quantity: number;
  order: number;
  delivered: number;
  spinCount: number;
  /** `quantity − delivered`. */
  pending: number;
  /** `pending == 0`: el premio está sorteado. */
  exhausted: boolean;
}

/** Segmento de la ruleta: solo `ref` (hash del celular) y nombre; nunca celular ni empresa. */
export interface WheelParticipant {
  ref: string;
  fullName: string;
}

/** Respuesta de un giro real (`POST /api/admin/spins`); no incluye celular ni empresa. */
export interface SpinResult {
  id: string;
  number: number;
  status: "active";
  createdAt: string;
  prize: { id: string; name: string };
  winner: { ref: string; fullName: string };
}

/** Respuesta de un giro de práctica: no se guardó nada. */
export interface PracticeResult {
  practice: true;
  winner: { ref: string; fullName: string };
}

/** Fila del historial de ganadores (giros y rondas anteriores a la feature 003). */
export interface WinnerRecord {
  /** `spins/{id}` o `draws/{id}#posición`. */
  key: string;
  number: number;
  prizeId: string | null;
  /** `null` = «Sin premio» (ronda anterior a la feature 003). */
  prizeName: string | null;
  fullName: string;
  /** Se elimina al borrar los datos de la campaña. */
  company?: string;
  /** Celular nacional de 9 dígitos; se elimina al borrar los datos de la campaña. */
  phone?: string;
  createdAt: Date;
  status: "active" | "discarded";
  createdByEmail: string;
  discardedAt: Date | null;
  discardedByEmail: string | null;
  /** `true` si viene de `draws` (no se puede descartar). */
  legacy: boolean;
}
