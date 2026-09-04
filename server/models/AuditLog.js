const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    actorId: { type: String },
    actorRole: { type: String },
    action: { type: String, required: true }, // e.g. 'appointment.status_change'
    entityType: { type: String },
    entityId: { type: String },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    at: { type: String },
  },
  { timestamps: true }
);

AuditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
