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
            const newUserData = {
              ...userData,
              id: firebaseUser.uid
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUserData);
            
            // Optionally delete old doc if it wasn't already UID-based
            if (oldDoc.id !== firebaseUser.uid) {
              try {
                await deleteDoc(doc(db, 'users', oldDoc.id));
              } catch (e) {
                console.warn("Could not delete old user document, might be a permission issue but migration succeeded.");
              }
            }

            onUserChanged(firebaseUser, newUserData);
          } else {
            // 3. AUTO-CREATE PROFILE FOR NEW USERS
            // Check if it's the hardcoded Initial Admin
            const initialAdmin = INITIAL_USERS.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            
            const newUserProfile: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName?.split(' ')[0] || 'Usuario',
              lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || 'Nuevo',
              email: firebaseUser.email,
              profile: initialAdmin ? UserProfile.ADMIN : UserProfile.USER
            };

            console.log(`Creating ${newUserProfile.profile} profile for user: ${firebaseUser.email}`);
            await setDoc(doc(db, 'users', firebaseUser.uid), newUserProfile);
            onUserChanged(firebaseUser, newUserProfile);
          }
        }
      } catch (error) {
        console.error("Error fetching/creating user profile:", error);
        // If we can't even fetch the profile, we might be in a weird state.
        // Try to provide at least the firebase user so the app doesn't stay stuck on login if possible,
        // but App.tsx expects an appUser to proceed.
        onUserChanged(firebaseUser, null);
      }
    } else {
      onUserChanged(null, null);
    }
  });
};