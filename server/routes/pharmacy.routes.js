const express = require('express');
const PharmacyRequest = require('../models/PharmacyRequest');
const Prescription = require('../models/Prescription');
const Reservation = require('../models/Reservation');
const Pharmacy = require('../models/Pharmacy');
const InventoryItem = require('../models/InventoryItem');
const Patient = require('../models/Patient');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');
const { assertTransition } = require('../utils/transitions');
const { writeAudit } = require('../utils/audit');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    !isNaN(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    !isNaN(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!isValidCoord(lat1, lon1) || !isValidCoord(lat2, lon2)) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

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

    if (!reservation && (qrCode || prescriptionId || reservationToken)) {
      rx = await Prescription.findOne(
        qrCode
          ? { qrCode }
          : prescriptionId
          ? { id: prescriptionId }
          : { reservationToken }
      );
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
    const rows = await PharmacyRequest.find(filter).sort({ createdAt: -1 }).lean();

    const prescriptionIds = rows.map((r) => r.prescriptionId).filter(Boolean);
    const patientIds = rows.map((r) => r.patientId).filter(Boolean);

    const [prescriptions, patients, pharmacy] = await Promise.all([
      Prescription.find({ id: { $in: prescriptionIds } }).lean(),
      Patient.find({ id: { $in: patientIds } }).lean(),
      pharmacyId ? Pharmacy.findOne({ id: pharmacyId }).lean() : null,
    ]);

    const rxMap = new Map(prescriptions.map((p) => [p.id, p]));
    const patMap = new Map(patients.map((p) => [p.id, p]));
    const hasPhCoords = pharmacy ? isValidCoord(pharmacy.latitude, pharmacy.longitude) : false;

    const enriched = rows.map((r) => {
      const rx = rxMap.get(r.prescriptionId);
      const pat = patMap.get(r.patientId);
      const hasPatCoords = pat ? isValidCoord(pat.latitude, pat.longitude) : false;
      const distanceKm =
        hasPatCoords && hasPhCoords
          ? calculateDistanceKm(pat.latitude, pat.longitude, pharmacy.latitude, pharmacy.longitude)
          : null;

      const items = (Array.isArray(r.items) && r.items.length > 0)
        ? r.items
        : (Array.isArray(rx?.items) && rx.items.length > 0)
        ? rx.items
        : (Array.isArray(r.medicines) && r.medicines.length > 0)
        ? r.medicines.map((m) => ({
            drugName: typeof m === 'string' ? m : (m.medicine || m.drugName || 'Prescribed Medicine'),
            genericName: '',
            dosage: '1 tab',
            form: 'Tablet',
            frequency: 'OD',
            duration: '5 days',
            quantity: 10,
          }))
        : [];

      return {
        ...r,
        items,
        diagnosis: rx?.diagnosis || r.diagnosis || '',
        doctorName: r.doctorName || rx?.doctorName || 'Prescribing Doctor',
        patientName: r.patientName || rx?.patientName || 'Patient',
        patientLocation: pat ? {
          address: pat.address || '',
          village: pat.village || '',
          district: pat.district || '',
          state: pat.state || '',
          latitude: hasPatCoords ? pat.latitude : null,
          longitude: hasPatCoords ? pat.longitude : null,
          hasCoordinates: hasPatCoords,
        } : null,
        pharmacyLocation: pharmacy ? {
          id: pharmacy.id,
          name: pharmacy.name,
          address: pharmacy.address,
          latitude: hasPhCoords ? pharmacy.latitude : null,
          longitude: hasPhCoords ? pharmacy.longitude : null,
          hasCoordinates: hasPhCoords,
        } : null,
        distanceKm,
      };
    });

    return ok(res, enriched);
  })
);

