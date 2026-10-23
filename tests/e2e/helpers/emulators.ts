/**
 * Utilidades E2E que hablan con los emuladores de Firebase por su API REST (sin SDK de Firebase).
 * Se autentican con el token especial `owner`, que el emulador acepta para saltarse las reglas.
 */
import type { Interest } from "@/types";

const PROJECT_ID = "demo-sorteo";
const FIRESTORE_URL = "http://127.0.0.1:8080";
const AUTH_URL = "http://127.0.0.1:9099";
const FAKE_API_KEY = "fake-api-key";
const OWNER_HEADERS = { Authorization: "Bearer owner", "Content-Type": "application/json" };

const CLEAR_URL = `${FIRESTORE_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DOCUMENTS_URL = `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** Valores tipados de la API REST de Firestore. */
type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

async function assertOk(response: Response, action: string): Promise<void> {
  if (!response.ok) {
    throw new Error(`${action} falló (${response.status}): ${await response.text()}`);
  }
}

async function writeDocument(path: string, fields: Record<string, FirestoreValue>): Promise<void> {
  const response = await fetch(`${DOCUMENTS_URL}/${path}`, {
    method: "PATCH",
    headers: OWNER_HEADERS,
    body: JSON.stringify({ fields }),
  });
  await assertOk(response, `Escribir ${path}`);
}

/** Borra todos los documentos de Firestore (emulador). */
export async function resetFirestore(): Promise<void> {
  const response = await fetch(CLEAR_URL, { method: "DELETE", headers: OWNER_HEADERS });
  await assertOk(response, "Borrar Firestore");
}

/** Siembra `n` participantes sin sorteo; devuelve sus celulares E.164. */
export async function seedParticipants(n: number): Promise<string[]> {
  const phones: string[] = [];
  const baseTime = Date.now() - n * 1000;
  for (let index = 0; index < n; index += 1) {
    const phone = `+519${String(index).padStart(8, "0")}`;
    phones.push(phone);
    const timestamp = new Date(baseTime + index * 1000).toISOString();
    await writeDocument(`participants/${encodeURIComponent(phone)}`, {
      fullName: { stringValue: `Jose Participante${letters(index)}` },
      phone: { stringValue: phone },
      company: { stringValue: `Empresa ${letters(index)}` },
      createdAt: { timestampValue: timestamp },
      drawId: { nullValue: null },
    });
  }
  return phones;
}

export interface SeedPrizeOptions {
  name: string;
  quantity?: number;
  order?: number;
  /** Unidades ya entregadas (para escenarios con historial). */
  delivered?: number;
  /** Giros previos; con valor > 0 el premio no se puede eliminar. */
  spinCount?: number;
}

/** Siembra un premio (`prizes/{id}`); devuelve su id. */
export async function seedPrize(options: SeedPrizeOptions): Promise<string> {
  const id = `premio-${options.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const now = new Date().toISOString();
  await writeDocument(`prizes/${id}`, {
    name: { stringValue: options.name },
    nameKey: { stringValue: options.name.toLowerCase() },
    quantity: { integerValue: String(options.quantity ?? 1) },
    order: { integerValue: String(options.order ?? 1) },
    delivered: { integerValue: String(options.delivered ?? 0) },
    spinCount: { integerValue: String(options.spinCount ?? 0) },
    createdAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
  });
  return id;
}

/** Abre o cierra las inscripciones escribiendo `settings/registration`. */
export async function setRegistrationOpen(open: boolean): Promise<void> {
  await writeDocument("settings/registration", {
    open: { booleanValue: open },
    updatedAt: { timestampValue: new Date().toISOString() },
    updatedBy: { stringValue: "e2e" },
  });
}

export interface CreateAdminUserOptions {
  /** Asigna el claim personalizado `admin: true`. */
  admin: boolean;
}

export interface CreatedUser {
  uid: string;
  email: string;
}

interface AuthResponse {
  localId?: string;
  error?: { message?: string };
}

async function authPost(path: string, body: Record<string, unknown>): Promise<AuthResponse> {
  const response = await fetch(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/${path}`, {
    method: "POST",
    headers: OWNER_HEADERS,
    body: JSON.stringify(body),
  });
  return (await response.json()) as AuthResponse;
}

/**
 * Crea (o reutiliza) un usuario de correo y contraseña en el emulador de Auth y, si
 * `admin` es verdadero, le asigna el claim `admin: true`.
 */
