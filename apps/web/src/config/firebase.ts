import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'wherezit-505615.firebaseapp.com';
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'wherezit-505615';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'wherezit-505615.appspot.com';
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

const isPlaceholder = (val?: string) =>
  !val ||
  val.trim() === '' ||
  val.includes('your-') ||
  val.includes('YOUR_') ||
  val === 'demo-api-key' ||
  val === 'changeme';

if (isPlaceholder(apiKey) || isPlaceholder(appId)) {
  console.warn(
    '[WherezIt Config Warning] Firebase Web configuration is missing or using placeholder credentials. Populate VITE_FIREBASE_* variables in apps/web/.env.local to enable live authentication.'
  );
}

const firebaseConfig = {
  apiKey: apiKey || 'demo-api-key',
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId: messagingSenderId || '123456789',
  appId: appId || '1:123456789:web:abcdef',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
