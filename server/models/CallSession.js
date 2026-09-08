const mongoose = require('mongoose');

const CallSessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  appointmentId: { type: String, required: true, index: true },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  callType: { type: String, enum: ['video', 'voice'], required: true },
  initiatedBy: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  status: {
    type: String,
    enum: ['calling', 'ringing', 'connected', 'completed', 'declined', 'missed', 'failed'],
    default: 'calling'
  },
  startedAt: { type: Date, default: Date.now },
  connectedAt: { type: Date },
  endedAt: { type: Date },
  durationSeconds: { type: Number, default: 0 },
  endReason: { type: String },
}, { timestamps: true });

CallSessionSchema.index({ appointmentId: 1, createdAt: -1 });

module.exports = mongoose.model('CallSession', CallSessionSchema);
