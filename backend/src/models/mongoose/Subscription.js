const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled'],
      default: 'pending'
    },
    plan: {
      type: String,
      default: '3-month'
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    startDate: { type: Date },
    endDate: { type: Date, index: true }
  },
  { timestamps: true }
);

// Compound index for quick active subscription lookup
SubscriptionSchema.index({ userId: 1, status: 1, endDate: -1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
