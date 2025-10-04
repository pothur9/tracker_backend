require('dotenv').config();

const config = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  mapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
  dbPath: process.env.DB_PATH || 'data/db.json',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
};

module.exports = config;
