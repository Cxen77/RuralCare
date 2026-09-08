const Notification = require('../models/Notification');
const genId = require('./id');

/**
 * Creates a notification asynchronously and safely.
 * Never throws to avoid failing the main operational flow.
 */
async function sendNotification({
  recipientId,
  role,
  type,
  title,
  message,
  relatedEntity,
}) {
  try {
    if (!recipientId || !message) return null;
    const notif = await Notification.create({
      id: genId('notif'),
      recipientId,
      role: role || 'PATIENT',
      type: type || 'info',
      title: title || 'RuralCare Alert',
      message,
      relatedEntity:
        typeof relatedEntity === 'object' && relatedEntity !== null
          ? `${relatedEntity.type || 'entity'}:${relatedEntity.id || ''}`
          : (relatedEntity || ''),
      read: false,
    });
    return notif;
  } catch (err) {
    console.error('[NOTIFY] Failed to create notification:', err.message);
    return null;
  }
}

module.exports = { sendNotification };
