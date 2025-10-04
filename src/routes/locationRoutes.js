const express = require('express');
const auth = require('../middleware/auth');
const { driverUpdateLocation, userGetLatestLocation, userSubscribeLocationSSE } = require('../controllers/locationController');
const { body, query } = require('express-validator');
const { validationResult } = require('express-validator');

const router = express.Router();

function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      next();
    },
  ];
}

// Driver updates location (recommended every 10 seconds)
router.post(
  '/driver/update',
  auth('driver'),
  validate([
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('busNumber').isString().notEmpty(),
  ]),
  driverUpdateLocation
);

// User polling endpoint (frontend can call every 10 seconds)
router.get(
  '/latest',
  validate([query('busNumber').isString().notEmpty()]),
  userGetLatestLocation
);

// User SSE stream to get real-time updates
router.get(
  '/stream',
  validate([query('busNumber').isString().notEmpty()]),
  userSubscribeLocationSSE
);

module.exports = router;
