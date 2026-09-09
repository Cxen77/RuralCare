const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  address: { type: String, required: true },
  distanceKm: { type: Number },
  phone: { type: String },
  rating: { type: Number },
  latitude: { type: Number },
  longitude: { type: Number },
  locationUpdatedAt: { type: Date },
  capabilities: {
    icuBeds: { type: Number },
    generalBeds: { type: Number },
    availableBeds: { type: Number },
    hasCtScan: { type: Boolean },
    hasMri: { type: Boolean },
    hasXray: { type: Boolean },
    hasUltrasound: { type: Boolean },
    hasPathology: { type: Boolean },
    hasBloodBank: { type: Boolean },
    specialties: [{ type: String }],
    ambulanceCount: { type: Number }
  },
  // Canonical operational capacity read by the hospital portal.
  beds: {
    general: { type: Number, default: 0 },
    icu: { type: Number, default: 0 },
    emergency: { type: Number, default: 0 },
    ventilator: { type: Number, default: 0 }
  },
  totalBeds: {
    general: { type: Number, default: 20 },
    icu: { type: Number, default: 5 },
    emergency: { type: Number, default: 10 },
    ventilator: { type: Number, default: 2 }
  },
  acceptingEmergency: { type: Boolean, default: true },
  emergencyHelpline: { type: String },
  nodalOfficer: { type: String },
  contactEmail: { type: String },
  operatingHours: { type: String, default: '24x7 Emergency & Inpatient Services' },
  blood: { type: mongoose.Schema.Types.Mixed, default: {} },
  diagnostics: [{ type: String }],
  departments: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Hospital', HospitalSchema);
