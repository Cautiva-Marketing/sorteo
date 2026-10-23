/**
 * Crea (o localiza) un usuario de Firebase Auth y le asigna el claim `admin: true`.
 *
 * Uso: npm run admin:grant -- <correo> <contraseña>
 *
 * - Con `FIREBASE_AUTH_EMULATOR_HOST` apunta al emulador de Auth (sin credenciales reales).
 * - Sin emulador usa la cuenta de servicio de `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y
 *   `FIREBASE_PRIVATE_KEY` (se leen del entorno o de `.env.local`).
 * - No guarda credenciales en disco. La contraseña solo se usa al crear un usuario nuevo; si el
 *   correo ya existe, no se modifica.
 */
import { existsSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const USAGE = "Uso: npm run admin:grant -- <correo> <contraseña>";
const MIN_PASSWORD_LENGTH = 6;

function loadLocalEnv(): void {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
}

function initApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: projectId ?? "demo-sorteo" });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY (o define FIREBASE_AUTH_EMULATOR_HOST para usar el emulador).",
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "auth/user-not-found"
  );
}

async function main(): Promise<void> {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    throw new Error(USAGE);
  }

  loadLocalEnv();
  const auth = getAuth(initApp());

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
    console.log(`Usuario existente: ${email}`);
  } catch (error) {
    if (!isUserNotFound(error)) {
      throw error;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    uid = (await auth.createUser({ email, password, emailVerified: true })).uid;
    console.log(`Usuario creado: ${email}`);
  }

  await auth.setCustomUserClaims(uid, { admin: true });
  console.log(`Claim admin asignado. uid: ${uid}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
