const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

// In-memory token store — replace with DB in production
const fcmTokens = new Set();

// Frontend registers its FCM token here on load
app.post('/register-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });
  fcmTokens.add(token);
  console.log(`Token registered. Total: ${fcmTokens.size}`);
  res.json({ success: true });
});

// FastAPI calls this when a match is found
app.post('/notify', async (req, res) => {
  const { matches, message } = req.body;

  if (fcmTokens.size === 0) {
    console.log('No FCM tokens registered, skipping notification');
    return res.json({ sent: 0 });
  }

  const topMatch = matches[0];
  const notification = {
    title: '🚨 Face Match Detected',
    body: message || `Match found: ${topMatch.similarity_percent}% similarity`
  };

  const data = {
    alert_type: 'PERSON_FOUND',
    similarity: String(topMatch.similarity_percent),
    location: topMatch.metadata?.location || 'unknown',
    timestamp: topMatch.metadata?.timestamp || new Date().toISOString(),
    device_id: topMatch.metadata?.device_id || 'unknown'
  };

  let sent = 0;
  const failed = [];

  for (const token of fcmTokens) {
    try {
      await admin.messaging().send({
        token,
        notification,
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } }
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send to token: ${err.message}`);
      failed.push(token);
    }
  }

  // Remove invalid tokens
  failed.forEach(t => fcmTokens.delete(t));

  console.log(`Notifications sent: ${sent}`);
  res.json({ sent, failed: failed.length });
});

app.listen(3002, () => console.log('Node notification server running on port 3002'));