/**
 * RuralCare Call Signaling Service
 *
 * WebSocket-based signaling server for 1-to-1 WebRTC calls.
 * Handles: doctor presence, call initiation, ringing, accept/decline,
 * SDP/ICE exchange, mode switching, and termination.
 * Enforces JWT authentication, 10-step appointment authorization, and session security.
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Appointment = require('../models/Appointment');
const CallSession = require('../models/CallSession');
const presenceService = require('./presence.service');
const genId = require('../utils/id');

// Active WebSocket connections: key = unique identifier (patientId, doctorId, or sub), value = ws
const clients = new Map();
// Active calls: key = callSessionId, value = { callSession, callerKey, calleeKey, timeout }
const activeCalls = new Map();

const CALL_TIMEOUT_MS = 45000; // 45 seconds to answer

function authenticateToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
}

function getUserKeys(user) {
  const keys = new Set();
  if (user.doctorId) keys.add(user.doctorId);
  if (user.patientId) keys.add(user.patientId);
  if (user.sub) keys.add(user.sub);
  if (user.id) keys.add(user.id);
  return Array.from(keys);
}

function sendToClient(userKey, payload) {
  const ws = clients.get(userKey);
  if (ws && ws.readyState === 1) { // WebSocket.OPEN
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch {}
  }
  return false;
}

/**
 * 10-Step Appointment Authorization
 */
async function verifyCallAccess(user, appointmentId) {
  // Step 2: Validate appointment
  const appt = await Appointment.findOne({ id: appointmentId }).lean();
  if (!appt) throw new Error('Appointment not found.');

  // Step 6: Confirm teleconsultation mode
  if (appt.mode !== 'teleconsultation' && appt.mode !== 'video') {
    throw new Error('Only teleconsultation appointments support calls.');
  }

  // Step 7: Confirm appointment is in active status
  const ineligible = ['cancelled', 'completed', 'no_show'];
  if (ineligible.includes(appt.status)) {
    throw new Error('This appointment is no longer active.');
  }

  const role = user.role;
  // Step 4 & 5: Validate doctor is assigned to appointment
  if (role === 'DOCTOR' && appt.doctorId !== user.doctorId && appt.doctorId !== user.sub) {
    throw new Error('You are not the doctor on this appointment.');
  }
  // Step 3: Validate patient is assigned to appointment
  if (role === 'PATIENT' && appt.patientId !== (user.patientId || user.sub)) {
    throw new Error('You are not the patient on this appointment.');
  }

  return appt;
}

function getCalleeKey(appt, callerUser) {
  if (callerUser.role === 'PATIENT') return appt.doctorId;
  return appt.patientId;
}

