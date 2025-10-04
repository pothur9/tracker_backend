const mongoose = require('mongoose');
const config = require('./env');

async function connectMongo() {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) {
    throw new Error('[Mongo] MONGODB_URI not set. Please set it in backend/.env');
  }
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('[Mongo] Connected');
    return mongoose.connection;
  } catch (err) {
    console.error('[Mongo] Connection error:', err.message);
    throw err;
  }
}

module.exports = { connectMongo };
