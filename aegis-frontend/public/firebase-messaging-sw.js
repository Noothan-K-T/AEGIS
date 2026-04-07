/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBeSv2-CxxnGRcf7aRHH9tG42vfY5UPnNo",
  authDomain: "face-alert-18eff.firebaseapp.com",
  projectId: "face-alert-18eff",
  storageBucket: "face-alert-18eff.firebasestorage.app",
  messagingSenderId: "506770275826",
  appId: "1:506770275826:web:f718d57d073d3c7a4c3f6b"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
