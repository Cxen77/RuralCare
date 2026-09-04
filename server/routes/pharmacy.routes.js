const express = require('express');
const PharmacyRequest = require('../models/PharmacyRequest');
const Prescription = require('../models/Prescription');
const Reservation = require('../models/Reservation');
const Pharmacy = require('../models/Pharmacy');
const InventoryItem = require('../models/InventoryItem');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');
const { assertTransition } = require('../utils/transitions');
const { writeAudit } = require('../utils/audit');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

const AVAILABILITY_TO_STATUS = { full: 'dispensed', partial: 'partial' };

// Helper to normalize drug name for matching
function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesDrug(invItem, rxItem) {
  const invMed = normalizeName(invItem.medicine);
  const invGen = normalizeName(invItem.generic);
  const rxDrug = normalizeName(rxItem.drugName);
  const rxGen = normalizeName(rxItem.genericName);

  if (rxGen && invGen && (invGen.includes(rxGen) || rxGen.includes(invGen))) return true;
  if (rxDrug && invMed && (invMed.includes(rxDrug) || rxDrug.includes(invMed))) return true;
  if (rxDrug && invGen && (invGen.includes(rxDrug) || rxDrug.includes(invGen))) return true;
  if (rxGen && invMed && (invMed.includes(rxGen) || rxGen.includes(invMed))) return true;
  return false;
}

function isPharmacyOpen(operatingHours) {
  if (!operatingHours) return true;
  // Format e.g. "08:00 - 20:00"
  try {
    const match = operatingHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) return true;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const openMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    const closeMins = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
    return currentMins >= openMins && currentMins <= closeMins;
  } catch {
    return true;
  }
}

