import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch,
  getDocs,
  getDoc,
  getDocFromServer
} from "firebase/firestore";
import { 
  ref, 
  uploadString, 
  getDownloadURL, 
  uploadBytes,
  deleteObject
} from "firebase/storage";
import { db, storage, auth } from "../firebase";
import { Transaction, Center, MovementType, User, ChurchData } from "../types";
import { INITIAL_CENTERS, INITIAL_MOVEMENT_TYPES, INITIAL_USERS, INITIAL_CURRENCIES } from "../constants";

// --- ERROR HANDLING ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'no-auth',
      email: auth.currentUser?.email || 'no-auth',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// --- COLLECTIONS ---
const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  CENTERS: 'centers',
  MOVEMENT_TYPES: 'movement_types',
  USERS: 'users',
  ANNOTATIONS: 'annotations',
  CONFIG: 'app_config',
  INVERSIONS: 'inversions'
};

// --- DATA SEEDING ---
export const seedInitialData = async () => {
  try {
      const centersSnap = await getDocs(collection(db, COLLECTIONS.CENTERS));
      if (centersSnap.empty) {
        console.log("Seeding Initial Data...");
        const batch = writeBatch(db);
        
        INITIAL_CENTERS.forEach(c => batch.set(doc(db, COLLECTIONS.CENTERS, c.id), c));
        INITIAL_MOVEMENT_TYPES.forEach(m => batch.set(doc(db, COLLECTIONS.MOVEMENT_TYPES, m.id), m));
        INITIAL_USERS.forEach(u => batch.set(doc(db, COLLECTIONS.USERS, u.id), u));
        
        batch.set(doc(db, COLLECTIONS.CONFIG, 'main'), {
          currencies: INITIAL_CURRENCIES,
          churchData: { name: 'Peniel (MCyM)', address: '', pastor: '', phone: '', logoUrl: '' }
        });

        await batch.commit();
        console.log("Seeding Complete.");
      }
  } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'initial_seeding');
  }
};

// --- CONNECTION TEST ---
export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
};
// testConnection(); // Removed from module level to avoid errors before auth

// --- REALTIME LISTENERS ---

export const subscribeToCollection = <T>(collectionName: string, callback: (data: T[]) => void) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    callback(data);
  }, (error) => handleFirestoreError(error, OperationType.GET, collectionName));
};

export const subscribeToTransactions = (callback: (data: Transaction[]) => void) => {
  const q = query(collection(db, COLLECTIONS.TRANSACTIONS), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    callback(data);
  }, (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.TRANSACTIONS));
};

export const subscribeToConfig = (callback: (currencies: string[], churchData: ChurchData) => void) => {
  return onSnapshot(doc(db, COLLECTIONS.CONFIG, 'main'), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const defaultChurch: ChurchData = { name: 'Peniel (MCyM)' };
      callback(data.currencies || INITIAL_CURRENCIES, data.churchData || defaultChurch);
    } else {
      callback(INITIAL_CURRENCIES, { name: 'Peniel (MCyM)' });
    }
  }, (error) => {
    console.warn("Error fetching config (branding/config):", error);
    // Fallback to defaults without throwing to prevent app crash on login page
    callback(INITIAL_CURRENCIES, { name: 'Peniel (MCyM)' });
  });
};

// --- CRUD OPERATIONS ---

export const saveDocument = async (collectionName: string, data: any, id?: string): Promise<string> => {
  try {
    const docId = id || doc(collection(db, collectionName)).id;
    const finalData = { ...data, id: docId };
    await setDoc(doc(db, collectionName, docId), finalData, { merge: true });
    return docId;
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, collectionName);
    return ""; // Unreachable
  }
};

// --- HELPERS DE STORAGE MEJORADOS ---

