import { initializeApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// Helper para evitar crash si import.meta.env no está definido
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env?.[key];
  } catch (e) {
    console.warn(`Error accediendo a la variable de entorno ${key}`, e);
    return undefined;
  }
};

// Configuración de Firebase
// Se ha configurado explícitamente el storageBucket según lo proporcionado
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: 'librodecajapeniel.firebasestorage.app', // Configurado manualmente
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Declarar variables a exportar
let app;
let db: Firestore = {} as Firestore;
let storage: FirebaseStorage = {} as FirebaseStorage;
let auth: Auth = {} as Auth;

try {
  // Inicializar Firebase
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  console.log("Firebase inicializado correctamente con Storage Bucket:", firebaseConfig.storageBucket);
} catch (error) {
  console.error("Error en la inicialización de Firebase:", error);
  console.warn("La aplicación se ha iniciado sin conexión completa a Firebase.");
}

export { db, storage, auth };
export default app;