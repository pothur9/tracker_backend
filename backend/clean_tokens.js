require('dotenv').config();
const mongoose = require('mongoose');
const admin = require('firebase-admin');

// Init Firebase Admin
const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
admin.initializeApp({ credential: admin.credential.cert(creds) });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;

  for (const col of ['users', 'drivers']) {
    const docs = await db.collection(col).find(
      { 'fcmTokens.0': { $exists: true } }
    ).toArray();

    for (const doc of docs) {
      const tokens = doc.fcmTokens || [];
      if (!tokens.length) continue;

      const valid = [];
      const removed = [];

      // Test each token individually
      for (const token of tokens) {
        try {
          // Send a dry-run (validateOnly) message to check token validity
          await admin.messaging().send({
            token,
            notification: { title: 'test', body: 'test' },
            android: { notification: { channelId: 'bus_alerts' } },
          }, true); // true = validateOnly (no actual delivery)
          valid.push(token);
        } catch (err) {
          const code = err.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument' ||
            code === 'messaging/mismatched-credential'
          ) {
            removed.push(token);
          } else {
            // Unknown error — keep token
            valid.push(token);
          }
        }
      }

      if (removed.length > 0) {
        await db.collection(col).updateOne(
          { _id: doc._id },
          { $set: { fcmTokens: valid } }
        );
        console.log(`[${col}] ${doc.name || doc.phone}: removed ${removed.length} bad token(s), kept ${valid.length}`);
        removed.forEach(t => console.log(`  ❌ removed: ${t.substring(0, 40)}...`));
      } else {
        console.log(`[${col}] ${doc.name || doc.phone}: all ${valid.length} token(s) valid ✅`);
      }
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
