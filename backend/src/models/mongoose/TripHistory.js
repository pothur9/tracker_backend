const mongoose = require('mongoose');

const LocationPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const TripHistorySchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    busNumber: { type: String, required: true, index: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, default: null },
    status: { type: String, enum: ['active', 'completed'], default: 'active', index: true },
    locations: [LocationPointSchema],
    // Optional metadata
    startLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    endLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    // Track if school arrival notification was sent for this trip
    schoolArrivalNotificationSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for efficient queries
TripHistorySchema.index({ busNumber: 1, startTime: -1 });
TripHistorySchema.index({ driverId: 1, startTime: -1 });
TripHistorySchema.index({ status: 1, startTime: -1 });

module.exports = mongoose.models.TripHistory || mongoose.model('TripHistory', TripHistorySchema);

