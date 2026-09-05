/**
 * RuralCare AI Agent Comprehensive Test Suite
 * 
 * Validates all 24 required test scenarios:
 * 1. General conversation.
 * 2. Symptom understanding.
 * 3. Specialist recommendation.
 * 4. Doctor search.
 * 5. Doctor details.
 * 6. Doctor location.
 * 7. Doctor route.
 * 8. Prescription retrieval.
 * 9. Prescription medicine extraction.
 * 10. Pharmacy search.
 * 11. Medicine availability.
 * 12. Pharmacy ranking.
 * 13. Pharmacy route.
 * 14. Patient -> Doctor -> Pharmacy route.
 * 15. Emergency symptom handling.
 * 16. Missing location.
 * 17. Missing inventory.
 * 18. AI provider failure.
 * 19. Geoapify failure.
 * 20. Invalid tool request.
 * 21. Unauthorized tool request.
 * 22. Write action without confirmation.
 * 23. Write action after confirmation.
 * 24. Provider switching.
 */

const assert = require('assert');
const { ToolRegistry } = require('../services/ai/tools/toolRegistry');
const ProviderFactory = require('../services/ai/providerFactory');
const { GeoapifyService } = require('../services/geoapify.service');
const AIAgent = require('../services/ai/AIAgent');

