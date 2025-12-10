import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { User, UserProfile } from "../types";
import { INITIAL_USERS } from "../constants";

export const login = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  await firebaseSignOut(auth);
};

export const subscribeToAuth = (
  onUserChanged: (firebaseUser: FirebaseUser | null, appUser: User | null) => void
) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser && firebaseUser.email) {
      // 1. User is authenticated in Firebase Auth
      // 2. Fetch their profile from Firestore 'users' collection using email
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("email", "==", firebaseUser.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const appUser = { id: doc.id, ...doc.data() } as User;
          onUserChanged(firebaseUser, appUser);
        } else {
          // 3. FALLBACK FOR FIRST RUN (BOOTSTRAPPING)
          // If the user logs in via Auth but doesn't exist in DB yet, check if it's the hardcoded Initial Admin.
          // This allows App.tsx to load, which triggers seedInitialData(), creating the real DB record.
          const initialAdmin = INITIAL_USERS.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
          
          if (initialAdmin) {
            console.log("First run detected. Allowing temporary access to seed DB.");
            onUserChanged(firebaseUser, initialAdmin);
          } else {
            console.warn("User logged in but no profile found in Firestore and not in initial list.");
            onUserChanged(firebaseUser, null);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        onUserChanged(firebaseUser, null);
      }
    } else {
      // User is logged out
      onUserChanged(null, null);
    }
  });
};