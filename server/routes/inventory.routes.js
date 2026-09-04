const express = require('express');
const InventoryItem = require('../models/InventoryItem');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

function scopedPharmacyId(req, fallback) {
  return req.user.role === 'PHARMACIST' ? req.user.pharmacyId : fallback;
}

router.get(
  '/',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = scopedPharmacyId(req, req.query.pharmacyId);
    const filter = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    const rows = await InventoryItem.find(filter).sort({ medicine: 1 });
    return ok(res, rows);
  })
);

router.post(
  '/',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const pharmacyId = scopedPharmacyId(req, req.body.pharmacyId);
    if (!pharmacyId) throw new ApiError(400, 'MISSING_PHARMACY', 'pharmacyId is required.');
    if (!req.body.medicine) throw new ApiError(400, 'MISSING_MEDICINE', 'medicine is required.');

    const item = await InventoryItem.create({
      id: genId('inv'),
      pharmacyId,
      medicine: req.body.medicine,
      generic: req.body.generic,
      form: req.body.form || 'Tablet',
      manufacturer: req.body.manufacturer,
      quantity: req.body.quantity || 0,
      price: req.body.price || 0,
      batch: req.body.batch,
      expiry: req.body.expiry,
      isJanAushadhi: !!req.body.isJanAushadhi,
      reorderLevel: req.body.reorderLevel != null ? req.body.reorderLevel : 10,
    });
    return ok(res, item, 201);
  })
);

router.patch(
  '/:id',
  requireRole('PHARMACIST', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const item = await InventoryItem.findOne({ id: req.params.id });
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Inventory item not found.');

    delete req.body.id;
    delete req.body._id;
    delete req.body.pharmacyId;
    Object.assign(item, req.body);
    await item.save();
    return ok(res, item);
  })
);

module.exports = router;
