const Razorpay = require('razorpay');
const crypto = require('crypto');

let Subscription, MUser;
try {
  Subscription = require('../models/mongoose/Subscription');
  MUser = require('../models/mongoose/User');
} catch (e) {
  console.error('Failed to load Mongoose models for payments:', e);
}

// Razorpay test credentials - replace with live credentials in production
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret_key'
});

const SUBSCRIPTION_AMOUNT = 10000; // ₹100 in paise
const SUBSCRIPTION_DURATION_DAYS = 90; // 3 months

async function createOrder(req, res) {
  try {
    const userId = req.user.id;

    if (!process.env.MONGODB_URI || !Subscription) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    // Check for existing active subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      status: 'active',
      endDate: { $gt: new Date() }
    });

    if (existingSubscription) {
      return res.status(400).json({
        error: 'You already have an active subscription',
        endDate: existingSubscription.endDate
      });
    }

    // Generate short receipt ID (max 40 chars for Razorpay)
    const shortId = userId.toString().slice(-8);
    const timestamp = Date.now().toString(36); // Base36 for compact timestamp
    const receipt = `rcpt_${shortId}_${timestamp}`;

    const options = {
      amount: SUBSCRIPTION_AMOUNT,
      currency: 'INR',
      receipt: receipt,
      notes: { userId: userId.toString() }
    };

    const order = await razorpay.orders.create(options);

    // Create pending subscription record
    await Subscription.create({
      userId,
      status: 'pending',
      amount: SUBSCRIPTION_AMOUNT / 100, // Store in rupees
      razorpayOrderId: order.id
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
}

async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!process.env.MONGODB_URI || !Subscription || !MUser) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Update subscription record
    const subscription = await Subscription.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, userId },
      {
        status: 'active',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        startDate,
        endDate
      },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription record not found' });
    }

    // Update user subscription status
    await MUser.findByIdAndUpdate(userId, {
      subscriptionStatus: 'active',
      subscriptionEndDate: endDate
    });

    return res.json({
      success: true,
      subscription: {
        status: 'active',
        startDate,
        endDate,
        daysRemaining: SUBSCRIPTION_DURATION_DAYS
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}

async function getSubscriptionStatus(req, res) {
  try {
    const userId = req.user.id;

    if (!process.env.MONGODB_URI || !Subscription) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    }).sort({ endDate: -1 });

    if (!subscription || subscription.endDate < new Date()) {
      // Update if subscription expired
      if (subscription && subscription.endDate < new Date()) {
        await Subscription.findByIdAndUpdate(subscription._id, { status: 'expired' });
        if (MUser) {
          await MUser.findByIdAndUpdate(userId, { subscriptionStatus: 'expired' });
        }
      }

      return res.json({
        hasActiveSubscription: false,
        subscription: null
      });
    }

    const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));

    return res.json({
      hasActiveSubscription: true,
      subscription: {
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        daysRemaining
      }
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return res.status(500).json({ error: 'Failed to get subscription status' });
  }
}

module.exports = { createOrder, verifyPayment, getSubscriptionStatus };
