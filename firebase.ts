import { initializeApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
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
  
  // --- HABILITAR PERSISTENCIA OFFLINE (CACHÉ) ---
  // Esto guarda los datos en el dispositivo (IndexedDB) para que la app cargue 
  // instantáneamente y no consuma lecturas si los datos no han cambiado.
  enableIndexedDbPersistence(db).catch((err) => {
      if (err.code == 'failed-precondition') {
          // Ocurre si hay multiples pestañas abiertas
          console.warn("La persistencia solo puede habilitarse en una pestaña a la vez.");
      } else if (err.code == 'unimplemented') {
          // El navegador no lo soporta
          console.warn("El navegador no soporta persistencia offline.");
      }
  });

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