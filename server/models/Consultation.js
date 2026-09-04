const mongoose = require('mongoose');

const ConsultationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  appointmentId: { type: String, required: true },
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  vitals: {
    bloodPressure: { type: String },
    heartRate: { type: Number },
    temperature: { type: Number },
    spO2: { type: Number },
    weight: { type: Number }
  },
  clinicalNotes: { type: String },
  provisionalDiagnosis: { type: String },
  prescriptionId: { type: String },
  referralId: { type: String },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  completedAt: { type: String },
  followUpDate: { type: String },
  followUpNotes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Consultation', ConsultationSchema);
