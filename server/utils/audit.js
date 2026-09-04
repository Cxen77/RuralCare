const AuditLog = require('../models/AuditLog');

let counter = 0;

// Records a state change. Never throws — auditing must not break the primary operation.
async function writeAudit({ actorId, actorRole, action, entityType, entityId, before, after }) {
  try {
    counter += 1;
    await AuditLog.create({
      id: `audit-${Date.now()}-${counter}`,
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      before,
      after,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[AUDIT] failed to write audit log:', e.message);
  }
}

module.exports = { writeAudit };
