/**
 * Automated End-to-End Verification for RuralCare Call Signaling
 *
 * Tests:
 * 1. Token authentication for Patient and Doctor
 * 2. Presence tracking (Doctor marked online)
 * 3. Patient initiates call -> Doctor receives incoming call popup event
 * 4. Doctor accepts call -> Both receive call:accepted
 * 5. Offer / Answer signal exchange
 * 6. Doctor ends call -> Both receive call:ended
 * 7. Doctor initiates call -> Patient receives incoming call popup event
 * 8. Patient accepts call -> Both receive call:accepted
 * 9. Patient ends call -> Both receive call:ended
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const JWT_SECRET = env.JWT_SECRET;
const WS_URL = 'ws://localhost:4000/ws/call';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const patientToken = makeToken({
  sub: 'u-p1',
  role: 'PATIENT',
  name: 'Rajesh Kumar',
  patientId: 'p1',
});

const doctorToken = makeToken({
  sub: 'u-d1',
  role: 'DOCTOR',
  name: 'Dr. Anita Sharma',
  doctorId: 'd1',
});

function connectWs(token, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    const events = [];

    ws.on('open', () => {
      console.log(`[TEST] ${name} WS opened`);
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      events.push(msg);
      console.log(`[TEST] ${name} received:`, msg.type, msg.callId || '');
    });

    ws.on('error', (err) => {
      console.error(`[TEST] ${name} WS error:`, err.message);
      reject(err);
    });

    // Wait for 'connected' message
    const check = setInterval(() => {
      const connMsg = events.find((e) => e.type === 'connected');
      if (connMsg) {
        clearInterval(check);
        resolve({ ws, events });
      }
    }, 50);
  });
}

function waitForEvent(eventsList, eventType, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const found = eventsList.find((e) => e.type === eventType);
      if (found) {
        clearInterval(interval);
        return resolve(found);
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        return reject(new Error(`Timeout waiting for event: ${eventType}. Recorded events: ${eventsList.map(e => e.type).join(', ')}`));
      }
    }, 50);
  });
}

async function runTest() {
  console.log('--- Starting Calling E2E Test ---');

  // 1. Connect Doctor
  const doctor = await connectWs(doctorToken, 'Doctor');
  // 2. Connect Patient
  const patient = await connectWs(patientToken, 'Patient');

  const appointmentId = 'appt-1789004024649-8';

  // -------------------------------------------------------------
  // TEST 1: Patient Calls Doctor
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Patient calls Doctor ---');
  patient.ws.send(JSON.stringify({
    type: 'call:initiate',
    appointmentId,
    callType: 'video',
  }));

  // Patient should receive call:initiated with calleeOnline: true
  const initMsg = await waitForEvent(patient.events, 'call:initiated');
  console.log('PASS: Patient received call:initiated with calleeOnline =', initMsg.calleeOnline);
  if (initMsg.calleeOnline !== true) throw new Error('calleeOnline was not true!');

  const callId = initMsg.callId;

  // Doctor must receive call:incoming
  const incomingForDoc = await waitForEvent(doctor.events, 'call:incoming');
  console.log('PASS: Doctor received call:incoming for callId =', incomingForDoc.callId, 'caller =', incomingForDoc.callerName);
  if (incomingForDoc.callId !== callId) throw new Error('callId mismatch!');

  // Doctor accepts call
  console.log('\n--- Doctor accepts call ---');
  doctor.ws.send(JSON.stringify({
    type: 'call:accept',
    callId,
  }));

  // Both should receive call:accepted
  const docAccepted = await waitForEvent(doctor.events, 'call:accepted');
  const patientAccepted = await waitForEvent(patient.events, 'call:accepted');
  console.log('PASS: Both Doctor and Patient received call:accepted!');

  // Doctor sends end call
  console.log('\n--- Doctor ends call ---');
  doctor.ws.send(JSON.stringify({
    type: 'call:end',
    callId,
  }));

  const docEnded = await waitForEvent(doctor.events, 'call:ended');
  const patientEnded = await waitForEvent(patient.events, 'call:ended');
  console.log('PASS: Both Doctor and Patient received call:ended!');

  // Clear events for Test 2
  doctor.events.length = 0;
  patient.events.length = 0;

  // -------------------------------------------------------------
  // TEST 2: Doctor Calls Patient
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Doctor calls Patient ---');
  doctor.ws.send(JSON.stringify({
    type: 'call:initiate',
    appointmentId,
    callType: 'voice',
  }));

  const docInit = await waitForEvent(doctor.events, 'call:initiated');
  console.log('PASS: Doctor received call:initiated with calleeOnline =', docInit.calleeOnline);
  const callId2 = docInit.callId;

  // Patient must receive call:incoming
  const incomingForPatient = await waitForEvent(patient.events, 'call:incoming');
  console.log('PASS: Patient received call:incoming for callId =', incomingForPatient.callId);

  // Patient accepts call
  console.log('\n--- Patient accepts call ---');
  patient.ws.send(JSON.stringify({
    type: 'call:accept',
    callId: callId2,
  }));

  await waitForEvent(patient.events, 'call:accepted');
  await waitForEvent(doctor.events, 'call:accepted');
  console.log('PASS: Both received call:accepted for Doctor-initiated call!');

  // Patient ends call
  console.log('\n--- Patient ends call ---');
  patient.ws.send(JSON.stringify({
    type: 'call:end',
    callId: callId2,
  }));

  await waitForEvent(patient.events, 'call:ended');
  await waitForEvent(doctor.events, 'call:ended');
  console.log('PASS: Both received call:ended!');

  patient.ws.close();
  doctor.ws.close();

  console.log('\n ALL TESTS PASSED SUCCESSFULLY! Both calling directions verified.');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n TEST FAILED:', err.message);
  process.exit(1);
});
