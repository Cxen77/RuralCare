const express = require('express');
const Referral = require('../models/Referral');
const Hospital = require('../models/Hospital');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');
const { assertTransition } = require('../utils/transitions');
const { writeAudit } = require('../utils/audit');
const { sendNotification } = require('../utils/notify');

function determineBedKey(bedStr) {
  const s = String(bedStr || '').toLowerCase();
  if (s.includes('icu')) return 'icu';
  if (s.includes('emergency')) return 'emergency';
  if (s.includes('ventilator')) return 'ventilator';
  return 'general';
}

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { hospitalId, doctorId, patientId, status } = req.query;
    const filter = {};
    if (hospitalId) filter.hospitalId = hospitalId;
    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    const rows = await Referral.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

router.post(
  '/',
  requireRole('DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const doctorId = req.user.role === 'DOCTOR' ? req.user.doctorId : req.body.doctorId;
    const { patientId, hospitalId, consultationId, reason } = req.body;
    if (!patientId) throw new ApiError(400, 'MISSING_PATIENT', 'patientId is required.');
    if (!hospitalId) throw new ApiError(400, 'MISSING_HOSPITAL', 'hospitalId is required.');
    if (!consultationId) throw new ApiError(400, 'MISSING_CONSULTATION', 'consultationId is required.');
    if (!reason) throw new ApiError(400, 'MISSING_REASON', 'reason is required.');
    if (!doctorId) throw new ApiError(400, 'MISSING_DOCTOR', 'doctorId is required.');

    const hosp = await Hospital.findOne({ id: hospitalId });
    const hospitalName = req.body.hospitalName || hosp?.name || 'Hospital Network';

    const referral = await Referral.create({
      id: genId('ref'),
      patientId,
      doctorId,
      hospitalId,
      consultationId,
      reason,
      requiredCapabilities: req.body.requiredCapabilities || [],
      patientName: req.body.patientName,
      referringDoctor: req.body.referringDoctor || req.user.name,
      specialty: req.body.specialty,
      beds: req.body.beds,
      diagnostics: req.body.diagnostics || [],
      hospitalName,
      urgency: req.body.urgency || 'routine',
      notes: req.body.notes,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Notify receiving hospital
    await sendNotification({
      recipientId: hospitalId,
      role: 'HOSPITAL_ADMIN',
      type: 'referral',
      title: 'New Referral Request',
      message: `Incoming ${referral.urgency.toUpperCase()} referral from Dr. ${referral.referringDoctor} for ${referral.patientName} (${referral.specialty || 'General'}).`,
      relatedEntity: { type: 'referral', id: referral.id },
    });

    return ok(res, referral, 201);
  })
);

router.patch(
  '/:id',
  requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const referral = await Referral.findOne({ id: req.params.id });
    if (!referral) throw new ApiError(404, 'NOT_FOUND', 'Referral not found.');

    // Ownership check for hospital role
    if (['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(req.user.role)) {
      if (req.user.hospitalId && referral.hospitalId !== req.user.hospitalId) {
        throw new ApiError(403, 'FORBIDDEN', 'This referral is addressed to another hospital.');
      }
    }

    const fromStatus = referral.status;
    const toStatus = req.body.status;
    if (toStatus && toStatus !== fromStatus) {
      assertTransition('referral', fromStatus, toStatus);
    }

    // Concurrency-safe bed allocation when accepting referral
    if (toStatus === 'accepted' && fromStatus !== 'accepted') {
      const bedKey = determineBedKey(req.body.assignedBed || referral.beds);
      const allocated = await Hospital.findOneAndUpdate(
        { id: referral.hospitalId, [`beds.${bedKey}`]: { $gte: 1 } },
        { $inc: { [`beds.${bedKey}`]: -1 } },
        { new: true }
      );

      if (!allocated) {
        // Try fallback general bed
        const fallback = await Hospital.findOneAndUpdate(
          { id: referral.hospitalId, 'beds.general': { $gte: 1 } },
          { $inc: { 'beds.general': -1 } },
          { new: true }
        );
        if (!fallback) {
          throw new ApiError(409, 'NO_BEDS_AVAILABLE', `No beds available in ${referral.hospitalName || 'hospital'}.`);
        }
        referral.assignedBed = req.body.assignedBed || `General Bed (Allocated)`;
      } else {
        referral.assignedBed = req.body.assignedBed || `${bedKey.toUpperCase()} Bed (Allocated)`;
      }
      referral.allocatedBedType = bedKey;
    }

    // Bed release when accepted referral is cancelled or rejected
    if (fromStatus === 'accepted' && ['cancelled', 'rejected'].includes(toStatus) && referral.allocatedBedType) {
      await Hospital.updateOne(
        { id: referral.hospitalId },
        { $inc: { [`beds.${referral.allocatedBedType}`]: 1 } }
      );
    }

    delete req.body.id;
    delete req.body._id;
    Object.assign(referral, req.body);
    if (toStatus && ['accepted', 'rejected'].includes(toStatus) && !referral.respondedAt) {
      referral.respondedAt = new Date().toISOString();
    }
    await referral.save();

    if (toStatus && toStatus !== fromStatus) {
      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'referral.status',
        entityType: 'referral',
        entityId: referral.id,
        before: { status: fromStatus },
        after: { status: referral.status, assignedBed: referral.assignedBed },
      });

      // Send notifications to referring doctor and patient
      if (toStatus === 'accepted') {
        await sendNotification({
          recipientId: referral.patientId,
          role: 'PATIENT',
          type: 'referral',
          title: 'Hospital Referral Accepted',
          message: `Your referral to ${referral.hospitalName || 'the hospital'} was accepted (${referral.assignedBed || 'Bed Reserved'}).`,
          relatedEntity: { type: 'referral', id: referral.id },
        });
        if (referral.doctorId) {
          await sendNotification({
            recipientId: referral.doctorId,
            role: 'DOCTOR',
            type: 'referral',
            title: 'Referral Accepted',
            message: `${referral.hospitalName || 'Hospital'} accepted referral for ${referral.patientName}.`,
            relatedEntity: { type: 'referral', id: referral.id },
          });
        }
      } else if (toStatus === 'rejected') {
        await sendNotification({
          recipientId: referral.doctorId,
          role: 'DOCTOR',
          type: 'referral',
          title: 'Referral Declined',
          message: `${referral.hospitalName || 'Hospital'} declined referral for ${referral.patientName}. Rerouting recommended.`,
          relatedEntity: { type: 'referral', id: referral.id },
        });
      }
    }
    return ok(res, referral);
  })
);

module.exports = router;
