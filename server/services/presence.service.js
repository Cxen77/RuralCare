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

function cleanDoctorName(name) {
  if (!name) return 'Doctor';
  const stripped = name.replace(/^(Dr\.?\s*)+/i, '').trim();
  return stripped ? `Dr. ${stripped}` : 'Doctor';
}

/**
 * Preload active presence records from MongoDB on server startup.
 */
async function initPresence() {
  try {
    const records = await DoctorPresence.find({ isOnline: true }).lean();
    records.forEach((r) => {
      presenceCache.set(r.doctorId, {
        isOnline: true,
        lastSeen: r.lastSeen || new Date(),
        socketId: r.socketId,
        doctorName: cleanDoctorName(r.doctorName),
      });
    });
    if (records.length > 0) {
      console.log(`[presence] Preloaded ${records.length} online doctor(s) from database`);
    }
  } catch (err) {
    console.error('[presence] Failed to preload online doctors:', err.message);
  }
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

  const normalizedName = cleanDoctorName(doctorName);
  const now = new Date();
  const entry = {
    isOnline: true,
    lastSeen: now,
    socketId,
    doctorName: normalizedName,
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
          doctorName: normalizedName,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (err) {
    console.error('[presence] Failed to persist online status for doctor:', doctorId, err.message);
  }

  broadcastPresence(doctorId, true, now);
  console.log(`[presence] Doctor ${doctorId} (${normalizedName}) is now ONLINE`);
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
 * Asynchronous check for doctor online status.
 * Checks:
 * 1. Active grace-period / disconnect timers
 * 2. In-memory presence cache
 * 3. MongoDB DoctorPresence record
 * 4. Doctor active availability status (Doctor.isAvailable !== false)
 */
async function isDoctorOnlineAsync(doctorId) {
  if (disconnectTimers.has(doctorId)) return true;
  const entry = presenceCache.get(doctorId);
  if (entry && entry.isOnline) return true;

  try {
    const record = await DoctorPresence.findOne({ doctorId }).lean();
    if (record && record.isOnline) {
      presenceCache.set(doctorId, {
        isOnline: true,
        lastSeen: record.lastSeen || new Date(),
        socketId: record.socketId,
        doctorName: cleanDoctorName(record.doctorName),
      });
      return true;
    }

    const doc = await Doctor.findOne({ id: doctorId }).lean();
    if (doc && doc.isAvailable !== false) {
      return true;
    }
  } catch (err) {
    console.error('[presence] isDoctorOnlineAsync error:', err.message);
  }

  return false;
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
      doctorName: cleanDoctorName(cached.doctorName),
    };
  }

  // Fallback to database
  const record = await DoctorPresence.findOne({ doctorId }).lean();
  if (record) {
    const normalizedName = cleanDoctorName(record.doctorName);
    presenceCache.set(doctorId, {
      isOnline: record.isOnline,
      lastSeen: record.lastSeen,
      socketId: record.socketId,
      doctorName: normalizedName,
    });
    return {
      doctorId,
      isOnline: record.isOnline,
      lastSeen: record.lastSeen,
      doctorName: normalizedName,
    };
  }

  // Default record from Doctor collection
  const doc = await Doctor.findOne({ id: doctorId }).lean();
  return {
    doctorId,
    isOnline: doc?.isAvailable !== false,
    lastSeen: doc?.updatedAt || new Date(0),
    doctorName: cleanDoctorName(doc?.name || 'Doctor'),
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
      doctorName: cleanDoctorName(r.doctorName),
    };
  });

  // Also include any in-memory cached entries
  presenceCache.forEach((val, docId) => {
    map[docId] = {
      isOnline: isDoctorOnline(docId),
      lastSeen: val.lastSeen,
      doctorName: cleanDoctorName(val.doctorName),
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
  initPresence,
  setDoctorOnline,
  setDoctorOffline,
  isDoctorOnline,
  isDoctorOnlineAsync,
  getDoctorPresence,
  getAllPresence,
  touchHeartbeat,
};
