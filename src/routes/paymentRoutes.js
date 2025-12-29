const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Create Razorpay order - requires authentication
router.post('/create-order', auth(), paymentController.createOrder);

// Verify payment after Razorpay checkout completion
router.post('/verify', auth(), paymentController.verifyPayment);

// Get current user's subscription status
router.get('/subscription-status', auth(), paymentController.getSubscriptionStatus);

module.exports = router;
