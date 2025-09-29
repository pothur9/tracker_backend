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
  } catch (e) {
    console.error('[push] Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON', e);
  }
}

async function sendToTokens({ title, body, data = {}, tokens = [] }) {
  init();
  if (!initialized || !tokens || tokens.length === 0) return { success: 0 };
  const chunks = [];
  const size = 500; // FCM max ~500 tokens per sendMulticast
  for (let i = 0; i < tokens.length; i += size) chunks.push(tokens.slice(i, i + size));
  let success = 0;
  for (const batch of chunks) {
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      });
      success += res.successCount || 0;
    } catch (e) {
      console.error('[push] send error', e);
    }
  }
  return { success };
}

module.exports = { sendToTokens };
