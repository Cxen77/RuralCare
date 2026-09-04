/**
 * Deterministic, idempotent seed for the RuralCare demo baseline.
 *
 * Safe to run repeatedly: every document is written with $setOnInsert, so an
 * existing record is never overwritten and live operational state (inventory
 * quantities, bed counts, statuses) survives re-seeding. Nothing is deleted.
 * Refuses to run against production unless SEED_ALLOW_PROD=true.
 */
const bcrypt = require('bcryptjs');

const env = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');

const User = require('./models/User');
const Patient = require('./models/Patient');
const Doctor = require('./models/Doctor');
const Pharmacy = require('./models/Pharmacy');
const Hospital = require('./models/Hospital');
const Appointment = require('./models/Appointment');
const Consultation = require('./models/Consultation');
const Prescription = require('./models/Prescription');
const PharmacyRequest = require('./models/PharmacyRequest');
const Referral = require('./models/Referral');
const InventoryItem = require('./models/InventoryItem');
const Ambulance = require('./models/Ambulance');

// Shared dev password for every seeded account. Override with SEED_PASSWORD.
const DEV_PASSWORD = process.env.SEED_PASSWORD || 'ruralcare123';

// Fixed timestamps keep the seed deterministic across runs.
const T_ISSUED = '2026-08-25T08:30:00.000Z';
const T_CREATED = '2026-08-25T09:15:00.000Z';

const patients = [
  { id: 'p1', name: 'Rajesh Kumar', age: 42, gender: 'Male', abhaId: '91-4829-1029-4821', phone: '+91-9431-111111', address: 'Ward 3, Near Panchayat Bhavan', village: 'Ramnagar', district: 'Vaishali', state: 'Bihar', primaryPHC: 'Ramnagar PHC', bloodGroup: 'B+', ayushmanEligible: true, latitude: 25.9892, longitude: 85.2345 },
  { id: 'p2', name: 'Sunita Devi', age: 35, gender: 'Female', abhaId: '91-4829-1029-4822', phone: '+91-9431-222222', address: 'Ward 5', village: 'Ramnagar', district: 'Vaishali', state: 'Bihar', primaryPHC: 'Ramnagar PHC', bloodGroup: 'O+', ayushmanEligible: true, latitude: 25.9910, longitude: 85.2380 },
  { id: 'p4', name: 'Phoolmati Rai', age: 58, gender: 'Female', abhaId: '91-4829-1029-4824', phone: '+91-9431-444444', address: 'Ward 1', village: 'Hajipur', district: 'Vaishali', state: 'Bihar', primaryPHC: 'Ramnagar PHC', bloodGroup: 'A+', ayushmanEligible: true, latitude: 25.6858, longitude: 85.2146 },
];

const doctors = [
  { id: 'd1', name: 'Dr. Anita Sharma', specialty: 'General Medicine', qualification: 'MBBS, MD', registrationNumber: 'MCI-88219', clinicName: 'Ramnagar PHC', clinicAddress: 'Main Road, Ramnagar, Vaishali, Bihar', latitude: 25.9856, longitude: 85.2281, distanceKm: 2.5, rating: 4.8, reviewCount: 312, isAvailable: true, ayushmanPaneled: true, consultationFee: 0, teleconsultation: true },
];

const pharmacies = [
  { id: 'ph1', name: 'Jan Aushadhi Kendra Ramnagar', address: 'Main Road, Ramnagar', distanceKm: 1.8, phone: '+91-6204-111111', isJanAushadhi: true, operatingHours: '08:00 - 20:00', rating: 4.3, inventory: [{ drugName: 'Amoxicillin 500mg', genericName: 'Amoxicillin', form: 'Capsule', dosage: '500mg', quantity: 200, pricePerUnit: 3.5, isJanAushadhi: true }] },
];

