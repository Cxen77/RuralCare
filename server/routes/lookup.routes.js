const express = require('express');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const Referral = require('../models/Referral');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

router.get(
  '/doctors',
  asyncHandler(async (req, res) => {
    const rows = await Doctor.find().sort({ name: 1 });
    return ok(res, rows);
  })
);

router.get(
  '/doctors/:id',
  asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ id: req.params.id });
    if (!doctor) throw new ApiError(404, 'NOT_FOUND', 'Doctor not found.');
    return ok(res, doctor);
  })
);

router.patch(
  '/doctors/:id',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'DOCTOR' && req.user.doctorId && req.user.doctorId !== req.params.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot update another doctor profile.');
    }
    const doctor = await Doctor.findOne({ id: req.params.id });
    if (!doctor) throw new ApiError(404, 'NOT_FOUND', 'Doctor not found.');

    delete req.body.id;
    delete req.body._id;
    delete req.body.registrationNumber;
    Object.assign(doctor, req.body);
    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      doctor.locationUpdatedAt = new Date();
    }
    await doctor.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'doctor.update',
      entityType: 'doctor',
      entityId: doctor.id,
      before: {},
      after: { clinicName: doctor.clinicName, clinicAddress: doctor.clinicAddress, latitude: doctor.latitude, longitude: doctor.longitude },
    });

    return ok(res, doctor);
  })
);

router.get(
  '/pharmacies',
  asyncHandler(async (req, res) => {
    const rows = await Pharmacy.find().sort({ name: 1 });
    return ok(res, rows);
  })
);

router.get(
  '/pharmacies/:id',
  asyncHandler(async (req, res) => {
    const pharmacy = await Pharmacy.findOne({ id: req.params.id });
    if (!pharmacy) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy not found.');
    return ok(res, pharmacy);
  })
);

router.patch(
  '/pharmacies/:id',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'PHARMACIST' && req.user.pharmacyId && req.user.pharmacyId !== req.params.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot update another pharmacy profile.');
    }
    const pharmacy = await Pharmacy.findOne({ id: req.params.id });
    if (!pharmacy) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy not found.');

    delete req.body.id;
    delete req.body._id;
    Object.assign(pharmacy, req.body);
    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      pharmacy.locationUpdatedAt = new Date();
    }
    await pharmacy.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'pharmacy.update',
      entityType: 'pharmacy',
      entityId: pharmacy.id,
      before: {},
      after: { name: pharmacy.name, address: pharmacy.address, latitude: pharmacy.latitude, longitude: pharmacy.longitude },
    });

    return ok(res, pharmacy);
  })
);

router.get(
  '/patients',
  asyncHandler(async (req, res) => {
    const rows = await Patient.find().sort({ name: 1 });
    return ok(res, rows);
  })
);

