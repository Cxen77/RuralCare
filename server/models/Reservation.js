const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  prescriptionId: { type: String, required: true },
  pharmacyId: { type: String, required: true },
  patientId: { type: String, required: true },
  patientName: { type: String },
  prescriptionCode: { type: String },
  reservationToken: { type: String, required: true },
  items: [{
    id: { type: String },
    drugName: { type: String },
    genericName: { type: String },
    dosage: { type: String },
    form: { type: String },
    frequency: { type: String },
    duration: { type: String },
    instructions: { type: String },
    quantity: { type: Number },
    pricePerUnit: { type: Number }
  }],
  totalCost: { type: Number },
  status: { type: String, enum: ['pending', 'reserved', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired'], default: 'reserved' },
  reservedAt: { type: String },
  expiresAt: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Reservation', ReservationSchema);
