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
import firebaseConfigJson from '../../firebase-applet-config.json';

// Fallback configs from firebase-applet-config.json for easy deployment
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "AIzaSyCYIkpASqZD6R2bOOi9F3hvQMl_iTLsjBI",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "myvocab-13ebc.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "myvocab-13ebc",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "myvocab-13ebc.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "531149838847",
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "1:531149838847:web:a4577c60628b9c4c6b2fca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use custom database ID if specified and not "(default)", otherwise use the default database ID
const db = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

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