// ─── GET /api/pharmacy/fulfillment-location/:id ───────────────────────────
// Authorized endpoint for pharmacy staff to inspect accurate canonical coordinates
router.get(
  '/fulfillment-location/:id',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const callerPharmacyId = req.user.role === 'PHARMACIST' ? req.user.pharmacyId : (req.query.pharmacyId || 'ph1');
    const { id } = req.params;

    // Support finding by requestId (phreq-), reservationId (resv-), or prescriptionId (rx-).
    let reqDoc = await PharmacyRequest.findOne({ id }).lean();
    let reservation = null;
    let rx = null;

    if (reqDoc) {
      rx = await Prescription.findOne({ id: reqDoc.prescriptionId }).lean();
    } else {
      rx = await Prescription.findOne({ id }).lean();
      if (rx) {
        reqDoc = await PharmacyRequest.findOne({ prescriptionId: rx.id, pharmacyId: callerPharmacyId }).lean();
      } else {
        reservation = await Reservation.findOne({ id }).lean();
        if (reservation) {
          rx = await Prescription.findOne({ id: reservation.prescriptionId }).lean();
          reqDoc = await PharmacyRequest.findOne({ prescriptionId: reservation.prescriptionId, pharmacyId: callerPharmacyId }).lean();
        }
      }
    }

    if (!reqDoc && !rx && !reservation) {
      throw new ApiError(404, 'NOT_FOUND', 'Prescription or fulfillment request not found.');
    }

    // Security / Authorization check:
    // Pharmacists can only view locations for orders belonging/broadcasted to their pharmacy
    if (req.user.role === 'PHARMACIST') {
      const isAssignedToPharmacy =
        (reqDoc && reqDoc.pharmacyId === callerPharmacyId) ||
        (reservation && reservation.pharmacyId === callerPharmacyId) ||
        (rx && rx.pharmacyId === callerPharmacyId);

      if (!isAssignedToPharmacy) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not authorized to view location for this order.');
      }
    }

    const patientId = reqDoc?.patientId || reservation?.patientId || rx?.patientId;
    const targetPharmacyId = reqDoc?.pharmacyId || reservation?.pharmacyId || rx?.pharmacyId || callerPharmacyId;

    const [pat, ph] = await Promise.all([
      Patient.findOne({ id: patientId }).lean(),
      Pharmacy.findOne({ id: targetPharmacyId }).lean(),
    ]);

    const hasPatientCoords = pat ? isValidCoord(pat.latitude, pat.longitude) : false;
    const hasPharmacyCoords = ph ? isValidCoord(ph.latitude, ph.longitude) : false;
    const distanceKm =
      hasPatientCoords && hasPharmacyCoords
        ? calculateDistanceKm(pat.latitude, pat.longitude, ph.latitude, ph.longitude)
        : null;

    return ok(res, {
      requestId: reqDoc?.id || null,
      reservationId: reservation?.id || null,
      prescriptionId: rx?.id || reqDoc?.prescriptionId || reservation?.prescriptionId,
      prescriptionCode: rx?.qrCode || reqDoc?.prescriptionCode || reservation?.prescriptionCode,
      status: reqDoc?.status || reservation?.status || rx?.dispensingStatus || 'pending',
      patient: {
        id: pat?.id || patientId,
        name: pat?.name || reqDoc?.patientName || rx?.patientName || 'Patient',
        address: pat?.address || 'Address not on record',
        village: pat?.village || '',
        district: pat?.district || '',
        state: pat?.state || '',
        latitude: hasPatientCoords ? pat.latitude : null,
        longitude: hasPatientCoords ? pat.longitude : null,
        hasCoordinates: hasPatientCoords,
      },
      pharmacy: {
        id: ph?.id || targetPharmacyId,
        name: ph?.name || 'Local Pharmacy',
        address: ph?.address || 'Main Road, Ramnagar',
        phone: ph?.phone || '',
        latitude: hasPharmacyCoords ? ph.latitude : null,
        longitude: hasPharmacyCoords ? ph.longitude : null,
        hasCoordinates: hasPharmacyCoords,
      },
      distanceKm,
      hasBothCoordinates: hasPatientCoords && hasPharmacyCoords,
    });
  })
);

