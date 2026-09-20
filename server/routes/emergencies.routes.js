const express = require('express');
const multer = require('multer');
const EmergencyReport = require('../models/EmergencyReport');
const Ambulance = require('../models/Ambulance');
const { uploadEmergencyImage } = require('../services/cloudinary.service');
const { emitEmergencyCreated, emitEmergencyUpdated } = require('../services/socket.service');
const { sendNotification } = require('../utils/notify');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { optionalAuth } = require('../middleware/auth');
const genId = require('../utils/id');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only camera image files are allowed.'));
    }
  },
});

function normalizeEmergencyType(type) {
  if (!type) return 'road_accident';
  const clean = type.toString().toLowerCase().replace(/[^a-z]/g, '_');
  if (clean.includes('accident') || clean.includes('road')) return 'road_accident';
  if (clean.includes('medical')) return 'medical_emergency';
  if (clean.includes('fire')) return 'fire';
  if (clean.includes('hazard') || clean.includes('natural')) return 'natural_hazard';
  return 'other';
}

function normalizeStatus(status) {
  if (!status) return 'reported';
  const s = status.toString().toLowerCase();
  if (s.includes('dispatch')) return 'dispatched';
  if (s.includes('verif')) return 'verified';
  if (s.includes('resolv')) return 'resolved';
  return 'reported';
}

/**
 * GET /api/emergencies/nearby
 * Find active community emergencies within a given radius (default 50km)
 * Public / optional auth for Live Care Map
 */
router.get(
  '/nearby',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || 50;
    const status = req.query.status;

    const query = {};
    if (status && status !== 'all') {
      query.status = normalizeStatus(status);
    } else {
      query.$or = [
        { status: { $ne: 'resolved' } },
        { resolvedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ];
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: radiusKm * 1000,
        },
      };
    }

    const reports = await EmergencyReport.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Sanitize reporter names for community privacy
    const sanitized = reports.map((r) => {
      const nameParts = (r.reporterName || 'Citizen').trim().split(' ');
      const maskedName = nameParts.length > 0 ? `${nameParts[0]} (Citizen)` : 'Community Member';
      return {
        ...r,
        reporterName: maskedName,
        reporterPhone: undefined,
      };
    });

    return ok(res, sanitized);
  })
);

/**
 * GET /api/emergencies
 * Responder listing for Doctors, Hospitals, and Admins
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { status, emergencyType, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = normalizeStatus(status);
    if (emergencyType && emergencyType !== 'all') filter.emergencyType = normalizeEmergencyType(emergencyType);

    const reports = await EmergencyReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    return ok(res, reports);
  })
);

/**
 * GET /api/emergencies/:id
 * Retrieve a specific emergency incident
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const report = await EmergencyReport.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!report) {
      throw new ApiError(404, 'NOT_FOUND', 'Emergency report not found.');
    }
    return ok(res, report);
  })
);

/**
 * POST /api/emergencies
 * Create a new emergency report with live camera photo upload
 */
router.post(
  '/',
  optionalAuth,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const { emergencyType, description, latitude, longitude, address, reporterName, phone, severity } = req.body;

    if (!req.file) {
      throw new ApiError(400, 'PHOTO_REQUIRED', 'A live camera photo is required to submit an emergency report.');
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      throw new ApiError(400, 'LOCATION_REQUIRED', 'Valid GPS coordinates (latitude, longitude) are required.');
    }

    const normType = normalizeEmergencyType(emergencyType);

    // Rate limiting: max 5 reports per user within 10 minutes
    const reporterId = req.user?.sub || genId('rep');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await EmergencyReport.countDocuments({
      createdAt: { $gte: tenMinutesAgo },
      reporterId,
    });
    if (recentCount >= 5) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many emergency reports submitted. Please wait a few minutes.');
    }

    // Upload to Cloudinary (or local fallback in development)
    const uploadResult = await uploadEmergencyImage(
      req.file.buffer,
      `emergency_${Date.now()}.jpg`,
      req.file.mimetype
    );

    const reportId = genId('emg');
    const repName = (req.user?.name || reporterName || 'Community Member').trim();
    const repPhone = (req.user?.phone || phone || '').trim();

    const newReport = await EmergencyReport.create({
      id: reportId,
      reporterId,
      reporterName: repName,
      reporterPhone: repPhone,
      imageUrl: uploadResult.imageUrl || uploadResult.url,
      cloudinaryPublicId: uploadResult.cloudinaryPublicId || uploadResult.publicId,
      latitude: lat,
      longitude: lng,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      address: address || 'Emergency Location Locked via GPS',
      emergencyType: normType,
      description: (description || '').slice(0, 150),
      status: 'reported',
      severity: ['critical', 'high', 'moderate'].includes(severity) ? severity : 'high',
      timeline: [
        {
          status: 'reported',
          timestamp: new Date(),
          updatedBy: repName,
          role: 'citizen',
          note: 'Incident photo captured and report broadcast to Care Map.',
        },
      ],
    });

    console.log(`[Emergency] Created report ${newReport.id} (${normType}) at [${lng}, ${lat}]`);

    // Broadcast real-time event via Socket.IO
    emitEmergencyCreated(newReport.toObject());

    // Send push / in-app notification if user is logged in
    if (req.user?.sub) {
      await sendNotification({
        userId: req.user.sub,
        title: '🚨 Emergency Broadcast Sent',
        body: 'Your live incident report has been sent to nearby response units and the Care Map.',
        data: { emergencyId: newReport.id },
      }).catch(() => {});
    }

    return ok(res, newReport, 201);
  })
);

