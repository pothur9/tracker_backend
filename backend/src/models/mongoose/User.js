const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    city: { type: String, required: true },
    schoolName: { type: String, required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    name: { type: String, required: true },
    fatherName: { type: String, required: true },
    gender: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    busNumber: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    role: { type: String, default: 'user' },
    // FCM token for push notifications
    fcmToken: { type: String },
    // Index of the stop along the driver's route this user belongs to
    stopIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