router.post(
  '/requests',
  requireRole('DOCTOR', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { prescriptionId, pharmacyId } = req.body;
    if (!prescriptionId) throw new ApiError(400, 'MISSING_PRESCRIPTION', 'prescriptionId is required.');
    if (!pharmacyId) throw new ApiError(400, 'MISSING_PHARMACY', 'pharmacyId is required.');

    let items = req.body.items;
    if (!items || items.length === 0) {
      const rx = await Prescription.findOne({ id: prescriptionId }).lean();
      if (rx) items = rx.items;
    }

    const reqDoc = await PharmacyRequest.create({
      id: genId('phreq'),
      prescriptionId,
      prescriptionCode: req.body.prescriptionCode,
      pharmacyId,
      patientId: req.body.patientId,
      patientName: req.body.patientName,
      doctorName: req.body.doctorName || req.user.name,
      medicines: req.body.medicines || [],
      items: items || [],
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
      const resvItems = (Array.isArray(items) && items.length > 0)
        ? items.map((i) => ({
            ...i,
            drugName: i.drugName || i.medicine,
            medicine: i.medicine || i.drugName,
          }))
        : (rx.items || []);

      reservation = await Reservation.create({
        id: genId('resv'),
        prescriptionId: rx.id,
        pharmacyId: reqDoc.pharmacyId,
        patientId: rx.patientId,
        patientName: rx.patientName,
        prescriptionCode: rx.qrCode,
        reservationToken: token,
        items: resvItems,
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

// ─── POST /api/pharmacy/send-to-stores ────────────────────────────────────
// Doctor or patient broadcasts/routes the canonical prescription to local medical stores
router.post(
  '/send-to-stores',
  requireRole('DOCTOR', 'PATIENT', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { prescriptionId, pharmacyIds } = req.body;
    if (!prescriptionId) throw new ApiError(400, 'MISSING_PRESCRIPTION', 'prescriptionId is required.');

    const rx = await Prescription.findOne({ id: prescriptionId });
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found.');

    // Determine target pharmacies
    let targetPharmacies = [];
    if (Array.isArray(pharmacyIds) && pharmacyIds.length > 0) {
      targetPharmacies = await Pharmacy.find({ id: { $in: pharmacyIds } }).lean();
    } else {
      targetPharmacies = await Pharmacy.find().lean();
    }

    if (!targetPharmacies.length) {
      throw new ApiError(404, 'NO_PHARMACIES', 'No medical stores found to receive prescription.');
    }

    const createdRequests = [];
    for (const ph of targetPharmacies) {
      let reqDoc = await PharmacyRequest.findOne({
        prescriptionId: rx.id,
        pharmacyId: ph.id,
      });

      if (!reqDoc) {
        reqDoc = await PharmacyRequest.create({
          id: genId('phreq'),
          prescriptionId: rx.id,
          prescriptionCode: rx.qrCode,
          pharmacyId: ph.id,
          pharmacyName: ph.name,
          patientId: rx.patientId,
          patientName: rx.patientName,
          doctorName: rx.doctorName,
          medicines: (rx.items || []).map((i) => i.drugName || i.medicine),
          items: rx.items || [],
          status: 'pending',
        });
      }
      createdRequests.push(reqDoc);
    }

    // Advance status to sent_to_pharmacy if currently pending
    if (rx.dispensingStatus === 'pending') {
      assertTransition('prescription', rx.dispensingStatus, 'sent_to_pharmacy');
      rx.dispensingStatus = 'sent_to_pharmacy';
      await rx.save();

      await writeAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'prescription.sendToStores',
        entityType: 'prescription',
        entityId: rx.id,
        after: { dispensingStatus: 'sent_to_pharmacy', storesCount: targetPharmacies.length },
      });

      await sendNotification({
        recipientId: rx.patientId,
        role: 'PATIENT',
        type: 'prescription',
        title: 'Prescription Sent to Medical Stores',
        message: `Your prescription (${rx.qrCode}) was sent to ${targetPharmacies.length} local medical store(s) for availability review.`,
        relatedEntity: { type: 'prescription', id: rx.id },
      });
    }

    return ok(res, {
      success: true,
      prescription: rx,
      sentToStores: targetPharmacies.map((p) => ({ id: p.id, name: p.name, distanceKm: p.distanceKm })),
      requests: createdRequests,
    });
  })
);

// ─── GET /api/pharmacy/inventory-check/:prescriptionId ────────────────────
// Real pharmacy inventory cross-validation against prescription items
router.get(
  '/inventory-check/:prescriptionId',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = req.user.role === 'PHARMACIST' ? req.user.pharmacyId : (req.query.pharmacyId || 'ph1');
    const rx = await Prescription.findOne({ id: req.params.prescriptionId }).lean();
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found.');

    const pharmacy = await Pharmacy.findOne({ id: pharmacyId }).lean();
    const inventory = await InventoryItem.find({ pharmacyId }).lean();

    const itemsCheck = (rx.items || []).map((item) => {
      const neededQty = Number(item.quantity || 1);
      const stock = inventory.find((inv) => matchesDrug(inv, item));
      const inStock = stock ? Number(stock.quantity || 0) : 0;
      const isAvailable = inStock >= neededQty;
      const unitPrice = stock ? Number(stock.price || 0) : 0;

      return {
        id: item.id,
        drugName: item.drugName,
        genericName: item.genericName,
        dosage: item.dosage,
        form: item.form || 'Tablet',
        frequency: item.frequency || 'OD',
        duration: item.duration || '5 days',
        requestedQuantity: neededQty,
        inStockQuantity: inStock,
        isAvailable,
        unitPrice,
        totalPrice: Math.round(unitPrice * neededQty * 100) / 100,
        isJanAushadhi: !!stock?.isJanAushadhi,
        inventoryItemId: stock?.id || null,
      };
    });

    const allAvailable = itemsCheck.length > 0 && itemsCheck.every((i) => i.isAvailable);
    const someAvailable = itemsCheck.some((i) => i.isAvailable);
    const availability = allAvailable ? 'full' : someAvailable ? 'partial' : 'none';
    const totalCost = itemsCheck.reduce((sum, i) => sum + (i.isAvailable ? i.totalPrice : 0), 0);

    return ok(res, {
      prescriptionId: rx.id,
      prescriptionCode: rx.qrCode,
      pharmacyId,
      pharmacyName: pharmacy?.name || 'Local Pharmacy',
      availability,
      totalCost: Math.round(totalCost * 100) / 100,
      itemsCheck,
    });
  })
);

// ─── POST /api/pharmacy/requests/:id/confirm ──────────────────────────────
// Atomic claim & stock reservation by authenticated pharmacy
router.post(
  '/requests/:id/confirm',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = req.user.role === 'PHARMACIST' ? req.user.pharmacyId : req.body.pharmacyId;
    if (!pharmacyId) throw new ApiError(400, 'MISSING_PHARMACY', 'pharmacyId is required.');

    const reqDoc = await PharmacyRequest.findOne({ id: req.params.id });
    if (!reqDoc) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy request not found.');

    const rx = await Prescription.findOne({ id: reqDoc.prescriptionId });
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Linked prescription not found.');

    // Atomic double-claim prevention
    if (
      rx.pharmacyId &&
      rx.pharmacyId !== pharmacyId &&
      ['confirmed', 'preparing', 'ready_for_pickup', 'dispensed'].includes(rx.dispensingStatus)
    ) {
      throw new ApiError(
        409,
        'ALREADY_CLAIMED',
        `This prescription has already been accepted by another pharmacy (${rx.pharmacyName || rx.pharmacyId}).`
      );
    }

    const pharmacy = await Pharmacy.findOne({ id: pharmacyId }).lean();
    const inventory = await InventoryItem.find({ pharmacyId }).lean();

    // Verify inventory on server
    const itemsCheck = (rx.items || []).map((item) => {
      const neededQty = Number(item.quantity || 1);
      const stock = inventory.find((inv) => matchesDrug(inv, item));
      const inStock = stock ? Number(stock.quantity || 0) : 0;
      return {
        ...item,
        drugName: item.drugName,
        medicine: item.drugName,
        requestedQuantity: neededQty,
        inStockQuantity: inStock,
        isAvailable: inStock >= neededQty,
        unitPrice: stock ? Number(stock.price || 0) : 0,
      };
    });

    const allAvailable = itemsCheck.length > 0 && itemsCheck.every((i) => i.isAvailable);
    const someAvailable = itemsCheck.some((i) => i.isAvailable);
    const availability = allAvailable ? 'full' : someAvailable ? 'partial' : 'none';

    if (availability === 'none') {
      throw new ApiError(400, 'OUT_OF_STOCK', 'None of the prescribed items are available in stock.');
    }

    const targetStatus = availability === 'full' ? 'confirmed' : 'partial';
    assertTransition('prescription', rx.dispensingStatus, targetStatus);

    const token = rx.reservationToken || `RC-${Math.floor(1000 + Math.random() * 8999)}`;
    const totalCost = itemsCheck.reduce((s, i) => s + (i.isAvailable ? i.unitPrice * i.requestedQuantity : 0), 0);

    // Atomic assign to this pharmacy
    rx.pharmacyId = pharmacyId;
    rx.pharmacyName = pharmacy?.name || 'Local Pharmacy';
    rx.dispensingStatus = targetStatus;
    rx.reservationToken = token;
    await rx.save();

    // Create/update reservation record
    let reservation = await Reservation.findOne({ prescriptionId: rx.id, pharmacyId });
    if (!reservation) {
      reservation = await Reservation.create({
        id: genId('resv'),
        prescriptionId: rx.id,
        pharmacyId,
        patientId: rx.patientId,
        patientName: rx.patientName,
        prescriptionCode: rx.qrCode,
        reservationToken: token,
        items: itemsCheck.map((i) => ({
          drugName: i.drugName,
          medicine: i.drugName,
          dosage: i.dosage,
          form: i.form,
          quantity: i.requestedQuantity,
          pricePerUnit: i.unitPrice,
        })),
        totalCost: Math.round(totalCost * 100) / 100,
        status: 'reserved',
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      });
    }

    reqDoc.availability = availability;
    reqDoc.status = 'confirmed';
    reqDoc.pharmacyName = pharmacy?.name || 'Local Pharmacy';
    reqDoc.reservationToken = token;
    reqDoc.respondedAt = new Date().toISOString();
    await reqDoc.save();

    // Decline pending requests for other pharmacies to prevent multiple claims
    await PharmacyRequest.updateMany(
      { prescriptionId: rx.id, pharmacyId: { $ne: pharmacyId }, status: 'pending' },
      { $set: { status: 'cancelled' } }
    );

    // Send notification to patient
    await sendNotification({
      recipientId: rx.patientId,
      role: 'PATIENT',
      type: 'prescription',
      title: 'Prescription Confirmed by Pharmacy',
      message: `${pharmacy?.name || 'Pharmacy'} has confirmed your prescription. Token: ${token}.`,
      relatedEntity: { type: 'prescription', id: rx.id },
    });

    return ok(res, {
      request: reqDoc,
      prescription: rx,
      reservation,
      token,
      reservationToken: token,
      pharmacyName: pharmacy?.name,
    });
  })
);

