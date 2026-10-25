const mongoose = require('mongoose');
const uri = 'mongodb+srv://chowdaryp697:prasanna@cluster0.pdtmjr8.mongodb.net/tracker';
mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({ 'fcmTokens.0': { $exists: true } }).toArray();
  for (const u of users) {
    console.log('User:', u.name, 'Phone:', u.phone, 'Bus:', u.busNumber);
    console.log('Tokens:', u.fcmTokens);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
