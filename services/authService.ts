import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { User, UserProfile } from "../types";
import { INITIAL_USERS } from "../constants";

// Helper to check if auth is initialized (it might be an empty object {} if env vars are missing)
const isAuthValid = () => {
  return auth && typeof auth === 'object' && 'app' in auth;
};

export const login = async (email: string, password: string) => {
  if (!isAuthValid()) {
    throw new Error("No se pudo conectar al servicio de autenticación. Verifica la configuración.");
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  if (isAuthValid()) {
    await firebaseSignOut(auth);
  }
};

export const subscribeToAuth = (
  onUserChanged: (firebaseUser: FirebaseUser | null, appUser: User | null) => void
) => {
  // Prevent crash if Firebase Auth failed to initialize (e.g. in Preview without Env Vars)
  if (!isAuthValid()) {
    console.warn("Auth service not initialized properly. Skipping auth subscription.");
    onUserChanged(null, null);
    return () => {}; // Return dummy unsubscribe
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser && firebaseUser.email) {
      try {
        // 1. Try to fetch by UID first (the correct way)
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const appUser = { id: userDocSnap.id, ...userDocSnap.data() } as User;
          onUserChanged(firebaseUser, appUser);
        } else {
          // 2. Fallback to email search (for legacy or seeded data)
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where("email", "==", firebaseUser.email));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const oldDoc = querySnapshot.docs[0];
            const userData = oldDoc.data() as User;
            
            // Migrate to UID-based document
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              ...userData,
              id: firebaseUser.uid
            });
            
            // Optionally delete old doc if it wasn't already UID-based
            if (oldDoc.id !== firebaseUser.uid) {
              await deleteDoc(doc(db, 'users', oldDoc.id));
            }

            onUserChanged(firebaseUser, { ...userData, id: firebaseUser.uid });
          } else {
            // 3. FALLBACK FOR FIRST RUN (BOOTSTRAPPING)
            const initialAdmin = INITIAL_USERS.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            
            if (initialAdmin) {
              console.log("First run detected. Creating profile for initial admin.");
              const newAdmin = {
                ...initialAdmin,
                id: firebaseUser.uid
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newAdmin);
              onUserChanged(firebaseUser, newAdmin);
            } else {
              console.warn("User logged in but no profile found in Firestore.");
              onUserChanged(firebaseUser, null);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        onUserChanged(firebaseUser, null);
      }
    } else {
      onUserChanged(null, null);
    }
  });
};