const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  qualification: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  clinicName: { type: String, required: true },
  clinicAddress: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  locationUpdatedAt: { type: Date },
  distanceKm: { type: Number },
  rating: { type: Number },
  reviewCount: { type: Number },
  isAvailable: { type: Boolean, default: true },
  ayushmanPaneled: { type: Boolean, default: false },
  consultationFee: { type: Number, default: 0 },
  teleconsultation: { type: Boolean, default: false },
  schedule: { type: mongoose.Schema.Types.Mixed },
  maxPatientsPerDay: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', DoctorSchema);
