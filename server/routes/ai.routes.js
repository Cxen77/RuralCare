const express = require('express');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { AIService } = require('../services/ai.service');

const router = express.Router();

/**
 * POST /api/ai/chat
 * Primary entry point for the autonomous tool-using AI Agent.
 * Accepts: { message, conversationId, location: { latitude, longitude } }
 * Returns rich structured response:
 * { message, intent, specialty, doctors, pharmacies, route, requiresUrgentCare, confirmationNeeded }
 */
router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const { message, conversationId, location, history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ApiError(400, 'INVALID_INPUT', 'Field "message" (non-empty string) is required.');
    }

    if (message.length > 1000) {
      throw new ApiError(400, 'MESSAGE_TOO_LONG', 'Message cannot exceed 1000 characters.');
    }

    const result = await AIService.chatTurn({
      message: message.trim(),
      conversationId,
      location,
      user: req.user || null,
      history
    });

    return ok(res, result);
  })
);

/**
 * POST /api/ai/triage
 * Backwards-compatible triage endpoint.
 */
router.post(
  '/triage',
  asyncHandler(async (req, res) => {
    const { userInput, history = [], location } = req.body;
    const text = userInput || req.body.message;

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new ApiError(400, 'INVALID_INPUT', 'Field "userInput" or "message" is required.');
    }

    const result = await AIService.chatTurn({
      message: text.trim(),
      history,
      location,
      user: req.user || null
    });

    // Provide both new structure and legacy triage fields
    return ok(res, {
      ...result,
      text: result.message,
      recommendedSpecialty: result.specialty,
      isEmergency: result.requiresUrgentCare,
      source: result.intent
    });
  })
);

module.exports = router;
