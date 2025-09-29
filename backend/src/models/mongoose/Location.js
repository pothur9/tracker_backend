const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, index: true },
    busNumber: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAtIso: { type: Date, required: true },
  },
  { timestamps: true }
);

LocationSchema.index({ busNumber: 1, updatedAtIso: -1 });

module.exports = mongoose.models.Location || mongoose.model('Location', LocationSchema);
