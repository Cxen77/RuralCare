const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  consultationId: { type: String, required: true },
  patientId: { type: String, required: true },
  doctorId: { type: String, required: true },
  doctorName: { type: String, required: true },
  patientName: { type: String, required: true },
  items: [{
    id: { type: String },
    drugName: { type: String },
    genericName: { type: String },
    dosage: { type: String },
    form: { type: String },
    frequency: { type: String },
    duration: { type: String },
    instructions: { type: String },
    quantity: { type: Number }
  }],
  diagnosis: { type: String },
  qrCode: { type: String, required: true },
  issuedAt: { type: String },
  validUntil: { type: String },
  dispensingStatus: {
    type: String,
    enum: ['pending', 'sent_to_pharmacy', 'confirmed', 'preparing', 'ready_for_pickup', 'partial', 'dispensed', 'cancelled'],
    default: 'pending',
  },
  pharmacyId: { type: String },
  pharmacyName: { type: String },
  reservationToken: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', PrescriptionSchema);
