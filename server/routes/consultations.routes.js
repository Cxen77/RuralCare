const express = require('express');
const Consultation = require('../models/Consultation');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { appointmentId, patientId, doctorId, status } = req.query;
    const filter = {};
    if (appointmentId) filter.appointmentId = appointmentId;
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    if (status) filter.status = status;
    const rows = await Consultation.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

router.post(
  '/',
  requireRole('DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const doctorId = req.user.role === 'DOCTOR' ? req.user.doctorId : req.body.doctorId;
    const { appointmentId, patientId } = req.body;
    if (!appointmentId) throw new ApiError(400, 'MISSING_APPOINTMENT', 'appointmentId is required.');
    if (!patientId) throw new ApiError(400, 'MISSING_PATIENT', 'patientId is required.');
    if (!doctorId) throw new ApiError(400, 'MISSING_DOCTOR', 'doctorId is required.');

    const consult = await Consultation.create({
      id: genId('cons'),
      appointmentId,
      patientId,
      doctorId,
      vitals: req.body.vitals,
      clinicalNotes: req.body.clinicalNotes,
      provisionalDiagnosis: req.body.provisionalDiagnosis,
      status: 'in_progress',
    });
    return ok(res, consult, 201);
  })
);

router.patch(
  '/:id',
  requireRole('DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const consult = await Consultation.findOne({ id: req.params.id });
    if (!consult) throw new ApiError(404, 'NOT_FOUND', 'Consultation not found.');

    delete req.body.id;
    delete req.body._id;
    Object.assign(consult, req.body);
    if (req.body.status === 'completed' && !consult.completedAt) {
      consult.completedAt = new Date().toISOString();
    }
    await consult.save();
    return ok(res, consult);
  })
);

module.exports = router;
