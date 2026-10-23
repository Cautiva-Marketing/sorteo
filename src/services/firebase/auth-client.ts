import type { Auth } from "firebase/auth";
import { getFirebaseApp } from "@/services/firebase/client";

/** Motivo por el que falló el inicio de sesión (sin exponer detalles del SDK a la interfaz). */
export type SignInFailure = "INVALID_CREDENTIALS" | "TOO_MANY_REQUESTS" | "NETWORK" | "UNKNOWN";

export class SignInError extends Error {
  readonly reason: SignInFailure;

  constructor(reason: SignInFailure) {
    super(`No se pudo iniciar sesión: ${reason}`);
    this.name = "SignInError";
    this.reason = reason;
  }
}

const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
  "auth/user-disabled",
]);

function toSignInFailure(error: unknown): SignInFailure {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (INVALID_CREDENTIAL_CODES.has(code)) {
    return "INVALID_CREDENTIALS";
  }
  if (code === "auth/too-many-requests") {
    return "TOO_MANY_REQUESTS";
  }
  if (code === "auth/network-request-failed") {
    return "NETWORK";
  }
  return "UNKNOWN";
}

let emulatorConnected = false;

/** Obtiene Auth del SDK web (importación dinámica); contra el emulador solo en desarrollo/E2E. */
async function getClientAuth(): Promise<Auth> {
  const { connectAuthEmulator, getAuth } = await import("firebase/auth");
  const auth = getAuth(getFirebaseApp());
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost && process.env.NODE_ENV !== "production" && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}

/**
 * Inicia sesión con correo y contraseña y devuelve el ID token que el servidor canjea por la
 * cookie de sesión. Falla con `SignInError`.
 */
export async function signInAdmin(email: string, password: string): Promise<string> {
  try {
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const auth = await getClientAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return await credential.user.getIdToken();
  } catch (error) {
    throw new SignInError(toSignInFailure(error));
  }
}

/** Cierra la sesión del SDK web (la sesión real del panel es la cookie del servidor). */
export async function signOutClient(): Promise<void> {
  const { signOut } = await import("firebase/auth");
  await signOut(await getClientAuth());
}