router.get(
  '/patients/:id/health-passport',
  asyncHandler(async (req, res) => {
    const patientId = req.params.id;

    // Security & Authorization:
    // Patients can only access their own Health Passport.
    if (req.user.role === 'PATIENT' && req.user.patientId !== patientId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied to this health passport.');
    }
    // Permitted roles: PATIENT, DOCTOR, ADMIN, HOSPITAL
    if (!['PATIENT', 'DOCTOR', 'ADMIN', 'HOSPITAL'].includes(req.user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Role not permitted to view Health Passport.');
    }

    const patient = await Patient.findOne({ id: patientId });
    if (!patient) throw new ApiError(404, 'NOT_FOUND', 'Patient not found.');

    // Fetch longitudinal healthcare records in parallel
    const [consultations, prescriptions, appointments, referrals, reservations] = await Promise.all([
      Consultation.find({ patientId }).sort({ createdAt: -1 }).lean(),
      Prescription.find({ patientId }).sort({ createdAt: -1 }).lean(),
      Appointment.find({ patientId }).sort({ date: -1, time: -1 }).lean(),
      Referral.find({ patientId }).sort({ createdAt: -1 }).lean(),
      Reservation.find({ patientId }).sort({ createdAt: -1 }).lean(),
    ]);

    // Fetch doctor profiles referenced across records
    const doctorIds = [
      ...new Set([
        ...consultations.map((c) => c.doctorId).filter(Boolean),
        ...prescriptions.map((p) => p.doctorId).filter(Boolean),
        ...appointments.map((a) => a.doctorId).filter(Boolean),
        ...referrals.map((r) => r.doctorId).filter(Boolean),
      ]),
    ];
    const doctors = await Doctor.find({ id: { $in: doctorIds } }).lean();
    const doctorMap = Object.fromEntries(doctors.map((d) => [d.id, d]));

    // Map prescriptions & referrals by id
    const prescriptionMap = Object.fromEntries(prescriptions.map((p) => [p.id, p]));
    const referralMap = Object.fromEntries(referrals.map((r) => [r.id, r]));

    // Build unified chronological longitudinal medical timeline
    const timeline = [];

    // 1. Consultations with assessment, notes, vitals, prescriptions, referrals
    for (const c of consultations) {
      const doc = doctorMap[c.doctorId] || {};
      const linkedPrescription = c.prescriptionId ? prescriptionMap[c.prescriptionId] : null;
      const linkedReferral = c.referralId ? referralMap[c.referralId] : null;

      timeline.push({
        id: c.id,
        type: 'consultation',
        date: c.completedAt || c.createdAt || new Date().toISOString(),
        title: c.provisionalDiagnosis ? `Diagnosis: ${c.provisionalDiagnosis}` : 'Clinical Consultation',
        doctor: {
          id: c.doctorId,
          name: doc.name || 'Attending Physician',
          specialty: doc.specialty || 'General Medicine',
          clinic: doc.clinicName || doc.hospital || 'Rural Health Center',
        },
        diagnosis: c.provisionalDiagnosis || 'Clinical Assessment',
        clinicalNotes: c.clinicalNotes || '',
        vitals: c.vitals || null,
        followUp: c.followUpDate ? { date: c.followUpDate, notes: c.followUpNotes } : null,
        status: c.status,
        prescription: linkedPrescription ? {
          id: linkedPrescription.id,
          medicinesCount: linkedPrescription.items?.length || 0,
          items: linkedPrescription.items || [],
          status: linkedPrescription.dispensingStatus,
        } : null,
        referral: linkedReferral ? {
          id: linkedReferral.id,
          hospitalName: linkedReferral.hospitalName,
          reason: linkedReferral.reason,
          urgency: linkedReferral.urgency,
          status: linkedReferral.status,
          assignedBed: linkedReferral.assignedBed,
        } : null,
      });
    }

    // 2. Prescriptions enriched
    const enrichedPrescriptions = prescriptions.map((p) => {
      const doc = doctorMap[p.doctorId] || {};
      return {
        id: p.id,
        consultationId: p.consultationId,
        date: p.issuedAt || p.createdAt,
        doctor: {
          id: p.doctorId,
          name: p.doctorName || doc.name || 'Attending Doctor',
          specialty: doc.specialty || 'General Physician',
        },
        diagnosis: p.diagnosis || 'Standard Care',
        items: p.items || [],
        dispensingStatus: p.dispensingStatus,
        pharmacyName: p.pharmacyName || null,
        validUntil: p.validUntil,
        qrCode: p.qrCode,
      };
    });

    // 3. Diagnostic tests and reports
    const diagnosticReports = [];
    referrals.forEach((r) => {
      if (r.diagnostics && Array.isArray(r.diagnostics) && r.diagnostics.length > 0) {
        r.diagnostics.forEach((diagName, idx) => {
          diagnosticReports.push({
            id: `${r.id}-diag-${idx}`,
            testName: diagName,
            orderedDate: r.createdAt,
            hospitalName: r.hospitalName || 'District Referral Hospital',
            doctorName: r.referringDoctor || 'Attending Physician',
            urgency: r.urgency,
            status: r.status === 'completed' ? 'Completed' : 'Ordered / In Progress',
            notes: r.reason || '',
          });
        });
      }
    });

    // 4. Hospital Visits & Bed Admissions
    const hospitalVisits = referrals.map((r) => ({
      id: r.id,
      hospitalName: r.hospitalName || 'District Hospital',
      department: r.assignedDepartment || r.specialty || 'General Ward',
      assignedBed: r.assignedBed || null,
      reason: r.reason,
      urgency: r.urgency,
      status: r.status,
      admittedDate: r.createdAt,
      doctorName: r.referringDoctor || 'Referring Doctor',
    }));

    // Sort timeline descending by date (newest first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Audit log
    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'health_passport.read',
      entityType: 'patient',
      entityId: patient.id,
      before: {},
      after: { accessedAt: new Date().toISOString() },
    });

    return ok(res, {
      patient: {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        dateOfBirth: patient.dateOfBirth || null,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup || null,
        allergies: patient.allergies || [],
        chronicConditions: patient.chronicConditions || [],
        currentMedications: patient.currentMedications || [],
        previousConditions: patient.previousConditions || [],
        emergencyContact: patient.emergencyContact || null,
        importantNotes: patient.importantNotes || null,
        phone: patient.phone,
        address: patient.address,
        village: patient.village,
        district: patient.district,
        state: patient.state,
        abhaId: patient.abhaId,
        primaryPHC: patient.primaryPHC,
        ashaWorker: patient.ashaWorker || null,
        ayushmanEligible: patient.ayushmanEligible,
      },
      overview: {
        bloodGroup: patient.bloodGroup || null,
        allergies: patient.allergies || [],
        chronicConditions: patient.chronicConditions || [],
        currentMedications: patient.currentMedications || [],
        previousConditions: patient.previousConditions || [],
        emergencyContact: patient.emergencyContact || null,
        importantNotes: patient.importantNotes || null,
      },
      timeline,
      consultations,
      prescriptions: enrichedPrescriptions,
      diagnosticReports,
      hospitalVisits,
    });
  })
);

router.get(
  '/patients/:id',
  asyncHandler(async (req, res) => {
    const patient = await Patient.findOne({ id: req.params.id });
    if (!patient) throw new ApiError(404, 'NOT_FOUND', 'Patient not found.');
    return ok(res, patient);
  })
);

router.patch(
  '/patients/:id',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'PATIENT' && req.user.patientId !== req.params.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Cannot update another patient profile.');
    }
    const patient = await Patient.findOne({ id: req.params.id });
    if (!patient) throw new ApiError(404, 'NOT_FOUND', 'Patient not found.');

    const before = patient.toObject();
    delete req.body.id;
    delete req.body._id;
    delete req.body.abhaId; // immutable identity
    Object.assign(patient, req.body);
    await patient.save();

    if (req.body.name) {
      await User.updateOne({ patientId: patient.id }, { $set: { name: req.body.name } });
    }

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'patient.update',
      entityType: 'patient',
      entityId: patient.id,
      before: { name: before.name, phone: before.phone, village: before.village, bloodGroup: before.bloodGroup },
      after: { name: patient.name, phone: patient.phone, village: patient.village, bloodGroup: patient.bloodGroup },
    });

    return ok(res, patient);
  })
);

module.exports = router;