export async function createAdminUser(
  email: string,
  password: string,
  { admin }: CreateAdminUserOptions,
): Promise<CreatedUser> {
  let result = await authPost(`accounts:signUp?key=${FAKE_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  if (result.error?.message === "EMAIL_EXISTS") {
    result = await authPost(`accounts:signInWithPassword?key=${FAKE_API_KEY}`, {
      email,
      password,
      returnSecureToken: true,
    });
  }
  const uid = result.localId;
  if (!uid) {
    throw new Error(
      `No se pudo crear el usuario ${email}: ${result.error?.message ?? "sin detalle"}`,
    );
  }

  const update = await authPost("accounts:update", {
    localId: uid,
    customAttributes: JSON.stringify(admin ? { admin: true } : {}),
  });
  if (update.error) {
    throw new Error(
      `No se pudo asignar claims a ${email}: ${update.error.message ?? "sin detalle"}`,
    );
  }
  return { uid, email };
}

/** Convierte un índice en letras (0 → "A", 26 → "BA") para que los nombres solo tengan letras. */
function letters(index: number): string {
  let rest = index;
  let result = "";
  do {
    result = String.fromCharCode(65 + (rest % 26)) + result;
    rest = Math.floor(rest / 26);
  } while (rest > 0);
  return result;
}

/** Cantidad de participantes guardados. */
export async function countParticipants(): Promise<number> {
  const response = await fetch(`${DOCUMENTS_URL}/participants`, { headers: OWNER_HEADERS });
  await assertOk(response, "Listar participantes");
  const json = (await response.json()) as { documents?: unknown[] };
  return json.documents?.length ?? 0;
}

/**
 * Campos de texto de un participante (`null` si no existe). Solo devuelve los valores `stringValue`;
 * sirve para comprobar las respuestas guardadas por el formulario.
 */
export async function readParticipantStrings(
  phone: string,
): Promise<Record<string, string> | null> {
  const response = await fetch(`${DOCUMENTS_URL}/participants/${encodeURIComponent(phone)}`, {
    headers: OWNER_HEADERS,
  });
  if (response.status === 404) {
    return null;
  }
  await assertOk(response, `Leer participants/${phone}`);
  const json = (await response.json()) as {
    fields?: Record<string, { stringValue?: string }>;
  };
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(json.fields ?? {})) {
    if (typeof value.stringValue === "string") {
      result[key] = value.stringValue;
    }
  }
  return result;
}

export interface SeedParticipantInput {
  fullName: string;
  /** Celular E.164 (`+51XXXXXXXXX`); también es el ID del documento. */
  phone: string;
  company: string;
  createdAt: Date;
  /** ID del sorteo ganado; `null` (por defecto) si aún no ganó. */
  drawId?: string | null;
  /**
   * Interés en el CRM con Agente IA. Un texto (`yes` | `maybe` | `no`) es el formato actual; un
   * booleano simula un documento anterior a la feature 005 (la casilla de la 004); si falta, el campo
   * no se escribe (documento anterior a la 004).
   */
  crmInterest?: boolean | Interest;
  /** Interés en GPS / cámara; si falta, el campo no se escribe (documento anterior). */
  gpsInterest?: Interest;
  /** Área de capacitación; si falta, el campo no se escribe (documento anterior). */
  trainingArea?: string;
  /** Invitado sugerido; si falta, el campo no se escribe (documento anterior). */
  guestSuggestion?: string;
}

/** Siembra un participante con datos concretos (p. ej. textos con comas o fórmulas). */
export async function seedParticipant(input: SeedParticipantInput): Promise<void> {
  const timestamp = input.createdAt.toISOString();
  const fields: Record<string, FirestoreValue> = {
    fullName: { stringValue: input.fullName },
    phone: { stringValue: input.phone },
    company: { stringValue: input.company },
    createdAt: { timestampValue: timestamp },
    drawId: input.drawId ? { stringValue: input.drawId } : { nullValue: null },
  };
  if (typeof input.crmInterest === "boolean") {
    fields.crmInterest = { booleanValue: input.crmInterest };
  } else if (input.crmInterest !== undefined) {
    fields.crmInterest = { stringValue: input.crmInterest };
  }
  if (input.gpsInterest !== undefined) {
    fields.gpsInterest = { stringValue: input.gpsInterest };
  }
  if (input.trainingArea !== undefined) {
    fields.trainingArea = { stringValue: input.trainingArea };
  }
  if (input.guestSuggestion !== undefined) {
    fields.guestSuggestion = { stringValue: input.guestSuggestion };
  }
  await writeDocument(`participants/${encodeURIComponent(input.phone)}`, fields);
}
