require('dotenv').config();
const { sendToTokens } = require('./src/services/push');

(async () => {
  const token = 'fMGTIvvAQmxVQcMNgcvju5:APA91bGJyOpMvpmgEd1nFHsMailcn0jzrfb2V3vVLzOUKdB430kIIud0tzD9osBMxEXQMOXtTZHuVKmWzkDeWuko_m50-il81p31bzvyrkvqcZuN84fZZ28';
  console.log('Sending test push to token:', token);
  const res = await sendToTokens({
    title: 'Test From Backend',
    body: 'Testing FCM delivery',
    data: { test: 'true' },
    tokens: [token]
  });
  console.log('Result:', JSON.stringify(res, null, 2));
  process.exit(0);
})();
