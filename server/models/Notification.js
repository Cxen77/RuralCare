const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    recipientId: { type: String, required: true }, // patientId / doctorId / pharmacyId / hospitalId
    role: { type: String },
    type: { type: String }, // e.g. 'referral_accepted', 'prescription_ready'
    title: { type: String },
    message: { type: String, required: true },
    relatedEntity: { type: String }, // e.g. 'referral:ref-501'
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, read: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
