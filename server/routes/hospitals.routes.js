const express = require('express');
const Hospital = require('../models/Hospital');
const Ambulance = require('../models/Ambulance');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireRole } = require('../middleware/rbac');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

function normalizeStr(s) {
  return String(s || '').toLowerCase().trim();
}

const hospitalMatchHandler = asyncHandler(async (req, res) => {
  const specialty = req.body.specialty || req.query.specialty;
  const bedType = req.body.beds || req.body.bedType || req.query.beds;
  const diagnostics = req.body.diagnostics || (req.query.diagnostics ? String(req.query.diagnostics).split(',') : []);
  const bloodGroup = req.body.bloodGroup || req.query.bloodGroup;

  const hospitals = await Hospital.find().lean();
  const matches = [];

  for (const hosp of hospitals) {
    let score = 0;
    const reasons = [];

    // Specialty check (40 pts)
    const depts = (hosp.departments || []).map(normalizeStr);
    const specs = (hosp.capabilities?.specialties || []).map(normalizeStr);
    const allSpecs = [...new Set([...depts, ...specs])];
    const specNorm = normalizeStr(specialty);

    if (specNorm) {
      const hasSpec = allSpecs.some(s => s.includes(specNorm) || specNorm.includes(s));
      if (hasSpec) {
        score += 40;
        reasons.push(`Specialty available: ${specialty}`);
      } else {
        reasons.push(`Specialty ${specialty} not listed`);
      }
    } else {
      score += 40;
    }

    // Bed availability check (30 pts)
    const bedNorm = normalizeStr(bedType);
    let bedAvailable = true;
    let bedCount = hosp.beds?.general || 0;

    if (bedNorm.includes('icu')) {
      bedCount = hosp.beds?.icu || 0;
      bedAvailable = bedCount > 0;
    } else if (bedNorm.includes('emergency')) {
      bedCount = hosp.beds?.emergency || 0;
      bedAvailable = bedCount > 0;
    } else if (bedNorm.includes('ventilator')) {
      bedCount = hosp.beds?.ventilator || 0;
      bedAvailable = bedCount > 0;
    } else if (bedNorm.includes('general')) {
      bedCount = hosp.beds?.general || 0;
      bedAvailable = bedCount > 0;
    }

    if (bedAvailable && bedCount > 0) {
      score += 30;
      reasons.push(`${bedCount} bed(s) available for ${bedType || 'General'}`);
    } else if (bedType) {
      reasons.push(`No available beds for ${bedType}`);
    } else {
      score += 20;
    }

    // Diagnostics check (20 pts)
    const hospDiags = (hosp.diagnostics || []).map(normalizeStr);
    if (hosp.capabilities?.hasCtScan) hospDiags.push('ct', 'ct scan');
    if (hosp.capabilities?.hasMri) hospDiags.push('mri');
    if (hosp.capabilities?.hasXray) hospDiags.push('x-ray', 'xray');
    if (hosp.capabilities?.hasUltrasound) hospDiags.push('ultrasound', 'usg');
    if (hosp.capabilities?.hasPathology) hospDiags.push('cbc', 'pathology');

    if (Array.isArray(diagnostics) && diagnostics.length > 0) {
      let matchedCount = 0;
      for (const reqDiag of diagnostics) {
        const dNorm = normalizeStr(reqDiag);
        if (hospDiags.some(hd => hd.includes(dNorm) || dNorm.includes(hd))) {
          matchedCount += 1;
        }
      }
      const diagScore = Math.round((matchedCount / diagnostics.length) * 20);
      score += diagScore;
      reasons.push(`${matchedCount}/${diagnostics.length} required diagnostics supported`);
    } else {
      score += 20;
    }

    // Blood check (10 pts)
    if (bloodGroup && hosp.blood) {
      const units = hosp.blood[bloodGroup] || 0;
      if (units > 0) {
        score += 10;
        reasons.push(`${units} unit(s) of ${bloodGroup} blood available`);
      } else {
        reasons.push(`No ${bloodGroup} blood units in stock`);
      }
    } else {
      score += 10;
    }

    // Check available ambulances
    const availableAmbulances = await Ambulance.countDocuments({ hospitalId: hosp.id, status: 'available' });

    matches.push({
      hospitalId: hosp.id,
      hospitalName: hosp.name,
      type: hosp.type,
      address: hosp.address,
      distanceKm: hosp.distanceKm || 5.0,
      phone: hosp.phone,
      rating: hosp.rating || 4.5,
      score,
      matchPercentage: score,
      beds: hosp.beds,
      blood: hosp.blood,
      diagnostics: hosp.diagnostics,
      departments: hosp.departments,
      availableAmbulances,
      reasons,
      lastUpdated: hosp.updatedAt || new Date().toISOString(),
    });
  }

  // Sort by score DESC, then distance ASC
  matches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);

  return ok(res, {
    totalMatches: matches.length,
    matches,
    evaluatedAt: new Date().toISOString(),
  });
});

