import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBeSv2-CxxnGRcf7aRHH9tG42vfY5UPnNo",
  authDomain: "face-alert-18eff.firebaseapp.com",
  projectId: "face-alert-18eff",
  storageBucket: "face-alert-18eff.firebasestorage.app",
  messagingSenderId: "506770275826",
  appId: "1:506770275826:web:f718d57d073d3c7a4c3f6b",
  measurementId: "G-9N0JTGP642"
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    // Register token with Node server
    await fetch(`${import.meta.env.VITE_NODE_SERVER_URL}/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    return token;
  } catch (err) {
    console.error('Notification setup failed:', err);
    return null;
  }
}

export { messaging, onMessage };