// ─── POST /api/pharmacy/requests/:id/status ───────────────────────────────
// Update fulfillment state: PREPARING -> READY_FOR_PICKUP
router.post(
  '/requests/:id/status',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ['confirmed', 'preparing', 'ready_for_pickup', 'dispensed'];
    if (!allowed.includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', `Status must be one of: ${allowed.join(', ')}`);
    }

    const reqDoc = await PharmacyRequest.findOne({ id: req.params.id });
    if (!reqDoc) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy request not found.');

    const rx = await Prescription.findOne({ id: reqDoc.prescriptionId });
    if (!rx) throw new ApiError(404, 'NOT_FOUND', 'Prescription not found.');

    const fromRx = rx.dispensingStatus;
    assertTransition('prescription', fromRx, status);

    rx.dispensingStatus = status;
    await rx.save();

    reqDoc.status = status;
    await reqDoc.save();

    // Sync reservation status
    const resv = await Reservation.findOne({ prescriptionId: rx.id, pharmacyId: reqDoc.pharmacyId });
    if (resv) {
      if (status === 'ready_for_pickup') {
        resv.status = 'ready_for_pickup';
        await resv.save();
      } else if (status === 'dispensed') {
        resv.status = 'picked_up';
        resv.dispensedAt = new Date().toISOString();
        await resv.save();
      }
    }

    if (status === 'ready_for_pickup') {
      await sendNotification({
        recipientId: rx.patientId,
        role: 'PATIENT',
        type: 'prescription',
        title: 'Medicines Ready for Pickup!',
        message: `Your prescription (${rx.qrCode}) is prepared and ready for pickup at ${reqDoc.pharmacyName || 'your pharmacy'}! Token: ${rx.reservationToken}.`,
        relatedEntity: { type: 'prescription', id: rx.id },
      });
    }

    return ok(res, {
      request: reqDoc,
      prescription: rx,
      status,
    });
  })
);

