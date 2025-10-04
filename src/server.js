require('dotenv').config();
const app = require('./app');
const { connectMongo } = require('./config/mongo');

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await connectMongo();
  } catch (e) {
    console.error('[Server] Failed to connect to MongoDB. Server will not start.');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Backend server listening on http://localhost:${PORT}`);
  });
})();
