const express = require('express');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Pharmacy = require('../models/Pharmacy');
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
  '/patients',
  asyncHandler(async (req, res) => {
    const rows = await Patient.find().sort({ name: 1 });
    return ok(res, rows);
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

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'patient.update',
      entityType: 'patient',
      entityId: patient.id,
      before: { name: before.name, phone: before.phone, village: before.village },
      after: { name: patient.name, phone: patient.phone, village: patient.village },
    });

    return ok(res, patient);
  })
);

module.exports = router;
