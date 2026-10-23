import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";

function usesEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function initAdminApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (usesEmulators()) {
    // Con emuladores no se necesitan credenciales reales (p. ej. proyecto "demo-sorteo").
    return initializeApp({ projectId: projectId ?? "demo-sorteo" });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY para el Admin SDK.",
    );
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

/** Inicialización única de la app del Admin SDK. */
function getAdminApp(): App {
  return getApps().length > 0 ? getApp() : initAdminApp();
}

let firestore: Firestore | null = null;

/**
 * Firestore se crea una sola vez. En producción usa REST en lugar de gRPC (arranque en frío más
 * rápido en funciones serverless); con emuladores se mantiene el transporte por defecto.
 */
export function getDb(): Firestore {
  if (firestore) {
    return firestore;
  }
  const app = getAdminApp();
  try {
    firestore = usesEmulators()
      ? getFirestore(app)
      : initializeFirestore(app, { preferRest: true });
  } catch {
    // Ya inicializado por otro módulo (p. ej. recarga en caliente): se reutiliza esa instancia.
    firestore = getFirestore(app);
  }
  return firestore;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
