import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Helper para evitar crash si import.meta.env no está definido (aunque en Vite debería estarlo)
const getEnv = (key: string) => {
  try {
    // Use type assertion to avoid TypeScript error about 'env' property when vite types are missing
    return (import.meta as any).env?.[key];
  } catch (e) {
    console.warn(`Error accediendo a la variable de entorno ${key}`, e);
    return undefined;
  }
};

// Usamos variables de entorno de Vite
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Validación básica para debuggear pantalla blanca
if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase API Key is missing. Check your Vercel Environment Variables.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;