const hospitals = [
  {
    id: 'hosp-601', name: 'Ramnagar Community Health Center', type: 'CHC', address: 'Station Road, Ramnagar',
    distanceKm: 2.5, phone: '+91 6112 223344', rating: 4.2,
    capabilities: { generalBeds: 14, emergency: 6, icuBeds: 2, hasXray: true, hasUltrasound: true, hasPathology: true, specialties: ['General Medicine'], ambulanceCount: 3 },
    beds: { general: 14, icu: 2, emergency: 6, ventilator: 1 },
    blood: { 'A+': 4, 'B+': 6, 'O+': 8, 'AB+': 2, 'O-': 1 },
    diagnostics: ['CBC', 'X-Ray', 'Ultrasound'],
    departments: ['General Medicine', 'Emergency', 'Obstetrics'],
  },
  {
    id: 'hosp-602', name: 'District Civil Hospital', type: 'District', address: 'Civil Lines, Hajipur',
    distanceKm: 9.8, phone: '+91 6112 556677', rating: 4.5,
    capabilities: { generalBeds: 38, emergency: 10, icuBeds: 7, hasCtScan: true, hasMri: true, hasXray: true, hasBloodBank: true, specialties: ['Cardiology', 'General Surgery'], ambulanceCount: 1 },
    beds: { general: 38, icu: 7, emergency: 10, ventilator: 4 },
    blood: { 'A+': 12, 'B+': 15, 'O+': 22, 'AB+': 5, 'O-': 3, 'A-': 2 },
    diagnostics: ['CBC', 'X-Ray', 'CT', 'MRI', 'Ultrasound', 'ECG', 'Echo'],
    departments: ['Cardiology', 'General Surgery', 'Emergency', 'ICU', 'Radiology'],
  },
];

const appointments = [
  { id: 'appt-101', patientId: 'p1', doctorId: 'd1', date: 'Today (Aug 25)', time: '02:00 PM', mode: 'in-person', chiefComplaint: 'Stomach pain & mild fever (2 days)', aiTriageSummary: 'Acute abdominal pain, fever 100.2F, nausea', aiSymptoms: ['abdominal pain', 'fever', 'nausea'], urgency: 'medium', status: 'completed', createdAt: T_CREATED },
  { id: 'appt-102', patientId: 'p2', doctorId: 'd1', date: 'Today (Aug 25)', time: '02:30 PM', mode: 'teleconsultation', chiefComplaint: 'Persistent cough, weakness', aiTriageSummary: 'Low-grade fever, 8-day cough', aiSymptoms: ['cough', 'weakness'], urgency: 'routine', status: 'confirmed', createdAt: T_CREATED },
  { id: 'appt-103', patientId: 'p4', doctorId: 'd1', date: 'Today (Aug 25)', time: '11:00 AM', mode: 'in-person', chiefComplaint: 'Knee pain', aiTriageSummary: 'Chronic knee pain, no red flags', aiSymptoms: ['knee pain'], urgency: 'routine', status: 'completed', createdAt: T_CREATED },
];

const consultations = [
  { id: 'c1', appointmentId: 'appt-103', patientId: 'p4', doctorId: 'd1', clinicalNotes: 'Osteoarthritis of both knees. Advised analgesia and physiotherapy.', provisionalDiagnosis: 'Knee pain', prescriptionId: 'rx-201', status: 'completed', completedAt: T_ISSUED },
  { id: 'c2', appointmentId: 'appt-101', patientId: 'p1', doctorId: 'd1', vitals: { bloodPressure: '140/90', heartRate: 96, temperature: 100.2, spO2: 97 }, clinicalNotes: 'Chest pain radiating to left arm. Borderline troponin. Needs cardiology workup.', provisionalDiagnosis: 'Suspected acute coronary syndrome', referralId: 'ref-501', status: 'completed', completedAt: T_ISSUED },
];

const prescriptions = [
  { id: 'rx-201', consultationId: 'c1', patientId: 'p4', patientName: 'Phoolmati Rai', doctorId: 'd1', doctorName: 'Dr. Anita Sharma', items: [{ id: 'it-1', drugName: 'Paracetamol 650mg', genericName: 'Paracetamol', dosage: '650mg', form: 'tablet', frequency: 'Twice daily', duration: '5 days', quantity: 10 }], diagnosis: 'Knee pain', qrCode: 'RX-882190', issuedAt: T_ISSUED, dispensingStatus: 'pending', pharmacyId: 'ph1' },
];

const pharmacyRequests = [
  { id: 'phreq-901', prescriptionId: 'rx-201', prescriptionCode: 'RX-882190', pharmacyId: 'ph1', patientId: 'p4', patientName: 'Phoolmati Rai', doctorName: 'Dr. Anita Sharma', medicines: ['Paracetamol 650mg'], status: 'pending' },
];

