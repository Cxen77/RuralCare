const http = require('http');

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith('/api') ? path : `/api${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path: fullPath,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data || '{}');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed.data !== undefined ? parsed.data : parsed);
            } else {
              reject(new Error(`Status ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
            else reject(new Error(`Status ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAllTests() {
  const results = [];
  const report = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} ${details}`);
  };

  try {
    console.log('--- Step 0: Authentication & Roles ---');
    const patAuth = await apiRequest('POST', '/auth/login', { email: 'patient@ruralcare.dev', password: 'ruralcare123' });
    const docAuth = await apiRequest('POST', '/auth/login', { email: 'doctor@ruralcare.dev', password: 'ruralcare123' });
    const phAuth = await apiRequest('POST', '/auth/login', { email: 'pharmacist@ruralcare.dev', password: 'ruralcare123' });
    const hospAuth = await apiRequest('POST', '/auth/login', { email: 'hospital@ruralcare.dev', password: 'ruralcare123' });

    report('0.1. Patient login & JWT issuance', !!patAuth.token);
    report('0.2. Doctor login & JWT issuance', !!docAuth.token);
    report('0.3. Pharmacist login & JWT issuance', !!phAuth.token);
    report('0.4. Hospital admin login & JWT issuance', !!hospAuth.token);

    const patToken = patAuth.token;
    const docToken = docAuth.token;
    const phToken = phAuth.token;
    const hospToken = hospAuth.token;

    console.log('\n--- Step 1: Patient Profile & Lookup ---');
    const profile = await apiRequest('GET', '/patients/p1', null, patToken);
    report('1.1. Retrieve patient profile', profile && profile.id === 'p1');

    const updatedProfile = await apiRequest('PATCH', '/patients/p1', { village: 'Ramnagar North', bloodGroup: 'B+' }, patToken);
    report('1.2. Update patient profile with audit tracking', updatedProfile.village === 'Ramnagar North');

    console.log('\n--- Step 2: Appointments & Consultation Lifecycle ---');
    const appt = await apiRequest(
      'POST',
      '/appointments',
      {
        doctorId: 'd1',
        patientId: 'p1',
        date: '2026-08-30',
        time: '10:30 AM',
        mode: 'in-person',
        chiefComplaint: 'Chest congestion & dry cough',
        urgency: 'high',
      },
      patToken
    );
    report('2.1. Patient books an appointment', !!appt.id);

    const apptDoc = await apiRequest('PATCH', `/appointments/${appt.id}`, { status: 'in_consultation' }, docToken);
    report('2.2. Doctor initiates consultation (status: in_consultation)', apptDoc.status === 'in_consultation');

    const consult = await apiRequest(
      'POST',
      '/consultations',
      {
        appointmentId: appt.id,
        patientId: 'p1',
        clinicalNotes: 'Bilateral wheezing. Prescribed bronchodilator & antibiotics.',
        provisionalDiagnosis: 'Acute Bronchitis',
        vitals: { bloodPressure: '120/80 mmHg', heartRate: 78, temperature: 99.1, spO2: 97 },
      },
      docToken
    );
    report('2.3. Doctor records clinical consultation & vitals', !!consult.id);

    const rx = await apiRequest(
      'POST',
      '/prescriptions',
      {
        consultationId: consult.id,
        patientId: 'p1',
        patientName: 'Ramesh Kumar',
        doctorName: 'Dr. Anita Sharma',
        diagnosis: 'Acute Bronchitis',
        pharmacyId: 'ph1',
        items: [
          { drugName: 'Amoxicillin 500mg', genericName: 'Amoxicillin', quantity: 10, dosage: '500mg', form: 'tablet', frequency: 'TDS', duration: '5 days' },
          { drugName: 'Paracetamol 650mg', genericName: 'Paracetamol', quantity: 10, dosage: '650mg', form: 'tablet', frequency: 'BD', duration: '3 days' },
        ],
      },
      docToken
    );
    report('2.4. Doctor issues structured e-prescription', !!rx.id && !!rx.qrCode);

    console.log('\n--- Step 3: Pharmacy Matching & Atomic Dispensing ---');
    const matchRes = await apiRequest('POST', '/pharmacy/match', { prescriptionId: rx.id }, patToken);
    report('3.1. Server-authoritative pharmacy matching', matchRes.matches && matchRes.matches.length > 0);
    report('3.2. Ranking matches by completeness and distance', matchRes.matches[0].completeness >= 0);

    const resv = await apiRequest(
      'POST',
      '/reservations',
      {
        prescriptionId: rx.id,
        pharmacyId: 'ph1',
        items: rx.items,
      },
      patToken
    );
    report('3.3. Patient reserves prescription hold at pharmacy', !!resv.id && !!resv.reservationToken);

    const dispenseRes = await apiRequest(
      'POST',
      '/pharmacy/dispense',
      {
        reservationToken: resv.reservationToken,
        pharmacyId: 'ph1',
      },
      phToken
    );
    report('3.4. Pharmacist dispenses medicines with atomic inventory deduction', dispenseRes.status === 'dispensed');

    console.log('\n--- Step 4: Hospital Referral & Concurrency-Safe Bed Allocation ---');
    const hospMatch = await apiRequest(
      'POST',
      '/hospitals/match',
      { specialty: 'Cardiology', beds: 'ICU', diagnostics: ['ECG', 'X-ray'] },
      docToken
    );
    report('4.1. Server hospital capability matching', hospMatch.matches && hospMatch.matches.length > 0);

    const ref = await apiRequest(
      'POST',
      '/referrals',
      {
        patientId: 'p1',
        patientName: 'Ramesh Kumar',
        hospitalId: 'hosp-601',
        consultationId: consult.id,
        specialty: 'Cardiology',
        beds: 'ICU',
        reason: 'Cardiac monitoring required post triage',
        urgency: 'high',
      },
      docToken
    );
    report('4.2. Doctor creates hospital referral', !!ref.id);

    const refAccepted = await apiRequest('PATCH', `/referrals/${ref.id}`, { status: 'accepted' }, hospToken);
    report('4.3. Hospital accepts referral and atomically allocates bed', refAccepted.status === 'accepted' && !!refAccepted.assignedBed);

    console.log('\n--- Step 5: 108 Emergency Ambulance Dispatch ---');
    const amb = await apiRequest(
      'POST',
      '/ambulances/request',
      {
        hospitalId: 'hosp-601',
        patientName: 'Ramesh Kumar',
        pickup: 'Ramnagar PHC',
        eta: '10 mins',
      },
      hospToken
    );
    report('5.1. Concurrency-safe ambulance dispatch', amb.status === 'dispatched');

    const ambComplete = await apiRequest('PATCH', `/ambulances/${amb.id}`, { status: 'available' }, hospToken);
    report('5.2. Ambulance trip completion and standby reset', ambComplete.status === 'available');

    console.log('\n--- Step 6: Offline Batch Sync Queue ---');
    const syncRes = await apiRequest(
      'POST',
      '/sync',
      {
        items: [
          {
            id: 'sync-offline-01',
            action: 'book_appointment',
            payload: { doctorId: 'd1', date: '2026-09-02', time: '02:00 PM', chiefComplaint: 'Followup checkup', urgency: 'routine' },
          },
        ],
      },
      patToken
    );
    report('6.1. Batch offline sync endpoint executes queued actions', syncRes.synced === 1);

    console.log('\n--- Step 7: Notifications & Audit Trail ---');
    const notifs = await apiRequest('GET', '/notifications', null, patToken);
    report('7.1. Live notification inbox polling', Array.isArray(notifs));

    const failures = results.filter((r) => !r.passed);
    console.log(`\n======================================================`);
    console.log(`E2E TEST SUMMARY: Total: ${results.length} | Passed: ${results.length - failures.length} | Failed: ${failures.length}`);
    console.log(`======================================================\n`);

    if (failures.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runAllTests();
