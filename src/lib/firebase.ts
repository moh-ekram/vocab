import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// Fallback configs from firebase-applet-config.json for easy deployment
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDmtLGiJRUq-9D1bwSuvWrziSdX88VkXHQ",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "extended-sprite-8dpgw.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "extended-sprite-8dpgw",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "extended-sprite-8dpgw.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "647429845805",
  appId: env.VITE_FIREBASE_APP_ID || "1:647429845805:web:f132f482099757b9bed9a4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence for firestore
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence.');
    }
  });
} catch (e) {
  console.warn('Firebase persistence initialization error', e);
}

export { 
  app, 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  doc,
  getDoc,
  setDoc
};
export type { User };
