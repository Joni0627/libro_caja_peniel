import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch,
  getDocs,
  getDoc
} from "firebase/firestore";
import { 
  ref, 
  uploadString, 
  getDownloadURL, 
  uploadBytes,
  deleteObject
} from "firebase/storage";
import { db, storage } from "../firebase";
import { Transaction, Center, MovementType, User, ChurchData } from "../types";
import { INITIAL_CENTERS, INITIAL_MOVEMENT_TYPES, INITIAL_USERS, INITIAL_CURRENCIES } from "../constants";

// --- COLLECTIONS ---
const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  CENTERS: 'centers',
  MOVEMENT_TYPES: 'movement_types',
  USERS: 'users',
  ANNOTATIONS: 'annotations',
  CONFIG: 'app_config' // For currencies and logo
};

// --- DATA SEEDING (Run once if empty) ---
export const seedInitialData = async () => {
  try {
      const centersSnap = await getDocs(collection(db, COLLECTIONS.CENTERS));
      if (centersSnap.empty) {
        console.log("Seeding Initial Data...");
        const batch = writeBatch(db);
        
        INITIAL_CENTERS.forEach(c => {
          batch.set(doc(db, COLLECTIONS.CENTERS, c.id), c);
        });

        INITIAL_MOVEMENT_TYPES.forEach(m => {
          batch.set(doc(db, COLLECTIONS.MOVEMENT_TYPES, m.id), m);
        });

        INITIAL_USERS.forEach(u => {
          batch.set(doc(db, COLLECTIONS.USERS, u.id), u);
        });
        
        // Config document
        batch.set(doc(db, COLLECTIONS.CONFIG, 'main'), {
          currencies: INITIAL_CURRENCIES,
          churchData: {
            name: 'Peniel (MCyM)',
            address: '',
            pastor: '',
            phone: '',
            logoUrl: ''
          }
        });

        await batch.commit();
        console.log("Seeding Complete.");
      }
  } catch (error) {
      console.error("Error en seedInitialData:", error);
      throw error; // Re-throw so App.tsx catches it
  }
};

// --- REALTIME LISTENERS ---

export const subscribeToCollection = <T>(collectionName: string, callback: (data: T[]) => void) => {
  const q = query(collection(db, collectionName));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    callback(data);
  }, (error) => {
      console.error(`Error subscribing to ${collectionName}:`, error);
  });
};

export const subscribeToTransactions = (callback: (data: Transaction[]) => void) => {
  // Order by date desc
  const q = query(collection(db, COLLECTIONS.TRANSACTIONS), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    callback(data);
  }, (error) => {
      console.error("Error subscribing to transactions:", error);
  });
};

export const subscribeToConfig = (callback: (currencies: string[], churchData: ChurchData) => void) => {
  return onSnapshot(doc(db, COLLECTIONS.CONFIG, 'main'), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const defaultChurch: ChurchData = { name: 'Peniel (MCyM)' };
      callback(data.currencies || INITIAL_CURRENCIES, data.churchData || defaultChurch);
    } else {
        // Fallback defaults
        callback(INITIAL_CURRENCIES, { name: 'Peniel (MCyM)' });
    }
  }, (error) => {
      console.error("Error subscribing to config:", error);
  });
};

// --- CRUD OPERATIONS ---

// Generic Add/Update
export const saveDocument = async (collectionName: string, data: any, id?: string) => {
  if (id) {
    await setDoc(doc(db, collectionName, id), data, { merge: true });
  } else {
    await addDoc(collection(db, collectionName), data);
  }
};

