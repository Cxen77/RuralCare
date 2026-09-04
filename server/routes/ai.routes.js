const express = require('express');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// Knowledge guidelines for server-side triage fallback
const HEALTH_GUIDELINES = {
  fever: 'Rest, drink plenty of clean fluids, and take lukewarm sponge baths to reduce temperature. If fever exceeds 102°F or lasts >3 days, seek urgent consultation.',
  cough: 'Stay hydrated with warm water, avoid cold drinks, and use steam inhalation. If cough lasts >2 weeks or contains blood, rule out serious respiratory conditions.',
  stomach: 'Eat light meals (khichdi/toast), drink boiled water or ORS to prevent dehydration. If pain becomes sharp in lower right abdomen or vomiting blood occurs, seek emergency care.',
  headache: 'Rest in a quiet, dark room and stay hydrated. If sudden, severe ("worst headache of life") or with neck stiffness, seek emergency care.',
  default: 'Rest adequately, drink plenty of safe water, and consult a doctor at your local Primary Health Centre (PHC) if symptoms persist or worsen.'
};

/**
 * POST /api/ai/triage
 * Online Cloud AI triage endpoint when connectivity is available.
 */
router.post(
  '/triage',
  asyncHandler(async (req, res) => {
    const { userInput, history = [], language = 'en' } = req.body;
    if (!userInput || typeof userInput !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'userInput text is required');
    }

    const inputLower = userInput.toLowerCase();
    
    // Check emergency red flags
    const redFlags = ['chest pain', 'cannot breathe', "can't breathe", 'unconscious', 'heavy bleeding', 'severe bleeding', 'fainted'];
    const isEmergency = redFlags.some(rf => inputLower.includes(rf));

    if (isEmergency) {
      return ok(res, {
        text: '🚨 **Emergency Alert**: A critical medical emergency has been detected. Please tap the red **SOS Ambulance** button immediately or call 108.',
        isEmergency: true,
        emergencyReason: 'Severe red flag symptom detected.',
        recommendedSpecialty: 'Emergency / Critical Care',
        suggestedQuestions: ['Request 108 Ambulance', 'Nearest Hospital Emergency'],
        source: 'online_ai'
      });
    }

    // Determine symptom category & specialty
    let category = 'default';
    let specialty = 'General Medicine';

    if (inputLower.includes('fever') || inputLower.includes('bukhar') || inputLower.includes('jworo')) {
      category = 'fever';
      specialty = 'General Medicine';
    } else if (inputLower.includes('cough') || inputLower.includes('khansi') || inputLower.includes('khoki') || inputLower.includes('cold') || inputLower.includes('sore throat')) {
      category = 'cough';
      specialty = inputLower.includes('throat') ? 'ENT' : 'General Medicine';
    } else if (inputLower.includes('stomach') || inputLower.includes('pet') || inputLower.includes('belly') || inputLower.includes('abdominal')) {
      category = 'stomach';
      specialty = 'General Medicine';
    } else if (inputLower.includes('headache') || inputLower.includes('sir dard') || inputLower.includes('tauko')) {
      category = 'headache';
      specialty = 'General Medicine';
    } else if (inputLower.includes('bone') || inputLower.includes('joint') || inputLower.includes('knee') || inputLower.includes('back')) {
      specialty = 'Orthopedics';
    } else if (inputLower.includes('skin') || inputLower.includes('rash') || inputLower.includes('itch')) {
      specialty = 'Dermatology';
    } else if (inputLower.includes('eye') || inputLower.includes('aankh')) {
      specialty = 'Ophthalmology';
    } else if (inputLower.includes('tooth') || inputLower.includes('dental') || inputLower.includes('daant')) {
      specialty = 'Dentistry';
    }

    const tip = HEALTH_GUIDELINES[category] || HEALTH_GUIDELINES.default;

    return ok(res, {
      text: `Thank you for sharing your symptoms. Based on your description, here is preliminary guidance:\n\n• **Care Advice:** ${tip}\n• **Recommended Consultation:** A **${specialty}** consultation at your local PHC is recommended for an accurate clinical examination.`,
      isEmergency: false,
      recommendedSpecialty: specialty,
      suggestedQuestions: [
        'Book appointment with doctor',
        'Check medicine at pharmacy',
        'What foods should I avoid?'
      ],
      source: 'online_ai'
    });
  })
);

module.exports = router;