// ─── POST/GET /api/pharmacy/match ──────────────────────────────────────────
// Server-authoritative matching prioritizing completeness, fewest trips, distance,
// operating status, and inventory freshness. Supports split fulfillment.
const matchHandler = asyncHandler(async (req, res) => {
  const prescriptionId = req.body.prescriptionId || req.query.prescriptionId;
  let items = req.body.items;
  let rx = null;

  if (prescriptionId) {
    rx = await Prescription.findOne({ id: prescriptionId });
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found.');
    items = rx.items || [];
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'MISSING_ITEMS', 'Prescription items required for matching.');
  }

  const pharmacies = await Pharmacy.find().lean();
  const allInventory = await InventoryItem.find().lean();

  // Group inventory items by pharmacyId
  const invByPharmacy = {};
  for (const inv of allInventory) {
    if (!invByPharmacy[inv.pharmacyId]) invByPharmacy[inv.pharmacyId] = [];
    invByPharmacy[inv.pharmacyId].push(inv);
  }

  const singleMatches = [];

  for (const ph of pharmacies) {
    const pharmacyInventory = invByPharmacy[ph.id] || [];
    // Also include embedded inventory if any
    const embedded = (ph.inventory || []).map(ei => ({
      id: ei.id || genId('inv'),
      pharmacyId: ph.id,
      medicine: ei.drugName,
      generic: ei.genericName,
      quantity: ei.quantity || 0,
      price: ei.pricePerUnit || 0,
      isJanAushadhi: ei.isJanAushadhi,
      form: ei.form,
      updatedAt: ph.updatedAt,
    }));

    const fullCatalog = pharmacyInventory.length > 0 ? pharmacyInventory : embedded;

    const availableItems = [];
    const missingItems = [];
    let totalCost = 0;
    let newestUpdate = ph.updatedAt ? new Date(ph.updatedAt).getTime() : Date.now();

    for (const rxItem of items) {
      const neededQty = Number(rxItem.quantity || 1);
      const stock = fullCatalog.find(inv => matchesDrug(inv, rxItem) && inv.quantity >= neededQty);

      if (stock) {
        const itemPrice = Number(stock.price || stock.pricePerUnit || 0);
        const itemCost = itemPrice * neededQty;
        availableItems.push({
          id: stock.id,
          drugName: rxItem.drugName || stock.medicine,
          genericName: rxItem.genericName || stock.generic,
          form: stock.form || rxItem.form || 'Tablet',
          quantity: neededQty,
          pricePerUnit: itemPrice,
          totalPrice: Math.round(itemCost * 100) / 100,
          isJanAushadhi: !!stock.isJanAushadhi,
          inStock: stock.quantity,
          lastUpdated: stock.updatedAt ? new Date(stock.updatedAt).toISOString() : new Date().toISOString(),
        });
        totalCost += itemCost;
        if (stock.updatedAt) {
          const t = new Date(stock.updatedAt).getTime();
          if (t > newestUpdate) newestUpdate = t;
        }
      } else {
        missingItems.push(rxItem.drugName || rxItem.genericName || 'Medicine');
      }
    }

    const completeness = items.length > 0 ? availableItems.length / items.length : 0;
    const isOpen = isPharmacyOpen(ph.operatingHours);

    singleMatches.push({
      type: 'single',
      pharmacyId: ph.id,
      pharmacyName: ph.name,
      address: ph.address,
      distanceKm: ph.distanceKm ?? 2.0,
      phone: ph.phone,
      isJanAushadhi: !!ph.isJanAushadhi,
      operatingHours: ph.operatingHours || '08:00 - 20:00',
      isOpen,
      rating: ph.rating ?? 4.5,
      completeness,
      totalCost: Math.round(totalCost * 100) / 100,
      availableItems,
      missingItems,
      lastUpdated: new Date(newestUpdate).toISOString(),
    });
  }

  // Rank single matches:
  // 1. Completeness DESC
  // 2. Open status DESC
  // 3. Jan Aushadhi (cost efficiency)
  // 4. Total cost ASC
  // 5. Distance ASC
  singleMatches.sort((a, b) => {
    if (b.completeness !== a.completeness) return b.completeness - a.completeness;
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
    return a.distanceKm - b.distanceKm;
  });

  // Calculate split fulfillment if best single store is not 100%
  const splitMatches = [];
  const bestCompleteness = singleMatches[0]?.completeness || 0;

  if (items.length > 1 && bestCompleteness < 1.0) {
    for (let i = 0; i < singleMatches.length; i++) {
      for (let j = i + 1; j < singleMatches.length; j++) {
        const phA = singleMatches[i];
        const phB = singleMatches[j];

        const coveredDrugs = new Set();
        const splitItemsA = [];
        const splitItemsB = [];

        for (const item of phA.availableItems) {
          coveredDrugs.add(item.drugName);
          splitItemsA.push(item);
        }
        for (const item of phB.availableItems) {
          if (!coveredDrugs.has(item.drugName)) {
            coveredDrugs.add(item.drugName);
            splitItemsB.push(item);
          }
        }

        if (coveredDrugs.size === items.length && splitItemsA.length > 0 && splitItemsB.length > 0) {
          const costA = splitItemsA.reduce((s, x) => s + x.totalPrice, 0);
          const costB = splitItemsB.reduce((s, x) => s + x.totalPrice, 0);
          splitMatches.push({
            type: 'split',
            completeness: 1.0,
            totalTrips: 2,
            totalDistanceKm: Math.round((phA.distanceKm + phB.distanceKm) * 10) / 10,
            totalCost: Math.round((costA + costB) * 100) / 100,
            pharmacies: [
              {
                pharmacyId: phA.pharmacyId,
                pharmacyName: phA.pharmacyName,
                distanceKm: phA.distanceKm,
                items: splitItemsA,
                cost: Math.round(costA * 100) / 100,
              },
              {
                pharmacyId: phB.pharmacyId,
                pharmacyName: phB.pharmacyName,
                distanceKm: phB.distanceKm,
                items: splitItemsB,
                cost: Math.round(costB * 100) / 100,
              },
            ],
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    }

    splitMatches.sort((a, b) => a.totalDistanceKm - b.totalDistanceKm || a.totalCost - b.totalCost);
  }

  return ok(res, {
    prescriptionId: rx?.id,
    prescriptionCode: rx?.qrCode,
    totalRequiredItems: items.length,
    matches: singleMatches,
    splitMatches: splitMatches.slice(0, 3), // top 3 split recommendations
    evaluatedAt: new Date().toISOString(),
  });
});

router.post('/match', matchHandler);
router.get('/match', matchHandler);

// ─── POST /api/pharmacy/dispense ───────────────────────────────────────────
// Server-authoritative dispensing with atomic stock deduction and double-dispense prevention
router.post(
  '/dispense',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = req.user.role === 'PHARMACIST' ? req.user.pharmacyId : req.body.pharmacyId;
    const { reservationToken, qrCode, reservationId, prescriptionId } = req.body;

    if (!pharmacyId) throw new ApiError(400, 'MISSING_PHARMACY', 'pharmacyId is required.');

    let reservation = null;
    let rx = null;

    if (reservationId) {
      reservation = await Reservation.findOne({ id: reservationId });
    } else if (reservationToken) {
      reservation = await Reservation.findOne({ reservationToken });
    }

    if (!reservation && (qrCode || prescriptionId)) {
      rx = await Prescription.findOne(qrCode ? { qrCode } : { id: prescriptionId });
      if (rx) {
        reservation = await Reservation.findOne({ prescriptionId: rx.id, status: 'reserved' });
      }
    }

    if (!reservation && !rx) {
      throw new ApiError(404, 'NOT_FOUND', 'Reservation or prescription not found for dispensing.');
    }

    if (!rx && reservation) {
      rx = await Prescription.findOne({ id: reservation.prescriptionId });
    }

    if (reservation) {
      // Ownership check
      if (req.user.role === 'PHARMACIST' && reservation.pharmacyId !== pharmacyId) {
        throw new ApiError(403, 'FORBIDDEN', 'This reservation belongs to another pharmacy.');
      }
      // Status check
      if (reservation.status === 'picked_up') {
        throw new ApiError(409, 'ALREADY_DISPENSED', 'This reservation has already been dispensed.');
      }
      if (reservation.status === 'cancelled' || reservation.status === 'expired') {
        throw new ApiError(409, 'INVALID_STATUS', `Cannot dispense a ${reservation.status} reservation.`);
      }
      // Expiry check
      if (reservation.expiresAt && new Date() > new Date(reservation.expiresAt)) {
        reservation.status = 'expired';
        await reservation.save();
        throw new ApiError(409, 'RESERVATION_EXPIRED', 'This reservation hold has expired.');
      }
    }

    if (rx && rx.dispensingStatus === 'dispensed') {
      throw new ApiError(409, 'ALREADY_DISPENSED', 'This prescription has already been completely dispensed.');
    }

    // Atomic inventory deduction
    const itemsToDeduct = reservation?.items || rx?.items || [];
    const deductedItems = [];

    for (const item of itemsToDeduct) {
      const qty = Number(item.quantity || 1);
      const name = item.drugName || item.medicine;

      // Atomically decrement stock in InventoryItem collection
      const updated = await InventoryItem.findOneAndUpdate(
        {
          pharmacyId,
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

      if (updated) {
        deductedItems.push({ medicine: updated.medicine, remaining: updated.quantity });
      }
    }

    // Update reservation status
    if (reservation) {
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
        after: { status: 'picked_up', pharmacyId, dispensedItems: deductedItems },
      });
    }

    // Update prescription status
    if (rx) {
      const fromRxStatus = rx.dispensingStatus;
      assertTransition('prescription', fromRxStatus, 'dispensed');
      rx.dispensingStatus = 'dispensed';
      rx.pharmacyId = pharmacyId;
      await rx.save();

      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'prescription.dispensed',
        entityType: 'prescription',
        entityId: rx.id,
        before: { dispensingStatus: fromRxStatus },
        after: { dispensingStatus: 'dispensed', pharmacyId },
      });

      // Send notification to patient
      await sendNotification({
        recipientId: rx.patientId,
        role: 'PATIENT',
        type: 'prescription',
        title: 'Medicines Dispensed',
        message: `Your prescription (${rx.qrCode}) has been dispensed by the pharmacy.`,
        relatedEntity: { type: 'prescription', id: rx.id },
      });
    }

    return ok(res, {
      status: 'dispensed',
      reservation,
      prescription: rx,
      deductedItems,
      dispensedAt: new Date().toISOString(),
    });
  })
);