// Función para extraer la referencia de Storage de forma robusta sin Regex
const getStorageRefFromUrl = (url: string) => {
    // Si no contiene el indicador de objeto (/o/), probablemente no sea una URL válida de descarga
    if (!url.includes('/o/')) {
        console.warn("[Storage] URL no válida para extracción:", url);
        return null;
    }

    try {
        // 1. Dividir la URL en dos partes usando '/o/' como separador
        // Parte 0: https://firebasestorage.googleapis.com/v0/b/bucket-name
        // Parte 1: folder%2Ffile.jpg?alt=media&token=...
        const parts = url.split('/o/');
        
        if (parts.length < 2) {
            console.warn("[Storage] Formato de URL inesperado (split falló).");
            return null;
        }

        // 2. Tomar la parte de la derecha (ruta codificada + params)
        let pathAndParams = parts[1];

        // 3. Eliminar los query params (todo lo que está después del '?')
        const qIndex = pathAndParams.indexOf('?');
        if (qIndex !== -1) {
            pathAndParams = pathAndParams.substring(0, qIndex);
        }

        // 4. Decodificar la ruta (convertir %2F en /, etc.)
        const decodedPath = decodeURIComponent(pathAndParams);
        
        console.log(`[Storage] Ruta extraída para borrar: "${decodedPath}"`);
        
        // 5. Crear la referencia usando la instancia de storage configurada
        // Esto usará el bucket por defecto configurado en firebase.ts
        return ref(storage, decodedPath);
    } catch (e) {
        console.error("[Storage] Error parseando URL:", e);
        return null;
    }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);

  try {
      // 1. Obtener datos antes de borrar para ver si hay adjunto
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Verificar adjunto
          if (data.attachment && typeof data.attachment === 'string' && data.attachment.includes('firebasestorage')) {
              console.log("[Storage] Detectado adjunto para eliminar:", data.attachment);
              
              const imageRef = getStorageRefFromUrl(data.attachment);
              
              if (imageRef) {
                  try {
                      await deleteObject(imageRef);
                      console.log("[Storage] ✅ Imagen eliminada correctamente de la nube.");
                  } catch (storageError: any) {
                      // Manejar error 404 (Objeto no encontrado) sin romper la app
                      if (storageError.code === 'storage/object-not-found') {
                          console.warn("[Storage] La imagen ya no existía (404), ignorando.");
                      } else {
                          console.error("[Storage] ❌ Error crítico al eliminar imagen:", storageError);
                      }
                  }
              } else {
                  console.warn("[Storage] No se pudo generar una referencia válida para la URL.");
              }
          } else {
             // Debug para saber por qué no entró al if
             if (data.attachment) console.log("[Storage] El adjunto no parece ser de Firebase Storage:", data.attachment);
          }
      }

      // 2. Eliminar doc de Firestore
      await deleteDoc(docRef);
  } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
  }
};

export const batchSaveTransactions = async (transactions: Transaction[]) => {
  try {
    const batch = writeBatch(db);
    transactions.forEach(t => {
      const ref = doc(collection(db, COLLECTIONS.TRANSACTIONS)); 
      batch.set(ref, { ...t, id: ref.id });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.TRANSACTIONS);
  }
};

export const updateCurrencies = async (currencies: string[]) => {
  try {
    await setDoc(doc(db, COLLECTIONS.CONFIG, 'main'), { currencies }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.CONFIG);
  }
};

export const saveChurchData = async (churchData: ChurchData) => {
  try {
    await setDoc(doc(db, COLLECTIONS.CONFIG, 'main'), { churchData }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.CONFIG);
  }
};

// --- STORAGE UPLOAD ---

export const uploadImage = async (file: File | string, path: string): Promise<string> => {
  if (!storage || !storage.app) {
      throw new Error("Storage no disponible.");
  }

  try {
      const storageRef = ref(storage, path);
      const metadata = { cacheControl: 'public, max-age=31536000' };

      if (typeof file === 'string') {
        await uploadString(storageRef, file, 'data_url', metadata);
      } else {
        await uploadBytes(storageRef, file, metadata);
      }
      
      return await getDownloadURL(storageRef);
  } catch (error: any) {
      console.error("Upload error:", error);
      throw error;
  }
};
