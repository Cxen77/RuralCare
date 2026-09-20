const mongoose = require('mongoose');
const genId = require('../utils/id');

const EmergencyTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['reported', 'verified', 'dispatched', 'arrived', 'resolved'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: String, default: 'System' },
    role: { type: String, default: 'system' }, // citizen | doctor | hospital | system
  },
  { _id: false }
);

const EmergencyReportSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: () => genId('emg'),
    },
    reporterId: {
      type: String,
      required: true,
      default: () => genId('rep'),
    },
    reporterName: { type: String, default: 'Community Member' },
    reporterPhone: { type: String, default: '' },

    // Cloudinary details (URL and public ID only, never base64)
    imageUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },

    // Coordinates and 2dsphere location
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    address: { type: String, default: 'Location coordinate lock' },

    emergencyType: {
      type: String,
      enum: ['road_accident', 'medical_emergency', 'fire', 'natural_hazard', 'other'],
      default: 'road_accident',
      required: true,
    },
    description: {
      type: String,
      maxlength: 150,
      default: '',
    },

    status: {
      type: String,
      enum: ['reported', 'verified', 'dispatched', 'resolved'],
      default: 'reported',
      index: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'moderate'],
      default: 'high',
    },

    // Responding hospital & physician assignments
    assignedHospitalId: { type: String, default: null },
    assignedHospitalName: { type: String, default: null },
    assignedDoctorId: { type: String, default: null },
    assignedDoctorName: { type: String, default: null },

    // Ambulance dispatch state
    ambulanceId: { type: String, default: null },
    ambulanceVehicle: { type: String, default: null },
    driverName: { type: String, default: null },
    driverPhone: { type: String, default: null },
    etaMinutes: { type: Number, default: null },
    ambulanceStatus: {
      type: String,
      enum: ['none', 'dispatched', 'en_route', 'arrived', 'transporting', 'at_hospital', 'completed'],
      default: 'none',
    },

    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: null },

    timeline: [EmergencyTimelineSchema],
  },
  { timestamps: true }
);

EmergencyReportSchema.index({ location: '2dsphere' });
EmergencyReportSchema.index({ latitude: 1, longitude: 1 });
EmergencyReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyReport', EmergencyReportSchema);
