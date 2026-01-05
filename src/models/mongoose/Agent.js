const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