/**
 * PATCH /api/emergencies/:id/status
 * Update incident status
 */
router.patch(
  '/:id/status',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    const report = await EmergencyReport.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!report) {
      throw new ApiError(404, 'NOT_FOUND', 'Emergency report not found.');
    }

    const normStatus = normalizeStatus(status);
    const updaterName = req.user?.name || 'Emergency Responder';

    report.status = normStatus;
    report.timeline.push({
      status: normStatus,
      timestamp: new Date(),
      updatedBy: updaterName,
      role: req.user?.role?.toLowerCase() || 'doctor',
      note: note || `Status updated to ${normStatus}`,
    });

    if (normStatus === 'resolved') {
      report.resolvedAt = new Date();
      report.ambulanceStatus = 'completed';
    }

    await report.save();

    emitEmergencyUpdated(report.toObject());

    return ok(res, report);
  })
);

/**
 * POST /api/emergencies/:id/dispatch
 * Dispatch an ambulance and assign hospital
 */
router.post(
  '/:id/dispatch',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { hospitalId, hospitalName, ambulanceId, vehicleNumber, driverName, driverPhone, etaMinutes } = req.body;

    const report = await EmergencyReport.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!report) {
      throw new ApiError(404, 'NOT_FOUND', 'Emergency report not found.');
    }

    const updaterName = req.user?.name || hospitalName || 'Hospital Emergency Wing';

    report.status = 'dispatched';
    report.assignedHospitalId = hospitalId || 'hosp-601';
    report.assignedHospitalName = hospitalName || 'District Hospital Emergency Wing';
    report.ambulanceId = ambulanceId || 'amb-101';
    report.ambulanceVehicle = vehicleNumber || 'UP-53-EM-9901';
    report.driverName = driverName || 'Rajesh Kumar';
    report.driverPhone = driverPhone || '+91 94150 12345';
    report.etaMinutes = etaMinutes || 10;
    report.ambulanceStatus = 'dispatched';

    report.timeline.push({
      status: 'dispatched',
      timestamp: new Date(),
      updatedBy: updaterName,
      role: 'hospital',
      note: `Ambulance ${report.ambulanceVehicle} dispatched by ${report.assignedHospitalName}. Driver: ${report.driverName} (${report.driverPhone}). ETA: ~${report.etaMinutes} mins.`,
    });

    await report.save();

    // Mark ambulance busy in fleet if present
    if (ambulanceId) {
      await Ambulance.findOneAndUpdate(
        { $or: [{ id: ambulanceId }, { _id: ambulanceId.match(/^[0-9a-fA-F]{24}$/) ? ambulanceId : null }] },
        { status: 'busy' }
      ).catch(() => {});
    }

    emitEmergencyUpdated(report.toObject());

    return ok(res, report);
  })
);

/**
 * POST /api/emergencies/:id/resolve
 * Mark incident as resolved
 */
router.post(
  '/:id/resolve',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { resolutionNotes } = req.body;
    const report = await EmergencyReport.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }],
    });
    if (!report) {
      throw new ApiError(404, 'NOT_FOUND', 'Emergency report not found.');
    }

    const updaterName = req.user?.name || 'Emergency Team';

    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.resolutionNotes = resolutionNotes || 'Incident safely handled and resolved.';
    report.ambulanceStatus = 'completed';

    report.timeline.push({
      status: 'resolved',
      timestamp: new Date(),
      updatedBy: updaterName,
      role: 'doctor',
      note: report.resolutionNotes,
    });

    await report.save();

    // Free ambulance back to available
    if (report.ambulanceId) {
      await Ambulance.findOneAndUpdate(
        { $or: [{ id: report.ambulanceId }, { _id: report.ambulanceId.match(/^[0-9a-fA-F]{24}$/) ? report.ambulanceId : null }] },
        { status: 'available' }
      ).catch(() => {});
    }

    emitEmergencyUpdated(report.toObject());

    return ok(res, report);
  })
);

module.exports = router;
