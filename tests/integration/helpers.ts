/**
 * Utilidades para las pruebas de integración contra los emuladores de Firebase.
 *
 * Fija las variables de entorno que usa el Admin SDK (emuladores, sin credenciales reales);
 * el SDK las lee de forma diferida, así que basta con importar este módulo antes de la primera
 * operación. `npm test` recibe los valores de `firebase emulators:exec`; los valores por
 * defecto cubren la ejecución manual contra `npm run emulators`.
 */
import { getAdminAuth, getDb } from "@/services/firebase/admin";

process.env.FIREBASE_PROJECT_ID ??= "demo-sorteo";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

/** Convierte un índice en letras (0 → "A", 26 → "BA") para generar nombres solo con letras. */
function indexToLetters(index: number): string {
  let rest = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26);
  } while (rest > 0);
  return letters;
}

/** Formato E.164 del participante número `index` (0 → +51900000000). */
export function phoneForIndex(index: number): string {
  return `+519${String(index).padStart(8, "0")}`;
}

/** Borra todas las colecciones de Firestore (emulador) con el Admin SDK. */
export async function clearFirestore(): Promise<void> {
  const db = getDb();
  const collections = await db.listCollections();
  await Promise.all(collections.map((collection) => db.recursiveDelete(collection)));
}

/**
 * Siembra `n` participantes sin sorteo (`drawId: null`). Devuelve sus celulares E.164.
 * El participante 0 es el más antiguo y el `n - 1` el más reciente.
 */
export async function seedParticipants(n: number): Promise<string[]> {
  const db = getDb();
  const writer = db.bulkWriter();
  const baseTime = Date.now() - n * 1000;
  const phones: string[] = [];
  for (let index = 0; index < n; index += 1) {
    const phone = phoneForIndex(index);
    phones.push(phone);
    const createdAt = new Date(baseTime + index * 1000);
    void writer.create(db.collection("participants").doc(phone), {
      fullName: `Participante ${indexToLetters(index)}`,
      phone,
      company: `Empresa ${indexToLetters(index)}`,
      createdAt,
      drawId: null,
    });
  }
  await writer.close();
  return phones;
}

export interface SeedPrizeOptions {
  name?: string;
  quantity?: number;
  order?: number;
  delivered?: number;
  spinCount?: number;
}

/** Siembra `prizes/{id}` con los contadores en cero salvo lo indicado; devuelve su id. */
export async function seedPrize(options: SeedPrizeOptions = {}): Promise<string> {
  const ref = getDb().collection("prizes").doc();
  const name = options.name ?? `Premio ${ref.id.slice(0, 4)}`;
  await ref.set({
    name,
    nameKey: name.toLowerCase(),
    quantity: options.quantity ?? 1,
    order: options.order ?? 1,
    delivered: options.delivered ?? 0,
    spinCount: options.spinCount ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return ref.id;
}

/**
 * Siembra una ronda antigua (`draws/{id}`, feature 001) con los participantes indicados como
 * ganadores y les asigna el `drawId`. Devuelve el id de la ronda.
 */
export async function seedLegacyDraw(
  winnerPhones: string[],
  options: { createdAt?: Date } = {},
): Promise<string> {
  const db = getDb();
  const drawRef = db.collection("draws").doc();
  const winners: Array<{ fullName: string; company: string; phone: string }> = [];
  for (const phone of winnerPhones) {
    const snapshot = await db.collection("participants").doc(phone).get();
    const data = snapshot.data() ?? {};
    winners.push({
      fullName: String(data.fullName ?? ""),
      company: String(data.company ?? ""),
      phone: phone.replace(/^\+51/, ""),
    });
  }
  await drawRef.set({
    createdAt: options.createdAt ?? new Date(),
    createdBy: { uid: "seed", email: "seed@example.com" },
    requestedCount: winnerPhones.length,
    winners,
    purgedAt: null,
  });
  for (const phone of winnerPhones) {
    await db.collection("participants").doc(phone).update({ drawId: drawRef.id });
  }
  return drawRef.id;
}

/** Lee y serializa las colecciones indicadas (id → datos) para comparar antes y después. */
export async function snapshotCollections(names: string[]): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const name of names) {
    const snapshot = await getDb().collection(name).get();
    result[name] = Object.fromEntries(snapshot.docs.map((doc) => [doc.id, doc.data()]));
  }
  return result;
}

/** Crea o actualiza `settings/registration` con el estado indicado. */
export async function seedRegistrationStatus(open: boolean): Promise<void> {
  await getDb().collection("settings").doc("registration").set({
    open,
    updatedAt: new Date(),
    updatedBy: "seed",
  });
}

/** Nombre de la cookie de sesión del panel (coincide con `SESSION_COOKIE_NAME` del servicio). */
export const ADMIN_COOKIE_NAME = "admin_session";

const TEST_PASSWORD = "Clave-de-prueba-123";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

/** Borra todos los usuarios del emulador de Auth. */
export async function clearAuthUsers(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-sorteo";
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`No se pudo limpiar el emulador de Auth (${response.status}).`);
  }
}

/**
 * Crea (o reutiliza) un usuario en el emulador de Auth con o sin el claim `admin` y devuelve un
 * ID token recién emitido (`auth_time` actual) que ya incluye los claims.
 */
export async function createUserIdToken(
  email: string,
  options: { admin: boolean },
): Promise<string> {
  const auth = getAdminAuth();
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email, password: TEST_PASSWORD })).uid;
  }
  await auth.setCustomUserClaims(uid, options.admin ? { admin: true } : {});

  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }),
    },
  );
  const body = (await response.json()) as { idToken?: string };
  if (!body.idToken) {
    throw new Error(`No se pudo iniciar sesión en el emulador de Auth como ${email}.`);
  }
  return body.idToken;
}

/**
 * Valor de una cookie de sesión real (`createSessionCookie` del Admin SDK) para un usuario del
 * emulador con o sin el claim `admin`.
 */
export async function createSessionCookieValue(
  email: string,
  options: { admin: boolean },
): Promise<string> {
  const idToken = await createUserIdToken(email, options);
  return getAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
}

/** Valor del encabezado `Cookie` con la sesión indicada. */
export function sessionCookieHeader(value: string): string {
  return `${ADMIN_COOKIE_NAME}=${value}`;
}
