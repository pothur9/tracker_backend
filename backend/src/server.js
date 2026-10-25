require('dotenv').config();
const app = require('./app');
const { connectMongo } = require('./config/mongo');

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0'; // Bind to all interfaces so physical devices on WiFi can connect

(async () => {
  try {
    await connectMongo();
  } catch (e) {
    console.error('[Server] Failed to connect to MongoDB. Server will not start.');
    process.exit(1);
  }
  app.listen(PORT, HOST, () => {
    console.log(`Backend server listening on http://0.0.0.0:${PORT} (LAN: http://192.168.29.67:${PORT})`);
  });
})();
