require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;

  // Get all users with FCM tokens
  const users = await db.collection('users').find(
    { 'fcmTokens.0': { $exists: true } },
    { projection: { name: 1, phone: 1, busNumber: 1, fcmTokens: 1 } }
  ).toArray();

  console.log('\n=== STUDENT FCM TOKENS ===');
  for (const u of users) {
    console.log(`\nName: ${u.name} | Phone: ${u.phone} | Bus: ${u.busNumber}`);
    (u.fcmTokens || []).forEach((t, i) => {
      const isExpo = t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
      const type = isExpo ? '⚠️  EXPO (old)' : '✅ NATIVE FCM';
      console.log(`  Token[${i}] ${type}: ${t.substring(0, 50)}...`);
    });
  }

  // Get driver tokens too
  const drivers = await db.collection('drivers').find(
    { 'fcmTokens.0': { $exists: true } },
    { projection: { name: 1, phone: 1, busNumber: 1, fcmTokens: 1 } }
  ).toArray();

  console.log('\n=== DRIVER FCM TOKENS ===');
  for (const d of drivers) {
    console.log(`\nName: ${d.name} | Phone: ${d.phone} | Bus: ${d.busNumber}`);
    (d.fcmTokens || []).forEach((t, i) => {
      const isExpo = t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
      const type = isExpo ? '⚠️  EXPO (old)' : '✅ NATIVE FCM';
      console.log(`  Token[${i}] ${type}: ${t.substring(0, 50)}...`);
    });
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
