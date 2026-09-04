const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'], default: 'confirmed' },
  mode: { type: String, enum: ['in-person', 'teleconsultation'], required: true },
  chiefComplaint: { type: String },
  aiTriageSummary: { type: String },
  aiSymptoms: [{ type: String }],
  urgency: { type: String, enum: ['routine', 'medium', 'high'], default: 'routine' },
  createdAt: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);
