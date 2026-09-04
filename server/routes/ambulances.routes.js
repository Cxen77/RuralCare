const express = require('express');
const Ambulance = require('../models/Ambulance');
const Hospital = require('../models/Hospital');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireRole } = require('../middleware/rbac');
const { assertTransition } = require('../utils/transitions');
const { writeAudit } = require('../utils/audit');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

const DISPATCHERS = ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'DOCTOR', 'PATIENT', 'ADMIN'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { hospitalId, status } = req.query;
    const filter = {};
    if (hospitalId) filter.hospitalId = hospitalId;
    if (status) filter.status = status;
    const rows = await Ambulance.find(filter).sort({ vehicle: 1 });
    return ok(res, rows);
  })
);

router.post(
  '/request',
  requireRole(...DISPATCHERS),
  asyncHandler(async (req, res) => {
    let { hospitalId } = req.body;

    // If no hospitalId specified, find hospital with available ambulance
    const filter = { status: 'available' };
    if (hospitalId) filter.hospitalId = hospitalId;

    const ambulance = await Ambulance.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'dispatched',
          patientName: req.body.patientName || req.user.name,
          pickup: req.body.pickup || 'Emergency Location',
          currentReferralId: req.body.referralId,
          eta: req.body.eta || '12 mins',
        },
      },
      { new: true }
    );

    if (!ambulance) {
      throw new ApiError(409, 'NO_AMBULANCE_AVAILABLE', 'No available ambulance found in the network.');
    }

    assertTransition('ambulance', 'available', 'dispatched');

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'ambulance.dispatch',
      entityType: 'ambulance',
      entityId: ambulance.id,
      before: { status: 'available' },
      after: { status: 'dispatched', vehicle: ambulance.vehicle, pickup: ambulance.pickup },
    });

    // Notify receiving hospital
    await sendNotification({
      recipientId: ambulance.hospitalId,
      role: 'HOSPITAL_ADMIN',
      type: 'emergency',
      title: '108 Ambulance Dispatched',
      message: `Ambulance ${ambulance.vehicle} dispatched for ${ambulance.patientName} at ${ambulance.pickup} (ETA: ${ambulance.eta}).`,
      relatedEntity: { type: 'ambulance', id: ambulance.id },
    });

    return ok(res, ambulance, 201);
  })
);

router.patch(
  '/:id',
  requireRole(...DISPATCHERS),
  asyncHandler(async (req, res) => {
    const ambulance = await Ambulance.findOne({ id: req.params.id });
    if (!ambulance) throw new ApiError(404, 'NOT_FOUND', 'Ambulance not found.');

    const fromStatus = ambulance.status;
    const toStatus = req.body.status;
    if (toStatus && toStatus !== fromStatus) {
      assertTransition('ambulance', fromStatus, toStatus);
    }

    delete req.body.id;
    delete req.body._id;

    if (toStatus === 'available') {
      ambulance.patientName = undefined;
      ambulance.pickup = undefined;
      ambulance.currentReferralId = undefined;
      ambulance.eta = undefined;
    }

    Object.assign(ambulance, req.body);
    await ambulance.save();

    if (toStatus && toStatus !== fromStatus) {
      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'ambulance.status',
        entityType: 'ambulance',
        entityId: ambulance.id,
        before: { status: fromStatus },
        after: { status: ambulance.status },
      });
    }
    return ok(res, ambulance);
  })
);

module.exports = router;
