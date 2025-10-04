const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema(
  {
    schoolName: { type: String, required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    schoolCity: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    busNumber: { type: String, required: true },
    role: { type: String, default: 'driver' },
    isSharingLocation: { type: Boolean, default: false },
    // Array of route stops marked by the driver
    stops: [
      new mongoose.Schema(
        {
          name: { type: String },
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          order: { type: Number, required: true }, // 0-based order along the route
        },
        { _id: false }
      ),
    ],
    // The last stop index the driver marked as arrived (-1 means none yet)
    currentStopIndex: { type: Number, default: -1 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Driver || mongoose.model('Driver', DriverSchema);