function createMediaSessionToken(callId, appt, role) {
  return jwt.sign(
    {
      callId,
      appointmentId: appt.id,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      role,
    },
    env.JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function handleInitiate(ws, user, data) {
  const { appointmentId, callType = 'video' } = data;
  if (!appointmentId) {
    return ws.send(JSON.stringify({ type: 'call:error', error: 'appointmentId required' }));
  }

  try {
    // Step 1 - 7: Authorization checks
    const appt = await verifyCallAccess(user, appointmentId);
    const callerKey = user.role === 'DOCTOR' ? (user.doctorId || user.sub) : (user.patientId || user.sub);
    const calleeKey = getCalleeKey(appt, user);

    // Step 8: Confirm doctor is online if patient is initiating
    if (user.role === 'PATIENT') {
      const isOnline = presenceService.isDoctorOnline(appt.doctorId) || clients.has(calleeKey);
      if (!isOnline) {
        const presence = await presenceService.getDoctorPresence(appt.doctorId);
        return ws.send(JSON.stringify({
          type: 'call:error',
          code: 'DOCTOR_OFFLINE',
          error: `Dr. ${presence.doctorName || 'Doctor'} is currently offline.`,
          lastSeen: presence.lastSeen,
        }));
      }
    }

    // Step 9: Create unique CallSession in MongoDB
    const callSessionId = genId('call');
    await CallSession.create({
      id: callSessionId,
      appointmentId,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      callType: callType === 'voice' ? 'voice' : 'video',
      initiatedBy: user.role,
      status: 'calling',
      startedAt: new Date(),
    });

    // Step 10: Create appointment-specific media session token
    const mediaSessionToken = createMediaSessionToken(callSessionId, appt, user.role);

    const callState = {
      callId: callSessionId,
      appointmentId,
      callType: callType === 'voice' ? 'voice' : 'video',
      status: 'calling',
      connectedAt: null,
      callerKey,
      calleeKey,
      mediaSessionToken,
      timeout: null,
    };

    activeCalls.set(callSessionId, callState);

    // Confirm initiation to caller
    ws.send(JSON.stringify({
      type: 'call:initiated',
      callId: callSessionId,
      appointmentId,
      callType: callState.callType,
      mediaSessionToken,
    }));

    // Step 10 (cont.): Send incoming call event to callee
    const calleeSent = sendToClient(calleeKey, {
      type: 'call:incoming',
      callId: callSessionId,
      appointmentId,
      patientId: appt.patientId,
      patientName: user.name || 'Patient',
      callType: callState.callType,
      callerName: user.name || 'Caller',
      callerRole: user.role,
      callerKey,
      mediaSessionToken: createMediaSessionToken(callSessionId, appt, user.role === 'PATIENT' ? 'DOCTOR' : 'PATIENT'),
    });

    if (calleeSent) {
      callState.status = 'ringing';
      CallSession.updateOne({ id: callSessionId }, { status: 'ringing' }).catch(() => {});
      ws.send(JSON.stringify({ type: 'call:ringing', callId: callSessionId }));
    }

    // Set timeout for unanswered calls (45 seconds)
    callState.timeout = setTimeout(async () => {
      const call = activeCalls.get(callSessionId);
      if (call && (call.status === 'calling' || call.status === 'ringing')) {
        call.status = 'missed';
        activeCalls.delete(callSessionId);
        await CallSession.updateOne(
          { id: callSessionId },
          { status: 'missed', endedAt: new Date(), endReason: 'timeout' }
        ).catch(() => {});

        sendToClient(callerKey, { type: 'call:missed', callId: callSessionId });
        sendToClient(calleeKey, { type: 'call:missed', callId: callSessionId });
      }
    }, CALL_TIMEOUT_MS);

  } catch (err) {
    ws.send(JSON.stringify({ type: 'call:error', error: err.message }));
  }
}

async function handleAccept(ws, user, data) {
  const { callId } = data;
  const call = activeCalls.get(callId);
  if (!call) {
    return ws.send(JSON.stringify({ type: 'call:error', error: 'Call not found or already ended.' }));
  }

  const userKeys = getUserKeys(user);
  if (!userKeys.includes(call.calleeKey)) {
    return ws.send(JSON.stringify({ type: 'call:error', error: 'You are not the callee on this call.' }));
  }

  // Clear unanswered timeout
  if (call.timeout) {
    clearTimeout(call.timeout);
    call.timeout = null;
  }

  const now = new Date();
  call.status = 'connected';
  call.connectedAt = now;
  await CallSession.updateOne({ id: callId }, { status: 'connected', connectedAt: now }).catch(() => {});

  // Send call:accepted to caller
  sendToClient(call.callerKey, {
    type: 'call:accepted',
    callId,
    callType: call.callType,
    mediaSessionToken: call.mediaSessionToken,
  });

  // Confirm call:accepted to callee
  ws.send(JSON.stringify({
    type: 'call:accepted',
    callId,
    callType: call.callType,
    mediaSessionToken: call.mediaSessionToken,
  }));
}

async function handleDecline(ws, user, data) {
  const { callId } = data;
  const call = activeCalls.get(callId);
  if (!call) return;

  if (call.timeout) {
    clearTimeout(call.timeout);
    call.timeout = null;
  }

  call.status = 'declined';
  activeCalls.delete(callId);
  await CallSession.updateOne({ id: callId }, { status: 'declined', endedAt: new Date(), endReason: 'declined' }).catch(() => {});

  sendToClient(call.callerKey, { type: 'call:declined', callId });
  sendToClient(call.calleeKey, { type: 'call:declined', callId });
}

async function handleSignal(ws, user, data) {
  const { callId, signal } = data;
  const call = activeCalls.get(callId);
  if (!call) return;

  const userKeys = getUserKeys(user);
  const isCaller = userKeys.includes(call.callerKey);
  const targetKey = isCaller ? call.calleeKey : call.callerKey;

  sendToClient(targetKey, {
    type: 'call:signal',
    callId,
    signal,
    from: isCaller ? call.callerKey : call.calleeKey,
  });
}

async function handleSwitchMode(ws, user, data) {
  const { callId, callType } = data;
  const call = activeCalls.get(callId);
  if (!call) return;

  call.callType = callType;
  await CallSession.updateOne({ id: callId }, { callType }).catch(() => {});

  const userKeys = getUserKeys(user);
  const isCaller = userKeys.includes(call.callerKey);
  const targetKey = isCaller ? call.calleeKey : call.callerKey;

  sendToClient(targetKey, {
    type: 'call:mode_switched',
    callId,
    callType,
  });
}

async function handleEnd(ws, user, data) {
  const { callId } = data;
  const call = activeCalls.get(callId);
  if (!call) return;

  if (call.timeout) {
    clearTimeout(call.timeout);
    call.timeout = null;
  }

  const now = new Date();
  const durationSeconds = call.connectedAt ? Math.round((now - call.connectedAt) / 1000) : 0;
  call.status = 'completed';
  activeCalls.delete(callId);

  await CallSession.updateOne(
    { id: callId },
    { status: 'completed', endedAt: now, durationSeconds, endReason: 'user_ended' }
  ).catch(() => {});

  sendToClient(call.callerKey, { type: 'call:ended', callId, reason: 'user_ended' });
  sendToClient(call.calleeKey, { type: 'call:ended', callId, reason: 'user_ended' });
}

function handleDisconnect(user) {
  const keys = getUserKeys(user);
  keys.forEach((k) => clients.delete(k));

  // If a doctor disconnected, initiate presence grace period
  if (user.role === 'DOCTOR' && user.doctorId) {
    presenceService.setDoctorOffline(user.doctorId);
  }

  // End any active calls this user was in
  for (const [callId, call] of activeCalls.entries()) {
    if (keys.includes(call.callerKey) || keys.includes(call.calleeKey)) {
      if (call.timeout) { clearTimeout(call.timeout); call.timeout = null; }

      const otherKey = keys.includes(call.callerKey) ? call.calleeKey : call.callerKey;
      const now = new Date();
      const isConnected = call.status === 'connected';
      const durationSeconds = (isConnected && call.connectedAt) ? Math.round((now - call.connectedAt) / 1000) : 0;

      activeCalls.delete(callId);
      CallSession.updateOne(
        { id: callId },
        {
          status: isConnected ? 'completed' : 'failed',
          endedAt: now,
          durationSeconds,
          endReason: 'peer_disconnected',
        }
      ).catch(() => {});

      sendToClient(otherKey, { type: 'call:ended', callId, reason: 'peer_disconnected' });
    }
  }
}

/**
 * Initialize the WebSocket signaling server on an existing HTTP server.
 */
function initCallSignaling(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/call' });
  presenceService.setWss(wss);

  wss.on('connection', (ws, req) => {
    // Extract token from query string: /ws/call?token=xxx
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    const user = authenticateToken(token);
    if (!user) {
      ws.send(JSON.stringify({ type: 'error', error: 'Authentication failed.' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    const keys = getUserKeys(user);
    // Register socket under all user identifiers (doctorId, patientId, sub)
    keys.forEach((k) => clients.set(k, ws));

    ws._rcUser = user;

    // Doctor Presence: Mark online immediately upon WebSocket connection
    if (user.role === 'DOCTOR' && (user.doctorId || user.sub)) {
      const docId = user.doctorId || user.sub;
      presenceService.setDoctorOnline(docId, user.name, docId);
    }

    ws.send(JSON.stringify({
      type: 'connected',
      userKeys: keys,
      role: user.role,
      name: user.name,
    }));

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        case 'call:initiate': return handleInitiate(ws, user, msg);
        case 'call:accept': return handleAccept(ws, user, msg);
        case 'call:decline': return handleDecline(ws, user, msg);
        case 'call:signal': return handleSignal(ws, user, msg);
        case 'call:switch_mode': return handleSwitchMode(ws, user, msg);
        case 'call:end': return handleEnd(ws, user, msg);
        case 'ping':
          if (user.role === 'DOCTOR' && (user.doctorId || user.sub)) {
            presenceService.touchHeartbeat(user.doctorId || user.sub);
          }
          return ws.send(JSON.stringify({ type: 'pong' }));
        default: break;
      }
    });

    ws.on('close', () => handleDisconnect(user));
    ws.on('error', () => handleDisconnect(user));
  });

  console.log('[signaling] WebSocket call signaling ready at /ws/call with live presence integration');
  return wss;
}

module.exports = { initCallSignaling };
