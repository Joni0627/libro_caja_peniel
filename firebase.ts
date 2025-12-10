import { initializeApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

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

// Declare vars to be exported
let app;
// Cast to types to avoid TS errors when initializing with partials/undefined in catch block
let db: Firestore = {} as Firestore;
let storage: FirebaseStorage = {} as FirebaseStorage;
let auth: Auth = {} as Auth;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
  console.warn("La aplicación se ha iniciado sin conexión a Firebase debido a falta de configuración (posiblemente en Preview).");
  // We allow the script to continue so the React ErrorBoundary can catch the connection error later
  // and display a UI message instead of a white screen.
}

export { db, storage, auth };
export default app;