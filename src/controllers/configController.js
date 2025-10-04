const config = require('../config/env');

function getMapsConfig(req, res) {
  return res.json({ googleMapsApiKey: config.mapsKey || '' });
}

module.exports = { getMapsConfig };
