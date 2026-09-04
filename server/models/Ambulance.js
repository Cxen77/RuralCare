const mongoose = require('mongoose');

// Field names (vehicle, driver, pickup) match the hospital portal's fleet UI.
const AmbulanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    hospitalId: { type: String, required: true },
    vehicle: { type: String, required: true },
    driver: { type: String },
    driverPhone: { type: String },
    status: {
      type: String,
      enum: [
        'available',
        'requested',
        'assigned',
        'dispatched',
        'en_route',
        'arrived',
        'transporting',
        'at_hospital',
        'returning',
        'maintenance',
      ],
      default: 'available',
    },
    patientName: { type: String },
    pickup: { type: String },
    currentReferralId: { type: String },
    eta: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ambulance', AmbulanceSchema);
