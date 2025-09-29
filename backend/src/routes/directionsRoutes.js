const express = require('express')
const { getDrivingRoute } = require('../controllers/directionsController')

const router = express.Router()

// GET /api/directions/drive?originLat=..&originLng=..&destLat=..&destLng=..
router.get('/drive', getDrivingRoute)

module.exports = router
