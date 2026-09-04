const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  hospitalId: { type: String, required: true },
  consultationId: { type: String, required: true },
  reason: { type: String, required: true },
  requiredCapabilities: [{ type: String }],
  // Denormalized display fields shared by doctor (writer) and hospital (reader) portals.
  patientName: { type: String },
  referringDoctor: { type: String },
  specialty: { type: String },
  beds: { type: String },
  diagnostics: [{ type: String }],
  hospitalName: { type: String },
  urgency: { type: String, enum: ['routine', 'medium', 'high'], default: 'routine' },
  status: {
    type: String,
    enum: ['created', 'searching', 'pending_hospital_response', 'pending', 'accepted', 'rejected', 'transferred', 'admitted', 'completed', 'cancelled'],
    default: 'pending'
  },
  ambulanceDispatched: { type: Boolean, default: false },
  ambulanceEta: { type: String },
  notes: { type: String },
  respondedAt: { type: String },
  assignedDepartment: { type: String },
  assignedBed: { type: String },
  createdAt: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Referral', ReferralSchema);
