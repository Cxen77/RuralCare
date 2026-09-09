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

const genId = require('../utils/id');

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

// Register a new authorized ambulance to the hospital fleet
router.post(
  '/',
  requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { vehicle, driver, driverPhone, status } = req.body || {};
    if (!vehicle || !vehicle.trim()) {
      throw new ApiError(400, 'VEHICLE_REQUIRED', 'Vehicle registration number is required.');
    }

    const hospitalId = req.user.hospitalId || req.body.hospitalId || 'hosp-601';

    // Prevent duplicate active vehicle registration in the fleet
    const existing = await Ambulance.findOne({ vehicle: vehicle.trim().toUpperCase(), hospitalId });
    if (existing) {
      throw new ApiError(409, 'DUPLICATE_VEHICLE', `Ambulance with vehicle number ${vehicle.trim().toUpperCase()} already registered.`);
    }

    const ambulance = await Ambulance.create({
      id: genId('amb'),
      hospitalId,
      vehicle: vehicle.trim().toUpperCase(),
      driver: (driver || '').trim() || 'Assigned Driver',
      driverPhone: (driverPhone || '').trim() || '+91-9431-777701',
      status: status || 'available',
    });

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'ambulance.create',
      entityType: 'ambulance',
      entityId: ambulance.id,
      before: {},
      after: { vehicle: ambulance.vehicle, driver: ambulance.driver, hospitalId: ambulance.hospitalId },
    });

    return ok(res, ambulance, 201);
  })
);

// Dispatch an emergency 108 vehicle
router.post(
  '/request',
  requireRole(...DISPATCHERS),
  asyncHandler(async (req, res) => {
    const { hospitalId, ambulanceId, patientName, pickup, urgency, referralId, eta, notes } = req.body || {};

    let ambulance = null;

    if (ambulanceId) {
      ambulance = await Ambulance.findOne({ id: ambulanceId, status: 'available' });
    }

    if (!ambulance) {
      const filter = { status: 'available' };
      if (hospitalId) filter.hospitalId = hospitalId;
      ambulance = await Ambulance.findOne(filter);
    }

    if (!ambulance) {
      throw new ApiError(409, 'NO_AMBULANCE_AVAILABLE', 'No available ambulance found in this node or network.');
    }

    const fromStatus = ambulance.status;
    ambulance.status = 'dispatched';
    ambulance.patientName = (patientName || '').trim() || req.user.name || 'Emergency Trauma Patient';
    ambulance.pickup = (pickup || '').trim() || 'Emergency Site';
    ambulance.currentReferralId = referralId;
    ambulance.eta = eta || '12 mins';
    if (notes) ambulance.notes = notes;
    await ambulance.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'ambulance.dispatch',
      entityType: 'ambulance',
      entityId: ambulance.id,
      before: { status: fromStatus },
      after: { status: 'dispatched', vehicle: ambulance.vehicle, pickup: ambulance.pickup, patientName: ambulance.patientName },
    });

    // Notify receiving hospital
    await sendNotification({
      recipientId: ambulance.hospitalId,
      role: 'HOSPITAL_ADMIN',
      type: 'emergency',
      title: '🚨 108 Emergency Ambulance Dispatched',
      message: `Ambulance ${ambulance.vehicle} dispatched for ${ambulance.patientName} at ${ambulance.pickup} (ETA: ${ambulance.eta}).`,
      relatedEntity: { type: 'ambulance', id: ambulance.id },
    });

    return ok(res, ambulance, 201);
  })
);

// Full update of ambulance details
router.put(
  '/:id',
  requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const ambulance = await Ambulance.findOne({ id: req.params.id });
    if (!ambulance) throw new ApiError(404, 'NOT_FOUND', 'Ambulance not found.');

    if (['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(req.user.role) && req.user.hospitalId) {
      if (ambulance.hospitalId !== req.user.hospitalId) {
        throw new ApiError(403, 'FORBIDDEN', 'Cannot modify an ambulance belonging to another hospital.');
      }
    }

    const before = { vehicle: ambulance.vehicle, driver: ambulance.driver, driverPhone: ambulance.driverPhone, status: ambulance.status };

    if (req.body.vehicle) ambulance.vehicle = req.body.vehicle.trim().toUpperCase();
    if (req.body.driver !== undefined) ambulance.driver = (req.body.driver || '').trim();
    if (req.body.driverPhone !== undefined) ambulance.driverPhone = (req.body.driverPhone || '').trim();
    if (req.body.status && req.body.status !== ambulance.status) {
      assertTransition('ambulance', ambulance.status, req.body.status);
      ambulance.status = req.body.status;
    }

    await ambulance.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'ambulance.update',
      entityType: 'ambulance',
      entityId: ambulance.id,
      before,
      after: { vehicle: ambulance.vehicle, driver: ambulance.driver, driverPhone: ambulance.driverPhone, status: ambulance.status },
    });

    return ok(res, ambulance);
  })
);

// Patch status or partial fields
router.patch(
  '/:id',
  requireRole(...DISPATCHERS),
  asyncHandler(async (req, res) => {
    const ambulance = await Ambulance.findOne({ id: req.params.id });
    if (!ambulance) throw new ApiError(404, 'NOT_FOUND', 'Ambulance not found.');

    if (['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(req.user.role) && req.user.hospitalId) {
      if (ambulance.hospitalId !== req.user.hospitalId) {
        throw new ApiError(403, 'FORBIDDEN', 'Cannot modify an ambulance belonging to another hospital.');
      }
    }

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

// Decommission / remove ambulance from hospital fleet
router.delete(
  '/:id',
  requireRole('HOSPITAL_ADMIN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const ambulance = await Ambulance.findOne({ id: req.params.id });
    if (!ambulance) throw new ApiError(404, 'NOT_FOUND', 'Ambulance not found.');

    if (req.user.role === 'HOSPITAL_ADMIN' && req.user.hospitalId) {
      if (ambulance.hospitalId !== req.user.hospitalId) {
        throw new ApiError(403, 'FORBIDDEN', 'Cannot decommission an ambulance from another hospital.');
      }
    }

    await Ambulance.deleteOne({ id: req.params.id });

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'ambulance.delete',
      entityType: 'ambulance',
      entityId: req.params.id,
      before: { vehicle: ambulance.vehicle, driver: ambulance.driver },
      after: {},
    });

    return ok(res, { deleted: true, id: req.params.id, vehicle: ambulance.vehicle });
  })
);

module.exports = router;
