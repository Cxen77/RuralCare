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

    const before = { beds: hospital.beds, blood: hospital.blood };
    delete req.body.id;
    delete req.body._id;
    Object.assign(hospital, req.body);
    await hospital.save();

    await writeAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: 'hospital.capacity',
      entityType: 'hospital',
      entityId: hospital.id,
      before,
      after: { beds: hospital.beds, blood: hospital.blood },
    });
    return ok(res, hospital);
  })
);

module.exports = router;
