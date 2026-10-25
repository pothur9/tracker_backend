const express = require('express')
const { testNotification } = require('../controllers/testController')

const router = express.Router()

// Test endpoint to send notification to a specific FCM token
router.post('/notification', testNotification)

module.exports = router