// Helper: Extraer referencia segura desde URL
const getStorageRefFromUrl = (url: string) => {
    try {
        // Intento 1: Método estándar del SDK (funciona el 90% de las veces)
        return ref(storage, url);
    } catch (e) {
        console.warn("Fallo ref directa, intentando extracción manual...", e);
        try {
            // Intento 2: Parseo manual de la URL para obtener la ruta decodificada
            // Las URLs de Firebase son tipo: .../b/[BUCKET]/o/[PATH]?alt=...
            const pathStart = url.indexOf('/o/');
            if (pathStart === -1) return null;
            
            // Extraer todo después de /o/ y antes de ?
            let path = url.substring(pathStart + 3);
            const queryStart = path.indexOf('?');
            if (queryStart !== -1) {
                path = path.substring(0, queryStart);
            }
            
            // IMPORTANTE: Decodificar (ej: receipts%2Ffoto.jpg -> receipts/foto.jpg)
            const decodedPath = decodeURIComponent(path);
            return ref(storage, decodedPath);
        } catch (e2) {
            console.error("No se pudo parsear la URL de Storage:", url);
            return null;
        }
    }
};

// UPDATED: Delete Document AND associated Storage Image
export const deleteDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);

  try {
      // 1. Obtener el documento antes de borrarlo para ver si tiene adjunto
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Verificar si tiene el campo 'attachment' y si es una URL válida de Firebase
          if (data.attachment && typeof data.attachment === 'string' && data.attachment.includes('firebasestorage')) {
              try {
                  // Usar el helper robusto para obtener la referencia
                  const imageRef = getStorageRefFromUrl(data.attachment);
                  
                  if (imageRef) {
                      await deleteObject(imageRef);
                      console.log("Imagen adjunta eliminada de Storage correctamente.");
                  } else {
                      console.warn("No se pudo generar referencia para eliminar imagen:", data.attachment);
                  }
              } catch (storageError: any) {
                  // Si falla el borrado de imagen (ej. no existe), solo logueamos
                  if (storageError.code !== 'storage/object-not-found') {
                      console.warn("Error al eliminar imagen de Storage:", storageError);
                  }
              }
          }
      }

      // 2. Eliminar el documento de Firestore
      await deleteDoc(docRef);
  } catch (error) {
      console.error("Error al eliminar documento:", error);
      throw error;
  }
};

// Specific Batch Import for Transactions
export const batchSaveTransactions = async (transactions: Transaction[]) => {
  const batch = writeBatch(db);
  transactions.forEach(t => {
    const ref = doc(collection(db, COLLECTIONS.TRANSACTIONS)); // Auto ID
    batch.set(ref, { ...t, id: ref.id });
  });
  await batch.commit();
};

// Config Updates
export const updateCurrencies = async (currencies: string[]) => {
  await setDoc(doc(db, COLLECTIONS.CONFIG, 'main'), { currencies }, { merge: true });
};

export const saveChurchData = async (churchData: ChurchData) => {
  await setDoc(doc(db, COLLECTIONS.CONFIG, 'main'), { churchData }, { merge: true });
};

// --- STORAGE OPERATIONS ---

export const uploadImage = async (file: File | string, path: string): Promise<string> => {
  if (!storage || !storage.app) {
      throw new Error("El servicio de almacenamiento no está disponible. Verifica la configuración (VITE_FIREBASE_STORAGE_BUCKET).");
  }

  try {
      const storageRef = ref(storage, path);
      
      // Metadata para CACHÉ agresivo (1 año).
      const metadata = {
        cacheControl: 'public, max-age=31536000', 
      };

      const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("La subida tardó demasiado. Verifica tu conexión o los permisos de Storage.")), 15000);
      });

      let uploadPromise;

      if (typeof file === 'string') {
        uploadPromise = uploadString(storageRef, file, 'data_url', metadata);
      } else {
        uploadPromise = uploadBytes(storageRef, file, metadata);
      }
      
      await Promise.race([uploadPromise, timeoutPromise]);
      
      return await getDownloadURL(storageRef);
  } catch (error: any) {
      console.error("Upload error details:", error);
      if (error.code === 'storage/unauthorized') {
          throw new Error("No tienes permisos para subir archivos. Revisa las reglas de Firebase Storage.");
      } else if (error.code === 'storage/retry-limit-exceeded') {
          throw new Error("La subida tardó demasiado. Tu conexión puede ser inestable.");
      } else if (error.code === 'storage/unknown') {
          throw new Error("Error desconocido de Storage. ¿Configuraste CORS?");
      }
      throw error;
  }
};