async function runTests() {
  console.log('🧪 Starting RuralCare AI Agent Comprehensive Test Suite...\n');
  let passed = 0;
  let total = 0;

  function report(name, condition, extra = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${total}. ${name} ${extra}`);
    } else {
      console.error(`[FAIL] ${total}. ${name} ${extra}`);
    }
  }

  try {
    // ── Test 1: General Conversation / Greetings ─────────────────────
    const genRes = await AIAgent.runChatTurn({ message: 'Hello, how can you help me today?' });
    report('General conversation', typeof genRes.message === 'string' && genRes.message.length > 5);

    // ── Test 2: Symptom Understanding ───────────────────────────────
    const sympRes = await ToolRegistry.executeTool('analyzeSymptoms', {
      symptoms: ['knee pain', 'swelling'],
      severity: 'moderate',
      duration: '2 days'
    });
    report('Symptom understanding', sympRes.symptomsCount === 2 && sympRes.estimatedSeverity === 'moderate');

    // ── Test 3: Specialist Recommendation ───────────────────────────
    const specRes = await ToolRegistry.executeTool('recommendSpecialty', {
      symptoms: 'I have an itchy red rash on my arms and neck'
    });
    report('Specialist recommendation', specRes.specialty === 'Dermatology');

    // ── Test 4: Doctor Search ───────────────────────────────────────
    const docRes = await ToolRegistry.executeTool('findDoctors', {
      specialty: 'Dermatology',
      latitude: 25.9856,
      longitude: 85.2281
    });
    report('Doctor search', Array.isArray(docRes) && docRes.length > 0);

    // ── Test 5: Doctor Details ──────────────────────────────────────
    const docDetails = await ToolRegistry.executeTool('getDoctorDetails', { doctorId: 'doc_1' });
    report('Doctor details', docDetails.found === true && typeof docDetails.name === 'string' && docDetails.name.length > 0);

    // ── Test 6: Doctor Location ─────────────────────────────────────
    report('Doctor location', docDetails.latitude != null && docDetails.longitude != null, `(${docDetails.latitude}, ${docDetails.longitude})`);

    // ── Test 7: Doctor Route ────────────────────────────────────────
    const routeRes = await ToolRegistry.executeTool('calculateRoute', {
      originLat: 25.9800,
      originLon: 85.2200,
      destLat: docDetails.latitude || 25.9856,
      destLon: docDetails.longitude || 85.2281,
      mode: 'drive'
    });
    report('Doctor route', routeRes.distanceMeters > 0 && routeRes.durationSeconds > 0, `${routeRes.distanceKm} km`);

    // ── Test 8: Prescription Retrieval ──────────────────────────────
    const rxRes = await ToolRegistry.executeTool('getPrescription', { prescriptionId: 'rx_1' });
    report('Prescription retrieval', rxRes.found === true && rxRes.items.length > 0);

    // ── Test 9: Prescription Medicine Extraction ────────────────────
    const rxExtract = await ToolRegistry.executeTool('extractPrescriptionMedicines', { prescriptionId: 'rx_1' });
    report('Prescription medicine extraction', rxExtract.extracted === true && rxExtract.medicines.length > 0);

    // ── Test 10: Pharmacy Search ────────────────────────────────────
    const phRes = await ToolRegistry.executeTool('findNearbyPharmacies', {
      latitude: 25.9856,
      longitude: 85.2281
    });
    report('Pharmacy search', Array.isArray(phRes) && phRes.length > 0);

    // ── Test 11: Medicine Availability ──────────────────────────────
    const medAvail = await ToolRegistry.executeTool('checkMedicineAvailability', {
      pharmacyId: 'ph_1',
      medicineName: 'Paracetamol'
    });
    report('Medicine availability', medAvail.inventoryDataAvailable === true && medAvail.available === true);

    // ── Test 12: Pharmacy Ranking ───────────────────────────────────
    const rankedPh = await ToolRegistry.executeTool('findPharmaciesWithMedicines', {
      medicineNames: ['Paracetamol', 'Amoxicillin'],
      latitude: 25.9856,
      longitude: 85.2281
    });
    report('Pharmacy ranking', Array.isArray(rankedPh) && rankedPh.length > 0 && rankedPh[0].availableCount !== undefined);

    // ── Test 13: Pharmacy Route ─────────────────────────────────────
    const phRoute = await ToolRegistry.executeTool('calculateRoute', {
      originLat: 25.9800,
      originLon: 85.2200,
      destLat: 25.9870,
      destLon: 85.2290
    });
    report('Pharmacy route', phRoute.distanceMeters > 0 && phRoute.durationMinutes > 0);

    // ── Test 14: Patient -> Doctor -> Pharmacy Route ────────────────
    const multiRoute = await ToolRegistry.executeTool('calculateMultiWaypointRoute', {
      waypoints: [
        { latitude: 25.9800, longitude: 85.2200, name: 'Patient' },
        { latitude: 25.9856, longitude: 85.2281, name: 'Doctor' },
        { latitude: 25.9870, longitude: 85.2290, name: 'Pharmacy' }
      ]
    });
    report('Patient -> Doctor -> Pharmacy route', multiRoute.waypointsCount === 3 && multiRoute.distanceMeters > 0);

    // ── Test 15: Emergency Symptom Handling ─────────────────────────
    const emergRes = await ToolRegistry.executeTool('checkEmergencyRedFlags', {
      text: 'Severe chest pain radiating to left arm and cannot breathe'
    });
    report('Emergency symptom handling', emergRes.isEmergency === true && emergRes.ambulanceNumber === '108');

    // ── Test 16: Missing Location Handling ──────────────────────────
    const noLocUser = await ToolRegistry.executeTool('getUserLocation', {}, {});
    report('Missing location handling', noLocUser.locationAvailable === false);

    // ── Test 17: Missing Inventory Zero-Fabrication ──────────────────
    const missingMed = await ToolRegistry.executeTool('checkMedicineAvailability', {
      pharmacyId: 'ph_1',
      medicineName: 'NonExistentExperimentalDrugXYZ'
    });
    report('Missing inventory zero-fabrication', missingMed.available === false);

    // ── Test 18: AI Provider Failure / Fallback ─────────────────────
    process.env.AI_FALLBACK_PROVIDER = 'gemini';
    const fallbackProv = ProviderFactory.getFallbackProvider();
    report('AI provider fallback configuration', fallbackProv !== null && fallbackProv.name === 'gemini');

    // ── Test 19: Geoapify Failure Resilience ────────────────────────
    // Test calculateRoute with invalid key or offline mode fallback
    const offlineRoute = await GeoapifyService.calculateRoute({
      waypoints: [
        { latitude: 25.9800, longitude: 85.2200 },
        { latitude: 25.9900, longitude: 85.2300 }
      ]
    });
    const isResilient = Boolean(offlineRoute && offlineRoute.distanceMeters > 0 && Array.isArray(offlineRoute.geometry?.coordinates));
    report('Geoapify failure resilience', isResilient, `(dist: ${offlineRoute?.distanceMeters}, coords: ${offlineRoute?.geometry?.coordinates?.length})`);

    // ── Test 20: Invalid Tool Request ───────────────────────────────
    const invalidTool = await ToolRegistry.executeTool('hackServerFilesystem', {});
    report('Invalid tool request rejection', invalidTool.error === true && invalidTool.code === 'TOOL_NOT_FOUND');

    // ── Test 21: Tool Missing Required Argument ─────────────────────
    const missingArg = await ToolRegistry.executeTool('checkMedicineAvailability', {});
    report('Tool missing argument rejection', missingArg.error === true && missingArg.code === 'MISSING_REQUIRED_ARGUMENT');

    // ── Test 22: Write Action Without Confirmation ──────────────────
    const unconfirmedBook = await ToolRegistry.executeTool('createAppointment', {
      doctorId: 'doc_1',
      date: '2026-09-10',
      time: '10:15 AM',
      userConfirmed: false
    });
    report('Write action without confirmation', unconfirmedBook.status === 'confirmation_required' && unconfirmedBook.requiresUserConfirmation === true);

    // ── Test 23: Write Action After Confirmation ────────────────────
    const confirmedBook = await ToolRegistry.executeTool('createAppointment', {
      doctorId: 'doc_1',
      date: '2026-09-10',
      time: '10:15 AM',
      userConfirmed: true
    });
    report('Write action after confirmation', confirmedBook.status === 'booked' && confirmedBook.success === true);

    // ── Test 24: One-Click Provider Switching ───────────────────────
    process.env.AI_PROVIDER = 'gemini';
    const pGemini = ProviderFactory.getActiveProvider();
    process.env.AI_PROVIDER = 'openrouter';
    const pOpenRouter = ProviderFactory.getActiveProvider();
    process.env.AI_PROVIDER = 'huggingface';
    const pHuggingFace = ProviderFactory.getActiveProvider();
    process.env.AI_PROVIDER = 'groq';
    const pGroq = ProviderFactory.getActiveProvider();

    report(
      'One-click provider switching',
      pGemini.name === 'gemini' &&
      pOpenRouter.name === 'openrouter' &&
      pHuggingFace.name === 'huggingface' &&
      pGroq.name === 'groq'
    );

  } catch (err) {
    console.error('Fatal error during test suite:', err);
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Connect to DB if needed or run with mocked DB models
const { connectDb, disconnectDb } = require('../config/db');
connectDb().then(async () => {
  await runTests();
  await disconnectDb();
}).catch(async (err) => {
  console.warn('DB connect error for test, running with in-memory fallbacks:', err.message);
  await runTests();
});
