import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB32kxiS6Xol1d1qZNNdFshI_iEDtdu888",
  authDomain: "librodecajapeniel.firebaseapp.com",
  projectId: "librodecajapeniel",
  storageBucket: "librodecajapeniel.firebasestorage.app",
  messagingSenderId: "1024131412182",
  appId: "1:1024131412182:web:0814c47189e8509a9b1977"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;