router.post('/match', hospitalMatchHandler);
router.get('/match', hospitalMatchHandler);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await Hospital.find().sort({ distanceKm: 1 });
    return ok(res, rows);
  })
);

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

const handleHospitalLocationUpdate = asyncHandler(async (req, res) => {
  const hospitalId = req.user?.hospitalId || req.params.id || req.body.hospitalId || 'hosp-601';
  let hospital = await Hospital.findOne({ id: hospitalId });
  if (!hospital) {
    hospital = (await Hospital.find().sort({ createdAt: 1 }).limit(1))[0];
  }
  if (!hospital) throw new ApiError(404, 'NOT_FOUND', 'Hospital not found.');

  const { latitude, longitude, address } = req.body || {};
  if (latitude !== undefined && longitude !== undefined) {
    const numLat = Number(latitude);
    const numLng = Number(longitude);
    if (!isValidCoord(numLat, numLng)) {
      throw new ApiError(400, 'INVALID_COORDINATES', 'Latitude must be between -90 and 90, longitude between -180 and 180.');
    }
    hospital.latitude = numLat;
    hospital.longitude = numLng;
    hospital.locationUpdatedAt = new Date();
  }
  if (address && typeof address === 'string') {
    hospital.address = address.trim();
  }
  await hospital.save();

  await writeAudit({
    actorId: req.user?.sub || 'system',
    actorRole: req.user?.role || 'HOSPITAL_ADMIN',
    action: 'hospital.location_update',
    entityType: 'hospital',
    entityId: hospital.id,
    before: {},
    after: { address: hospital.address, latitude: hospital.latitude, longitude: hospital.longitude },
  });

  return ok(res, {
    id: hospital.id,
    name: hospital.name,
    address: hospital.address,
    latitude: hospital.latitude,
    longitude: hospital.longitude,
    hasCoordinates: isValidCoord(hospital.latitude, hospital.longitude),
    locationUpdatedAt: hospital.locationUpdatedAt,
  });
});

// Specific /location routes must be defined before generic /:id routes
router.put('/location', requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'), handleHospitalLocationUpdate);
router.patch('/location', requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'), handleHospitalLocationUpdate);
router.put('/:id/location', requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'), handleHospitalLocationUpdate);

router.get(
  '/me',
  requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const hospitalId = req.user.hospitalId || 'hosp-601';
    let hospital = await Hospital.findOne({ id: hospitalId });
    if (!hospital) {
      hospital = (await Hospital.find().sort({ createdAt: 1 }).limit(1))[0];
    }
    if (!hospital) throw new ApiError(404, 'NOT_FOUND', 'Hospital record not found.');
    return ok(res, hospital);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const hospital = await Hospital.findOne({ id: req.params.id });
    if (!hospital) throw new ApiError(404, 'NOT_FOUND', 'Hospital not found.');
    return ok(res, hospital);
  })
);

router.patch(
  '/:id',
  requireRole('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const hospital = await Hospital.findOne({ id: req.params.id });
    if (!hospital) throw new ApiError(404, 'NOT_FOUND', 'Hospital not found.');

    const before = {
      name: hospital.name,
      phone: hospital.phone,
      emergencyHelpline: hospital.emergencyHelpline,
      acceptingEmergency: hospital.acceptingEmergency,
      beds: hospital.beds,
      blood: hospital.blood,
      departments: hospital.departments,
      diagnostics: hospital.diagnostics,
    };

    delete req.body.id;
    delete req.body._id;
    Object.assign(hospital, req.body);
    await hospital.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'hospital.update',
      entityType: 'hospital',
      entityId: hospital.id,
      before,
      after: {
        name: hospital.name,
        phone: hospital.phone,
        emergencyHelpline: hospital.emergencyHelpline,
        acceptingEmergency: hospital.acceptingEmergency,
        beds: hospital.beds,
        blood: hospital.blood,
        departments: hospital.departments,
        diagnostics: hospital.diagnostics,
      },
    });
    return ok(res, hospital);
  })
);

module.exports = router;
