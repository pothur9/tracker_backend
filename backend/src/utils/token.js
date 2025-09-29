const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

module.exports = { signToken };
