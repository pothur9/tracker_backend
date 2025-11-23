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
  init();
  if (!initialized || !tokens || tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };
  const chunks = [];
  const size = 500; // FCM max ~500 tokens per sendMulticast
  for (let i = 0; i < tokens.length; i += size) chunks.push(tokens.slice(i, i + size));
  let success = 0;
  let failure = 0;
  const invalidTokens = [];
  for (const batch of chunks) {
    try {
      const res = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
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
      console.error('[push] send error', e);
    }
  }
  console.log('[push] send result', { success, failure, invalidTokens: invalidTokens.length });
  return { success, failure, invalidTokens };
}

module.exports = { sendToTokens };