const referrals = [
  { id: 'ref-501', patientId: 'p1', doctorId: 'd1', hospitalId: 'hosp-601', consultationId: 'c2', reason: 'Chest pain', requiredCapabilities: ['ECG', 'Echo'], patientName: 'Rajesh Kumar', referringDoctor: 'Dr. Anita Sharma', specialty: 'Cardiology', beds: 'ICU', diagnostics: ['ECG', 'Echo'], hospitalName: 'Ramnagar Community Health Center', urgency: 'high', notes: 'Chest pain, troponins borderline', status: 'pending', createdAt: T_CREATED },
];

// ids match the pharmacy portal's local catalog so its rows reconcile with the server
const inventory = [
  { id: 'inv-801', medicine: 'Generic Paracetamol', generic: 'Paracetamol 650mg', form: 'Tablet', manufacturer: 'Jan Aushadhi', quantity: 42, price: 12, batch: 'JA-4412', expiry: 'Dec 2025', isJanAushadhi: true },
  { id: 'inv-802', medicine: 'Telma 40', generic: 'Telmisartan 40mg', form: 'Tablet', manufacturer: 'Glenmark', quantity: 28, price: 48, batch: 'TL-8891', expiry: 'Nov 2026', isJanAushadhi: false },
  { id: 'inv-803', medicine: 'Augmentin 625 Duo', generic: 'Amoxicillin + Clavulanic Acid', form: 'Tablet', manufacturer: 'GSK', quantity: 8, price: 204, batch: 'A-1102', expiry: 'Jan 2026', isJanAushadhi: false },
  { id: 'inv-804', medicine: 'ORS Electral Sachet', generic: 'Oral Rehydration Salts', form: 'Sachet', manufacturer: 'FDC Ltd', quantity: 65, price: 18, batch: 'OR-0092', expiry: 'Jul 2027', isJanAushadhi: true },
  { id: 'inv-805', medicine: 'Dolo 650', generic: 'Paracetamol 650mg', form: 'Tablet', manufacturer: 'Micro Labs Ltd', quantity: 120, price: 31.5, batch: 'B-92841', expiry: 'Oct 2025', isJanAushadhi: false },
  { id: 'inv-806', medicine: 'Glycomet 500', generic: 'Metformin Hydrochloride 500mg', form: 'Tablet', manufacturer: 'USV Pharma', quantity: 85, price: 24, batch: 'GL-1940', expiry: 'Aug 2026', isJanAushadhi: false },
  { id: 'inv-807', medicine: 'Pan 40', generic: 'Pantoprazole 40mg', form: 'Tablet', manufacturer: 'Alkem Labs', quantity: 0, price: 58, batch: 'PN-3321', expiry: 'May 2026', isJanAushadhi: false },
  { id: 'inv-808', medicine: 'Generic Amoxicillin', generic: 'Amoxicillin 500mg', form: 'Capsule', manufacturer: 'Jan Aushadhi', quantity: 3, price: 35, batch: 'JA-7719', expiry: 'Mar 2026', isJanAushadhi: true },
].map((row) => ({ ...row, pharmacyId: 'ph1', reorderLevel: 10 }));

const ambulances = [
  { id: 'amb-701', hospitalId: 'hosp-601', vehicle: 'BR-31-AB-1042', driver: 'Ram Prasad', driverPhone: '+91-9431-777701', status: 'available' },
  { id: 'amb-702', hospitalId: 'hosp-601', vehicle: 'BR-31-AB-2210', driver: 'Sanjay Yadav', driverPhone: '+91-9431-777702', status: 'available' },
  { id: 'amb-703', hospitalId: 'hosp-601', vehicle: 'BR-31-CD-5567', driver: 'Mukesh Singh', driverPhone: '+91-9431-777703', status: 'maintenance' },
  { id: 'amb-704', hospitalId: 'hosp-602', vehicle: 'BR-31-EF-9901', driver: 'Dinesh Kumar', driverPhone: '+91-9431-777704', status: 'available' },
];

