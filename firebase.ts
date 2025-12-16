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

// Verificación de variables críticas para debugging rápido
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(key => !getEnv(key));
if (missingVars.length > 0) {
  console.error(`🔴 FALTAN VARIABLES DE ENTORNO EN VERCEL: ${missingVars.join(', ')}. La app no funcionará correctamente.`);
}

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
  console.log("Firebase inicializado correctamente.");
} catch (error: any) {
  console.error("Error CRÍTICO en la inicialización de Firebase:", error);
  if (error.code === 'app/invalid-configuration-options') {
    console.error("Revisa que hayas cargado todas las variables de entorno en Vercel (Settings > Environment Variables).");
  }
}

export { db, storage, auth };
export default app;