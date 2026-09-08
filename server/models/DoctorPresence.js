const mongoose = require('mongoose');

const DoctorPresenceSchema = new mongoose.Schema(
  {
    doctorId: { type: String, required: true, unique: true, index: true },
    doctorName: { type: String, default: 'Doctor' },
    isOnline: { type: Boolean, default: false, index: true },
    lastSeen: { type: Date, default: Date.now },
    socketId: { type: String, default: null },
    deviceInfo: { type: String, default: 'web' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DoctorPresence', DoctorPresenceSchema);