const users = [
  { id: 'u-p1', email: 'patient@ruralcare.dev', name: 'Rajesh Kumar', role: 'PATIENT', patientId: 'p1' },
  { id: 'u-d1', email: 'doctor@ruralcare.dev', name: 'Dr. Anita Sharma', role: 'DOCTOR', doctorId: 'd1' },
  { id: 'u-ph1', email: 'pharmacist@ruralcare.dev', name: 'Jan Aushadhi Kendra Ramnagar', role: 'PHARMACIST', pharmacyId: 'ph1' },
  { id: 'u-hosp601-admin', email: 'hospital@ruralcare.dev', name: 'Ramnagar CHC Admin', role: 'HOSPITAL_ADMIN', hospitalId: 'hosp-601' },
  { id: 'u-hosp601-staff', email: 'staff@ruralcare.dev', name: 'Ramnagar CHC Desk', role: 'HOSPITAL_STAFF', hospitalId: 'hosp-601' },
  { id: 'u-admin', email: 'admin@ruralcare.dev', name: 'RuralCare Admin', role: 'ADMIN' },
];

async function seedCollection(Model, rows, label) {
  let created = 0;
  for (const row of rows) {
    const result = await Model.updateOne({ id: row.id }, { $setOnInsert: row }, { upsert: true });
    if (result.upsertedCount) created += 1;
  }
  console.log(`  ${label.padEnd(17)} ${String(rows.length).padStart(3)} total, ${created} created`);
}

async function seedUsers() {
  let created = 0;
  for (const user of users) {
    if (await User.exists({ id: user.id })) continue;
    await User.create({
      ...user,
      passwordHash: await bcrypt.hash(DEV_PASSWORD, 10),
      isActive: true,
    });
    created += 1;
  }
  console.log(`  ${'users'.padEnd(17)} ${String(users.length).padStart(3)} total, ${created} created`);
}

/**
 * One-time repairs for records written by earlier, pre-milestone seeds.
 * Each fix is guarded so it is a no-op once applied.
 */
async function reconcile() {
  const fixes = [];

  const referral = await Referral.updateOne(
    { id: 'ref-501', hospitalId: 'h1' },
    { $set: { hospitalId: 'hosp-601', hospitalName: 'Ramnagar Community Health Center' } }
  );
  if (referral.modifiedCount) fixes.push('ref-501.hospitalId: h1 -> hosp-601');

  // The old seed issued rx-201 with no pharmacy, so it never reached a fulfillment queue.
  const prescription = await Prescription.updateOne(
    { id: 'rx-201', pharmacyId: { $in: [null, ''] } },
    { $set: { pharmacyId: 'ph1' } }
  );
  if (prescription.modifiedCount) fixes.push('rx-201.pharmacyId: -> ph1');

  const hospBeds = await Hospital.updateMany(
    {},
    {
      $set: {
        beds: { general: 24, icu: 6, emergency: 8, ventilator: 4 },
        blood: { 'A+': 6, 'B+': 8, 'O+': 10, 'AB+': 4, 'O-': 2 },
        diagnostics: ['CBC', 'X-Ray', 'Ultrasound', 'ECG', 'CT Scan'],
        departments: ['General Medicine', 'Emergency', 'Obstetrics', 'Cardiology', 'Pediatrics'],
      },
    }
  );
  if (hospBeds.modifiedCount) fixes.push('hospitals: set operational beds & departments');

  console.log(fixes.length ? `  repairs           ${fixes.join('; ')}` : '  repairs             none needed');
}

async function main() {
  if (env.isProd && !env.SEED_ALLOW_PROD) {
    console.error('[seed] refusing to run against production. Set SEED_ALLOW_PROD=true to override.');
    process.exit(1);
  }

  await connectDb();
  console.log(`[seed] connected (NODE_ENV=${env.NODE_ENV})`);

  await seedCollection(Patient, patients, 'patients');
  await seedCollection(Doctor, doctors, 'doctors');
  await seedCollection(Pharmacy, pharmacies, 'pharmacies');
  await seedCollection(Hospital, hospitals, 'hospitals');
  await seedCollection(Appointment, appointments, 'appointments');
  await seedCollection(Consultation, consultations, 'consultations');
  await seedCollection(Prescription, prescriptions, 'prescriptions');
  await seedCollection(PharmacyRequest, pharmacyRequests, 'pharmacyRequests');
  await seedCollection(Referral, referrals, 'referrals');
  await seedCollection(InventoryItem, inventory, 'inventory');
  await seedCollection(Ambulance, ambulances, 'ambulances');
  await seedUsers();
  await reconcile();

  await disconnectDb();
  if (!env.isProd) {
    console.log(`[seed] done. Demo accounts share the password: ${DEV_PASSWORD}`);
  } else {
    console.log('[seed] done.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});


