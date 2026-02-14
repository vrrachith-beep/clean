import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAgbYHzJ9obOAH175h9Oabz8ub4q4NJX2U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'cleancredit-live.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'cleancredit-live',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'cleancredit-live.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '962355896597',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:962355896597:web:cc878b47d66e9a4890091c'
};

const missingFirebaseEnv = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || value.includes('YOUR_'))
  .map(([key]) => key);

if (missingFirebaseEnv.length > 0) {
  throw new Error(
    `Missing Firebase config: ${missingFirebaseEnv.join(', ')}.`,
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
