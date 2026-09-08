const express = require('express');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const presenceService = require('../services/presence.service');

const router = express.Router();

/**
 * GET /api/presence/doctors
 * Returns real-time online status and lastSeen timestamps for all doctors.
 */
router.get(
  '/doctors',
  asyncHandler(async (req, res) => {
    const presenceMap = await presenceService.getAllPresence();
    return ok(res, presenceMap);
  })
);

/**
 * GET /api/presence/doctors/:id
 * Returns real-time online status and lastSeen for a specific doctor.
 */
router.get(
  '/doctors/:id',
  asyncHandler(async (req, res) => {
    const presence = await presenceService.getDoctorPresence(req.params.id);
    return ok(res, presence);
  })
);

module.exports = router;
