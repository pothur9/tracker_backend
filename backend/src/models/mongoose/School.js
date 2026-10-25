const mongoose = require('mongoose');

const SchoolSchema = new mongoose.Schema(
  {
    schoolName: { type: String, required: true },
    schoolAddress: { type: String, required: true },
    district: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    logoUrl: { type: String },
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'school' },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  },
  { timestamps: true }
);

SchoolSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.School || mongoose.model('School', SchoolSchema);
