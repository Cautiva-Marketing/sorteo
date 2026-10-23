import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

/**
 * Inicialización diferida y única de la app web de Firebase.
 * No se inicializa nada al importar el módulo; solo al llamar a `getFirebaseApp()`.
 * Las variables `NEXT_PUBLIC_*` se referencian de forma literal para que Next las incluya.
 */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}
