const express = require('express');
const Reservation = require('../models/Reservation');
const Prescription = require('../models/Prescription');
const Pharmacy = require('../models/Pharmacy');
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
    const { pharmacyId, patientId, status } = req.query;
    const filter = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    if (patientId) filter.patientId = patientId;
    if (status) filter.status = status;
    const rows = await Reservation.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

// A reservation is a promise to the patient, so the server — not the client —
// decides the token, the cost and when the hold lapses.
const RESERVATION_HOLD_HOURS = 4;

router.post(
  '/',
  requireRole('PATIENT', 'PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const patientId = req.user.role === 'PATIENT' ? req.user.patientId : req.body.patientId;
    const { prescriptionId, pharmacyId, items } = req.body;
    if (!prescriptionId) throw new ApiError(400, 'MISSING_PRESCRIPTION', 'prescriptionId is required.');
    if (!pharmacyId) throw new ApiError(400, 'MISSING_PHARMACY', 'pharmacyId is required.');
    if (!patientId) throw new ApiError(400, 'MISSING_PATIENT', 'patientId is required.');
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'MISSING_ITEMS', 'At least one item is required.');
    }

    const prescription = await Prescription.findOne({ id: prescriptionId });
    if (!prescription) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found.');
    if (prescription.patientId !== patientId) {
      throw new ApiError(403, 'FORBIDDEN', 'This prescription belongs to another patient.');
    }
    if (prescription.dispensingStatus === 'dispensed') {
      throw new ApiError(409, 'ALREADY_DISPENSED', 'This prescription has already been dispensed.');
    }

    const pharmacy = await Pharmacy.findOne({ id: pharmacyId });
    if (!pharmacy) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy not found.');

    const totalCost = items.reduce(
      (sum, i) => sum + Number(i.pricePerUnit || 0) * Number(i.quantity || 0),
      0
    );
    const expiresAt = new Date(Date.now() + RESERVATION_HOLD_HOURS * 3600 * 1000).toISOString();

    const reservation = await Reservation.create({
      id: genId('resv'),
      prescriptionId,
      pharmacyId,
      patientId,
      patientName: prescription.patientName,
      prescriptionCode: prescription.qrCode,
      reservationToken: `RC-${Math.floor(1000 + Math.random() * 8999)}`,
      items,
      totalCost,
      status: 'reserved',
      reservedAt: new Date().toISOString(),
      expiresAt,
    });

    // A hold is not a dispense: dispensingStatus only moves when the pharmacy
    // actually hands the medicines over.
    prescription.pharmacyId = pharmacyId;
    prescription.reservationToken = reservation.reservationToken;
    await prescription.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'reservation.create',
      entityType: 'reservation',
      entityId: reservation.id,
      after: { prescriptionId, pharmacyId, totalCost, expiresAt },
    });

    return ok(res, reservation, 201);
  })
);

router.patch(
  '/:id',
  requireRole('PHARMACIST', 'PATIENT', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const reservation = await Reservation.findOne({ id: req.params.id });
    if (!reservation) throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');

    const fromStatus = reservation.status;
    const toStatus = req.body.status;
    if (toStatus && toStatus !== fromStatus) {
      assertTransition('reservation', fromStatus, toStatus);
    }

    delete req.body.id;
    delete req.body._id;
    Object.assign(reservation, req.body);
    await reservation.save();

    if (toStatus && toStatus !== fromStatus) {
      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'reservation.status',
        entityType: 'reservation',
        entityId: reservation.id,
        before: { status: fromStatus },
        after: { status: reservation.status },
      });
    }
    return ok(res, reservation);
  })
);

router.post(
  '/:id/dispense',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const reservation = await Reservation.findOne({ id: req.params.id });
    if (!reservation) throw new ApiError(404, 'NOT_FOUND', 'Reservation not found.');

    const pharmacyId = req.user.role === 'PHARMACIST' ? req.user.pharmacyId : (req.body.pharmacyId || reservation.pharmacyId);
    if (req.user.role === 'PHARMACIST' && reservation.pharmacyId !== pharmacyId) {
      throw new ApiError(403, 'FORBIDDEN', 'This reservation belongs to another pharmacy.');
    }

    if (reservation.status === 'picked_up') {
      throw new ApiError(409, 'ALREADY_DISPENSED', 'This reservation has already been dispensed.');
    }
    if (['cancelled', 'expired'].includes(reservation.status)) {
      throw new ApiError(409, 'INVALID_STATUS', `Cannot dispense a ${reservation.status} reservation.`);
    }
    if (reservation.expiresAt && new Date() > new Date(reservation.expiresAt)) {
      reservation.status = 'expired';
      await reservation.save();
      throw new ApiError(409, 'RESERVATION_EXPIRED', 'This reservation hold has expired.');
    }

    const rx = await Prescription.findOne({ id: reservation.prescriptionId });
    if (rx && rx.dispensingStatus === 'dispensed') {
      throw new ApiError(409, 'ALREADY_DISPENSED', 'This prescription has already been dispensed.');
    }

    const InventoryItem = require('../models/InventoryItem');
    const deducted = [];
    for (const item of reservation.items || []) {
      const qty = Number(item.quantity || 1);
      const name = item.drugName || item.genericName;
      const updated = await InventoryItem.findOneAndUpdate(
        {
          pharmacyId: reservation.pharmacyId,
          $or: [
            { medicine: { $regex: new RegExp(`^${name}$`, 'i') } },
            { generic: { $regex: new RegExp(`^${name}$`, 'i') } },
            { id: item.id },
          ],
          quantity: { $gte: qty },
        },
        { $inc: { quantity: -qty } },
        { new: true }
      );
      if (updated) deducted.push({ medicine: updated.medicine, remaining: updated.quantity });
    }

    assertTransition('reservation', reservation.status, 'picked_up');
    reservation.status = 'picked_up';
    reservation.dispensedAt = new Date().toISOString();
    await reservation.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'reservation.dispense',
      entityType: 'reservation',
      entityId: reservation.id,
      after: { status: 'picked_up', pharmacyId: reservation.pharmacyId, items: deducted },
    });

    if (rx) {
      assertTransition('prescription', rx.dispensingStatus, 'dispensed');
      rx.dispensingStatus = 'dispensed';
      await rx.save();

      const { sendNotification } = require('../utils/notify');
      await sendNotification({
        recipientId: rx.patientId,
        role: 'PATIENT',
        type: 'prescription',
        title: 'Prescription Dispensed',
        message: `Your prescription (${rx.qrCode}) has been collected at the pharmacy.`,
        relatedEntity: { type: 'reservation', id: reservation.id },
      });
    }

    return ok(res, { reservation, prescription: rx, deducted });
  })
);

module.exports = router;
