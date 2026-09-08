/**
 * RuralCare Doctor Real-Time Presence Service
 *
 * Tracks live doctor presence with in-memory caching and persistent MongoDB updates.
 * Implements a 15-second disconnect grace period to avoid status flickering on brief reloads/blips.
 */

const DoctorPresence = require('../models/DoctorPresence');
const Doctor = require('../models/Doctor');

// In-memory cache: doctorId -> { isOnline: boolean, lastSeen: Date, socketId: string|null, doctorName: string }
const presenceCache = new Map();
// Pending disconnect timers: doctorId -> setTimeout
const disconnectTimers = new Map();

const GRACE_PERIOD_MS = 15000; // 15 seconds grace period before marking offline
let wssInstance = null;

function setWss(wss) {
  wssInstance = wss;
}

function broadcastPresence(doctorId, isOnline, lastSeen) {
  if (!wssInstance) return;
  const payload = JSON.stringify({
    type: 'presence:update',
    doctorId,
    isOnline,
    lastSeen,
  });

  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      try { client.send(payload); } catch {}
    }
  });
}

/**
 * Marks a doctor as ONLINE immediately. Clears any pending disconnect grace timer.
 */
async function setDoctorOnline(doctorId, doctorName = 'Doctor', socketId = null) {
  // Clear pending disconnect timer if any
  if (disconnectTimers.has(doctorId)) {
    clearTimeout(disconnectTimers.get(doctorId));
    disconnectTimers.delete(doctorId);
  }

  const now = new Date();
  const entry = {
    isOnline: true,
    lastSeen: now,
    socketId,
    doctorName,
  };
  presenceCache.set(doctorId, entry);

  try {
    await DoctorPresence.findOneAndUpdate(
      { doctorId },
      {
        $set: {
          isOnline: true,
          lastSeen: now,
          socketId,
          doctorName,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (err) {
    console.error('[presence] Failed to persist online status for doctor:', doctorId, err.message);
  }

  broadcastPresence(doctorId, true, now);
  console.log(`[presence] Doctor ${doctorId} (${doctorName}) is now ONLINE`);
}

/**
 * Initiates an offline transition with a 15-second grace period.
 */
function setDoctorOffline(doctorId) {
  if (disconnectTimers.has(doctorId)) {
    clearTimeout(disconnectTimers.get(doctorId));
  }

  const timer = setTimeout(async () => {
    disconnectTimers.delete(doctorId);
    const now = new Date();
    const current = presenceCache.get(doctorId);
    if (current) {
      current.isOnline = false;
      current.lastSeen = now;
      current.socketId = null;
    }

    try {
      await DoctorPresence.findOneAndUpdate(
        { doctorId },
        {
          $set: {
            isOnline: false,
            lastSeen: now,
            socketId: null,
          },
        },
        { returnDocument: 'after' }
      );
    } catch (err) {
      console.error('[presence] Failed to persist offline status for doctor:', doctorId, err.message);
    }

    broadcastPresence(doctorId, false, now);
    console.log(`[presence] Doctor ${doctorId} marked OFFLINE after grace period`);
  }, GRACE_PERIOD_MS);

  disconnectTimers.set(doctorId, timer);
}

/**
 * Synchronous check for doctor online status from cache.
 */
function isDoctorOnline(doctorId) {
  // If there is a pending disconnect timer, doctor is still in grace period (online)
  if (disconnectTimers.has(doctorId)) return true;
  const entry = presenceCache.get(doctorId);
  return !!entry?.isOnline;
}

/**
 * Gets doctor presence info.
 */
async function getDoctorPresence(doctorId) {
  const cached = presenceCache.get(doctorId);
  if (cached) {
    return {
      doctorId,
      isOnline: isDoctorOnline(doctorId),
      lastSeen: cached.lastSeen,
      doctorName: cached.doctorName,
    };
  }

  // Fallback to database
  const record = await DoctorPresence.findOne({ doctorId }).lean();
  if (record) {
    presenceCache.set(doctorId, {
      isOnline: record.isOnline,
      lastSeen: record.lastSeen,
      socketId: record.socketId,
      doctorName: record.doctorName,
    });
    return {
      doctorId,
      isOnline: record.isOnline,
      lastSeen: record.lastSeen,
      doctorName: record.doctorName,
    };
  }

  // Default record from Doctor collection
  const doc = await Doctor.findOne({ id: doctorId }).lean();
  return {
    doctorId,
    isOnline: false,
    lastSeen: doc?.updatedAt || new Date(0),
    doctorName: doc?.name || 'Doctor',
  };
}

/**
 * Gets all presence records as a key-value map.
 */
async function getAllPresence() {
  const records = await DoctorPresence.find({}).lean();
  const map = {};

  records.forEach((r) => {
    const isOnline = isDoctorOnline(r.doctorId);
    map[r.doctorId] = {
      isOnline,
      lastSeen: r.lastSeen,
      doctorName: r.doctorName,
    };
  });

  // Also include any in-memory cached entries
  presenceCache.forEach((val, docId) => {
    map[docId] = {
      isOnline: isDoctorOnline(docId),
      lastSeen: val.lastSeen,
      doctorName: val.doctorName,
    };
  });

  return map;
}

/**
 * Updates lastSeen timestamp on heartbeat.
 */
function touchHeartbeat(doctorId) {
  const now = new Date();
  const entry = presenceCache.get(doctorId);
  if (entry) {
    entry.lastSeen = now;
  }
}

module.exports = {
  setWss,
  setDoctorOnline,
  setDoctorOffline,
  isDoctorOnline,
  getDoctorPresence,
  getAllPresence,
  touchHeartbeat,
};
