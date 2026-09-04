const mongoose = require('mongoose');
const { ROLES } = require('../utils/roles');

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    // Link to the domain entity this user acts as; only the relevant one is set.
    patientId: { type: String },
    doctorId: { type: String },
    pharmacyId: { type: String },
    hospitalId: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
