const mongoose = require('mongoose');

const AppointmentMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  appointmentId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderRole: { type: String, enum: ['PATIENT', 'DOCTOR', 'ADMIN'], required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

AppointmentMessageSchema.index({ appointmentId: 1, createdAt: 1 });

module.exports = mongoose.model('AppointmentMessage', AppointmentMessageSchema);
