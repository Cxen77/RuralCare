const express = require('express');
const Appointment = require('../models/Appointment');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');
const { assertTransition } = require('../utils/transitions');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { doctorId, patientId, status } = req.query;
    const filter = {};
    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    const rows = await Appointment.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

router.post(
  '/',
  requireRole('PATIENT', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const patientId = req.user.role === 'PATIENT' ? req.user.patientId : req.body.patientId;
    if (!patientId) throw new ApiError(400, 'MISSING_PATIENT', 'patientId is required.');
    if (!req.body.doctorId) throw new ApiError(400, 'MISSING_DOCTOR', 'doctorId is required.');

    const appt = await Appointment.create({
      id: genId('appt'),
      patientId,
      doctorId: req.body.doctorId,
      date: req.body.date,
      time: req.body.time,
      mode: req.body.mode || 'in-person',
      chiefComplaint: req.body.chiefComplaint || req.body.reason,
      aiTriageSummary: req.body.aiTriageSummary,
      aiSymptoms: req.body.aiSymptoms,
      urgency: req.body.urgency || 'routine',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    });
    return ok(res, appt, 201);
  })
);

router.patch(
  '/:id',
  requireRole('DOCTOR', 'PATIENT', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findOne({ id: req.params.id });
    if (!appt) throw new ApiError(404, 'NOT_FOUND', 'Appointment not found.');

    const fromStatus = appt.status;
    const toStatus = req.body.status;
    if (toStatus && toStatus !== fromStatus) {
      assertTransition('appointment', fromStatus, toStatus);
    }

    delete req.body.id;
    delete req.body._id;
    Object.assign(appt, req.body);
    await appt.save();

    if (toStatus && toStatus !== fromStatus) {
      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'appointment.status',
        entityType: 'appointment',
        entityId: appt.id,
        before: { status: fromStatus },
        after: { status: appt.status },
      });
    }
    return ok(res, appt);
  })
);

module.exports = router;
