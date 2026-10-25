/**
 * Send a test push directly to the most recent token for bus 34 student.
 * Run: node test_push_single.js
 * Watch your phone — if notification appears, FCM delivery works.
 * If not, the block is on the device side (battery/channel/permissions).
 */
require('dotenv').config();
const { sendToTokens } = require('./src/services/push');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const student = await db.collection('users').findOne({ phone: '7892343128' });

  if (!student || !student.fcmTokens?.length) {
    console.log('No student found or no tokens');
    process.exit(1);
  }

  // Use only the LAST saved token (most recent = from new build)
  const latestToken = student.fcmTokens[student.fcmTokens.length - 1];
  console.log('Sending to latest token:', latestToken.substring(0, 40) + '...');
  console.log('Student:', student.name, '| Bus:', student.busNumber);

  const result = await sendToTokens({
    title: '🚌 TEST - Bus Horn Sound Check',
    body: 'If you see this, FCM works! Check if sound is bus horn.',
    data: { event: 'test', busNumber: student.busNumber },
    tokens: [latestToken],
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
