/**
 * Send test push to ALL tokens for bus 34 student, with full error details.
 */
require('dotenv').config();
const admin = require('firebase-admin');
const mongoose = require('mongoose');

// Init Firebase Admin directly so we can get full error details
const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
admin.initializeApp({ credential: admin.credential.cert(creds) });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const student = await db.collection('users').findOne({ phone: '7892343128' });

  console.log('Student:', student.name, '| Bus:', student.busNumber);
  console.log('Total tokens:', student.fcmTokens.length);
  console.log('');

  for (let i = 0; i < student.fcmTokens.length; i++) {
    const token = student.fcmTokens[i];
    try {
      const res = await admin.messaging().send({
        token,
        notification: { title: `🚌 TEST ${i+1}`, body: 'Bus horn notification test' },
        android: {
          priority: 'high',
          notification: {
            channelId: 'bus_alerts',
            sound: 'bus_horn',
            defaultSound: false,
          },
        },
        data: { event: 'test' },
      });
      console.log(`Token[${i}] ✅ SUCCESS | messageId: ${res}`);
    } catch (err) {
      console.log(`Token[${i}] ❌ FAILED`);
      console.log(`  Code: ${err.code}`);
      console.log(`  Message: ${err.message}`);
      console.log(`  Token: ${token.substring(0, 35)}...`);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
