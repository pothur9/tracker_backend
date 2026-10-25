require('dotenv').config();
const admin = require('firebase-admin');

const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
admin.initializeApp({ credential: admin.credential.cert(creds) });

const token = 'c4r4izi8SiOK4jWuZJl-nf:APA91bG9wv8JX3m0jwqgpV2eQDsO7N-85mbMz';

(async () => {
  console.log('Testing remaining token...');
  try {
    const result = await admin.messaging().send({
      token,
      notification: {
        title: '🚌 TEST - Did you get this?',
        body: 'Background notification test with bus horn sound',
      },
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
    console.log('✅ SUCCESS - message delivered to FCM');
    console.log('Message ID:', result);
  } catch (err) {
    console.log('❌ FAILED');
    console.log('Code:', err.code);
    console.log('Message:', err.message);
  }
  process.exit(0);
})();
