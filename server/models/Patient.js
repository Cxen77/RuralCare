const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  abhaId: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  locationUpdatedAt: { type: Date },
  village: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  primaryPHC: { type: String, required: true },
  ashaWorker: {
    name: { type: String },
    phone: { type: String }
  },
  language: { type: String, default: 'Hindi' },
  ayushmanEligible: { type: Boolean, default: false },
  bloodGroup: { type: String },
  allergies: [{ type: String }],
  chronicConditions: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Patient', PatientSchema);