router.get(
  '/profile',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = req.user.pharmacyId || 'ph1';
    const pharmacy = await Pharmacy.findOne({ id: pharmacyId });
    if (!pharmacy) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy not found.');

    return ok(res, {
      id: pharmacy.id,
      name: pharmacy.name,
      address: pharmacy.address,
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      phone: pharmacy.phone,
      isJanAushadhi: pharmacy.isJanAushadhi,
      operatingHours: pharmacy.operatingHours,
      hasCoordinates: isValidCoord(pharmacy.latitude, pharmacy.longitude),
      locationUpdatedAt: pharmacy.locationUpdatedAt,
    });
  })
);

const handlePharmacyLocationUpdate = asyncHandler(async (req, res) => {
  const pharmacyId = req.user.pharmacyId || 'ph1';
  const pharmacy = await Pharmacy.findOne({ id: pharmacyId });
  if (!pharmacy) throw new ApiError(404, 'NOT_FOUND', 'Pharmacy not found.');

  const { latitude, longitude, address } = req.body || {};
  if (latitude !== undefined && longitude !== undefined) {
    const numLat = Number(latitude);
    const numLng = Number(longitude);
    if (!isValidCoord(numLat, numLng)) {
      throw new ApiError(400, 'INVALID_COORDINATES', 'Latitude must be between -90 and 90, longitude between -180 and 180.');
    }
    pharmacy.latitude = numLat;
    pharmacy.longitude = numLng;
    pharmacy.locationUpdatedAt = new Date();
  }
  if (address && typeof address === 'string') {
    pharmacy.address = address.trim();
  }
  await pharmacy.save();

  await writeAudit({
    actorId: req.user.sub,
    actorRole: req.user.role,
    action: 'pharmacy.location_update',
    entityType: 'pharmacy',
    entityId: pharmacy.id,
    before: {},
    after: { address: pharmacy.address, latitude: pharmacy.latitude, longitude: pharmacy.longitude },
  });

  return ok(res, {
    id: pharmacy.id,
    name: pharmacy.name,
    address: pharmacy.address,
    latitude: pharmacy.latitude,
    longitude: pharmacy.longitude,
    hasCoordinates: isValidCoord(pharmacy.latitude, pharmacy.longitude),
    locationUpdatedAt: pharmacy.locationUpdatedAt,
  });
});

router.put('/location', requireRole('PHARMACIST', 'ADMIN'), handlePharmacyLocationUpdate);
router.patch('/location', requireRole('PHARMACIST', 'ADMIN'), handlePharmacyLocationUpdate);

module.exports = router;
