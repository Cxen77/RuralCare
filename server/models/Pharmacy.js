const mongoose = require('mongoose');

const PharmacySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  locationUpdatedAt: { type: Date },
  distanceKm: { type: Number },
  phone: { type: String },
  isJanAushadhi: { type: Boolean, default: false },
  operatingHours: { type: String },
  rating: { type: Number },
  inventory: [{
    drugName: { type: String },
    genericName: { type: String },
    form: { type: String },
    dosage: { type: String },
    quantity: { type: Number },
    pricePerUnit: { type: Number },
    isJanAushadhi: { type: Boolean },
    expiryDate: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Pharmacy', PharmacySchema);
