const express = require('express');
const auth = require('../middleware/auth');
const {
  getDriverTrips,
  getTripById,
  getTripsByBusNumber,
  getTripByIdPublic,
  getDriversPathsBySchoolName,
  getSchoolTripsBySchoolName,
} = require('../controllers/tripHistoryController');
const { query, param } = require('express-validator');
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

// Driver: Get all their trips (without locations array by default for performance)
router.get(
  '/driver',
  auth('driver'),
  validate([
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 }),
  ]),
  getDriverTrips
);

// Driver: Get specific trip with all locations for viewing on map
router.get(
  '/driver/:tripId',
  auth('driver'),
  validate([param('tripId').isMongoId()]),
  getTripById
);

// Public: Get trips by bus number (for viewing historical trips)
router.get(
  '/bus',
  validate([
    query('busNumber').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 }),
    query('includeLocations').optional().isBoolean(),
  ]),
  getTripsByBusNumber
);

// Public: Get latest path per driver by school name
router.get(
  '/school',
  validate([
    query('schoolName').isString().notEmpty(),
    query('includeLocations').optional().isBoolean(),
  ]),
  getDriversPathsBySchoolName
);

// Public: Get full trip history for all drivers in a school
router.get(
  '/school/history',
  validate([
    query('schoolName').isString().notEmpty(),
    query('status').optional().isIn(['all', 'active', 'completed']),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('skip').optional().isInt({ min: 0 }),
    query('includeLocations').optional().isBoolean(),
  ]),
  getSchoolTripsBySchoolName
);
// Public: Get specific trip by ID with all locations (for map viewing)
router.get(
  '/:tripId',
  validate([param('tripId').isMongoId()]),
  getTripByIdPublic
);

module.exports = router;