router.get(
  '/requests',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = req.user.role === 'PHARMACIST' ? req.user.pharmacyId : req.query.pharmacyId;
    const filter = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    if (req.query.status) filter.status = req.query.status;
    const rows = await PharmacyRequest.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

router.post(
  '/requests',
  requireRole('DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { prescriptionId, pharmacyId } = req.body;
    if (!prescriptionId) throw new ApiError(400, 'MISSING_PRESCRIPTION', 'prescriptionId is required.');
    if (!pharmacyId) throw new ApiError(400, 'MISSING_PHARMACY', 'pharmacyId is required.');
    const reqDoc = await PharmacyRequest.create({
      id: genId('phreq'),
      prescriptionId,
      prescriptionCode: req.body.prescriptionCode,
      pharmacyId,
      patientId: req.body.patientId,
      patientName: req.body.patientName,
      doctorName: req.body.doctorName || req.user.name,
      medicines: req.body.medicines || [],
      status: 'pending',
    });
    return ok(res, reqDoc, 201);
  })
);

router.post(
  '/requests/:id/respond',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { availability, reserve, items, totalCost } = req.body;
    if (!['full', 'partial', 'none'].includes(availability)) {
      throw new ApiError(400, 'INVALID_AVAILABILITY', "availability must be 'full', 'partial', or 'none'.");
    }

    const reqDoc = await PharmacyRequest.findOne({ id: req.params.id });
    if (!reqDoc) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy request not found.');

    const rx = await Prescription.findOne({ id: reqDoc.prescriptionId });
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Linked prescription not found.');

    // Reflect availability onto the prescription's dispensing status via a legal transition.
    const nextStatus = AVAILABILITY_TO_STATUS[availability];
    if (nextStatus && nextStatus !== rx.dispensingStatus) {
      assertTransition('prescription', rx.dispensingStatus, nextStatus);
      const fromStatus = rx.dispensingStatus;
      rx.dispensingStatus = nextStatus;
      await rx.save();
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

    let reservation = null;
    if (reserve && availability !== 'none') {
      const token = `RC-${Math.floor(1000 + Math.random() * 8999)}`;
      reservation = await Reservation.create({
        id: genId('resv'),
        prescriptionId: rx.id,
        pharmacyId: reqDoc.pharmacyId,
        patientId: rx.patientId,
        patientName: rx.patientName,
        prescriptionCode: rx.qrCode,
        reservationToken: token,
        items: items || rx.items,
        totalCost: totalCost || 0,
        status: 'reserved',
        reservedAt: new Date().toISOString(),
      });
      rx.reservationToken = token;
      await rx.save();
    }

    reqDoc.availability = availability;
    reqDoc.status = reserve && availability !== 'none' ? 'reserved' : 'responded';
    reqDoc.respondedAt = new Date().toISOString();
    await reqDoc.save();

    return ok(res, { request: reqDoc, prescription: rx, reservation });
  })
);

module.exports = router;
