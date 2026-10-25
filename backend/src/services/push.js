const admin = require('firebase-admin');

let initialized = false;
function init() {
  if (initialized) return;
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) {
    console.warn('[push] GOOGLE_APPLICATION_CREDENTIALS_JSON not set; push notifications disabled');
    return;
  }
  try {
    const creds = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(creds),
    });
    initialized = true;
    console.log('[push] firebase-admin initialized for messaging');
  } catch (e) {
    console.error('[push] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON', e);
  }
}

async function sendToTokens({ title, body, data = {}, tokens = [] }) {
  if (!tokens || tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };

  const isExpo = (t) => typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
  const expoTokens = tokens.filter(isExpo);
  const fcmTokens = tokens.filter(t => !isExpo(t));

  let success = 0;
  let failure = 0;
  const invalidTokens = [];

  // ── 1. Deliver to Expo Go tokens via Expo Push API ──────────────────────────
  if (expoTokens.length > 0) {
    try {
      const messages = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
      }));
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const expoData = await expoRes.json();
      if (Array.isArray(expoData?.data)) {
        expoData.data.forEach((ticket, idx) => {
          if (ticket.status === 'ok') {
            success++;
          } else {
            failure++;
            if (ticket.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(expoTokens[idx]);
            }
          }
        });
      }
      console.log('[push] Expo Push API result:', { sent: success, failed: failure });
    } catch (err) {
      console.error('[push] Expo Push error:', err);
      failure += expoTokens.length;
    }
  }

  // ── 2. Deliver to Native FCM tokens via Firebase Admin ─────────────────────
  if (fcmTokens.length > 0) {
    init();
    if (initialized) {
      const chunks = [];
      const size = 500;
      for (let i = 0; i < fcmTokens.length; i += size) chunks.push(fcmTokens.slice(i, i + size));
      for (const batch of chunks) {
        try {
          const res = await admin.messaging().sendEachForMulticast({
            tokens: batch,
            // notification payload → FCM handles display when app is background/killed
            notification: { title, body },
            android: {
              // HIGH priority ensures delivery even in Doze mode / battery saver
              priority: 'high',
              // TTL: keep in FCM queue for 4 weeks if device is offline
              ttl: 2419200000,
              notification: {
                // ── CRITICAL: channelId must match the channel registered in the app ──
                // Without this, Android 8+ silently drops background notifications.
                channelId: 'bus_alerts',
                // Sound file name WITHOUT extension — must exist in res/raw/
                sound: 'bus_horn',
                color: '#F59E0B',
                // Vibration pattern (milliseconds, must be numbers not strings)
                defaultVibrateTimings: false,
                vibrateTimingsMillis: [0, 300, 200, 300],
                defaultSound: false,
              },
            },
            // iOS: mark as background-capable so APNs delivers when app is killed
            apns: {
              payload: {
                aps: {
                  sound: 'bus_horn.mp3',
                  'content-available': 1,
                },
              },
              headers: {
                'apns-priority': '10',
              },
            },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          });
          success += res.successCount || 0;
          failure += res.failureCount || 0;
          if (Array.isArray(res.responses)) {
            res.responses.forEach((r, idx) => {
              if (!r.success) {
                const errCode = r.error && (r.error.code || r.error.errorInfo?.code);
                if (
                  errCode === 'messaging/registration-token-not-registered' ||
                  errCode === 'messaging/invalid-registration-token'
                ) {
                  invalidTokens.push(batch[idx]);
                }
              }
            });
          }
        } catch (e) {
          console.error('[push] FCM send error', e);
        }
      }
    }
  }

  console.log('[push] total send result', { success, failure, invalidTokens: invalidTokens.length });
  return { success, failure, invalidTokens };
}

module.exports = { sendToTokens };
