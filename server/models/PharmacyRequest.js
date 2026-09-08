const mongoose = require('mongoose');

// A prescription routed to a specific pharmacy for fulfillment.
// Fields (prescriptionCode, patientName, availability) match the pharmacy portal's queue UI.
const PharmacyRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    prescriptionId: { type: String, required: true },
    prescriptionCode: { type: String },
    pharmacyId: { type: String, required: true },
    patientId: { type: String },
    patientName: { type: String },
    doctorName: { type: String },
    medicines: [{ type: String }],
    items: [
      {
        id: { type: String },
        drugName: { type: String },
        genericName: { type: String },
        dosage: { type: String },
        form: { type: String },
        frequency: { type: String },
        duration: { type: String },
        instructions: { type: String },
        quantity: { type: Number },
        pricePerUnit: { type: Number },
        available: { type: Boolean },
      },
    ],
    pharmacyName: { type: String },
    reservationToken: { type: String },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'fulfilled', 'dispensed', 'unavailable', 'cancelled', 'responded', 'reserved'],
      default: 'pending',
    },
    availability: { type: String, enum: ['full', 'partial', 'none'] },
    respondedAt: { type: String },
  },
  { timestamps: true }
);

PharmacyRequestSchema.index({ pharmacyId: 1, status: 1 });

module.exports = mongoose.model('PharmacyRequest', PharmacyRequestSchema);
