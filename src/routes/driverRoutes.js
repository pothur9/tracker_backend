const express = require('express')
const auth = require('../middleware/auth')
const { getSharingStatus, setSharingStatus, addStop, listStops, arriveAtStop, listStopsByBusNumber } = require('../controllers/driverController')
const { body } = require('express-validator')
const { validationResult } = require('express-validator')

const router = express.Router()

router.get('/sharing', auth('driver'), getSharingStatus)
router.post('/sharing', auth('driver'), setSharingStatus)

function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
      next()
    },
  ]
}

// Add a stop (driver only)
router.post(
  '/stops',
  auth('driver'),
  validate([
    body('lat').isFloat({ min: -90, max: 90 }),
    body('lng').isFloat({ min: -180, max: 180 }),
    body('name').optional().isString(),
    body('order').optional().isInt({ min: 0 }),
  ]),
  addStop
)

// List stops
router.get('/stops', auth('driver'), listStops)

// Public: list stops by bus number (students)
router.get('/stops/public', listStopsByBusNumber)

// Mark arrival at a stop (notifies next two stops)
router.post(
  '/stops/arrive',
  auth('driver'),
  validate([body('stopIndex').isInt({ min: 0 })]),
  arriveAtStop
)

module.exports = router
