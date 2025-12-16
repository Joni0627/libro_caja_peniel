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
  getDocs
} from "firebase/firestore";
import { 
  ref, 
  uploadString, 
  getDownloadURL, 
  uploadBytes 
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

export const deleteDocument = async (collectionName: string, id: string) => {
  await deleteDoc(doc(db, collectionName, id));
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
  const storageRef = ref(storage, path);
  
  if (typeof file === 'string') {
    // It's a base64 string
    await uploadString(storageRef, file, 'data_url');
  } else {
    // It's a File object
    await uploadBytes(storageRef, file);
  }
  
  return await getDownloadURL(storageRef);
};