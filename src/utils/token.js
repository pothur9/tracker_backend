const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signToken(payload, expiresIn = '365d') {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

module.exports = { signToken };
