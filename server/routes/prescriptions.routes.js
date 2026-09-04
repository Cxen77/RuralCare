const express = require('express');
const Prescription = require('../models/Prescription');
const PharmacyRequest = require('../models/PharmacyRequest');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');
const { assertTransition } = require('../utils/transitions');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

function medicineNames(items) {
  return (items || []).map((i) => i.drugName || i.genericName).filter(Boolean);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { patientId, doctorId, pharmacyId, dispensingStatus } = req.query;
    const filter = {};
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    if (dispensingStatus) filter.dispensingStatus = dispensingStatus;
    const rows = await Prescription.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

router.post(
  '/',
  requireRole('DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const doctorId = req.user.role === 'DOCTOR' ? req.user.doctorId : req.body.doctorId;
    const doctorName = req.body.doctorName || req.user.name;
    const { consultationId, patientId, patientName, items, diagnosis } = req.body;

    if (!consultationId) throw new ApiError(400, 'MISSING_CONSULTATION', 'consultationId is required.');
    if (!patientId) throw new ApiError(400, 'MISSING_PATIENT', 'patientId is required.');
    if (!patientName) throw new ApiError(400, 'MISSING_PATIENT_NAME', 'patientName is required.');
    if (!doctorId) throw new ApiError(400, 'MISSING_DOCTOR', 'doctorId is required.');

    const qrCode = req.body.qrCode || `RX-${Math.floor(100000 + Math.random() * 899999)}`;
    const rx = await Prescription.create({
      id: genId('rx'),
      consultationId,
      patientId,
      doctorId,
      doctorName,
      patientName,
      items: items || [],
      diagnosis,
      qrCode,
      issuedAt: new Date().toISOString(),
      validUntil: req.body.validUntil,
      dispensingStatus: 'pending',
      pharmacyId: req.body.pharmacyId,
    });

    // Route to a pharmacy queue when a pharmacy is chosen at issue time.
    if (rx.pharmacyId) {
      await PharmacyRequest.create({
        id: genId('phreq'),
        prescriptionId: rx.id,
        prescriptionCode: rx.qrCode,
        pharmacyId: rx.pharmacyId,
        patientId: rx.patientId,
        patientName: rx.patientName,
        doctorName: rx.doctorName,
        medicines: medicineNames(rx.items),
        status: 'pending',
      });
    }
    return ok(res, rx, 201);
  })
);

router.patch(
  '/:id',
  requireRole('DOCTOR', 'PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const rx = await Prescription.findOne({ id: req.params.id });
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found.');

    const fromStatus = rx.dispensingStatus;
    const toStatus = req.body.dispensingStatus;
    if (toStatus && toStatus !== fromStatus) {
      assertTransition('prescription', fromStatus, toStatus);
    }

    delete req.body.id;
    delete req.body._id;
    Object.assign(rx, req.body);
    await rx.save();

    if (toStatus && toStatus !== fromStatus) {
      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'prescription.dispensingStatus',
        entityType: 'prescription',
        entityId: rx.id,
        before: { dispensingStatus: fromStatus },
        after: { dispensingStatus: rx.dispensingStatus },
      });
    }
    return ok(res, rx);
  })
);

module.exports = router;
