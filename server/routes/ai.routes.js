const express = require('express');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { AIService } = require('../services/ai.service');
const Conversation = require('../models/Conversation');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function handleAiError(err) {
  if (err instanceof ApiError) return err;
  const msg = err.message || '';
  if (err.name === 'AbortError' || msg.includes('timeout') || msg.includes('TIMEDOUT') || msg.includes('Connect Timeout')) {
    return new ApiError(504, 'AI_TIMEOUT', 'The AI service timed out while processing your request. Please try again.');
  }
  if (msg.includes('not configured') || msg.includes('API_KEY')) {
    return new ApiError(500, 'AI_CONFIGURATION_ERROR', 'AI provider is not configured properly.');
  }
  if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('503') || msg.includes('UND_ERR')) {
    return new ApiError(503, 'AI_PROVIDER_UNAVAILABLE', 'AI provider is temporarily unavailable. Please try again in a moment.');
  }
  return new ApiError(500, 'AI_INTERNAL_ERROR', 'An error occurred while generating AI response.');
}

/**
 * POST /api/ai/chat
 * Primary entry point for the autonomous tool-using AI Agent.
 * Accepts: { message, conversationId, location: { latitude, longitude } }
 * Returns rich structured response:
 * { message, intent, specialty, doctors, pharmacies, route, requiresUrgentCare, confirmationNeeded }
 */
router.post(
  '/chat',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { message, conversationId, location, history = [], patientId } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ApiError(400, 'INVALID_INPUT', 'Field "message" (non-empty string) is required.');
    }

    if (message.length > 1000) {
      throw new ApiError(400, 'MESSAGE_TOO_LONG', 'Message cannot exceed 1000 characters.');
    }

    try {
      const user = req.user || (patientId ? { patientId } : null);
      const result = await AIService.chatTurn({
        message: message.trim(),
        conversationId,
        location,
        user,
        history
      });

      return ok(res, result);
    } catch (err) {
      console.error('[AI CHAT ERROR]', err.message);
      throw handleAiError(err);
    }
  })
);

/**
 * POST /api/ai/triage
 * Backwards-compatible triage endpoint.
 */
router.post(
  '/triage',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { userInput, history = [], location, patientId } = req.body || {};
    const text = userInput || req.body?.message;

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new ApiError(400, 'INVALID_INPUT', 'Field "userInput" or "message" is required.');
    }

    try {
      const user = req.user || (patientId ? { patientId } : null);
      const result = await AIService.chatTurn({
        message: text.trim(),
        history,
        location,
        user
      });

      // Provide both new structure and legacy triage fields
      return ok(res, {
        ...result,
        text: result.message,
        recommendedSpecialty: result.specialty,
        isEmergency: result.requiresUrgentCare,
        source: result.intent
      });
    } catch (err) {
      console.error('[AI TRIAGE ERROR]', err.message);
      throw handleAiError(err);
    }
  })
);

// ── AI Conversation History ────────────────────────────────────────────

/**
 * GET /api/ai/conversations
 * List past AI conversations for the authenticated patient.
 */
router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = req.user.patientId || req.user.sub;
    if (!patientId) {
      throw new ApiError(400, 'MISSING_PATIENT_ID', 'Cannot determine patient identity from token.');
    }

    const conversations = await Conversation.find({ patientId })
      .sort({ lastActive: -1 })
      .select('conversationId title messages lastActive createdAt')
      .lean();

    const list = conversations.map(c => ({
      conversationId: c.conversationId,
      title: c.title || 'Untitled Conversation',
      messageCount: (c.messages || []).length,
      lastActive: c.lastActive,
      createdAt: c.createdAt,
    }));

    return ok(res, list);
  })
);

/**
 * GET /api/ai/conversations/:id
 * Get a single conversation with full messages. Ownership enforced.
 */
router.get(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = req.user.patientId || req.user.sub;
    const conv = await Conversation.findOne({ conversationId: req.params.id }).lean();
    if (!conv) {
      throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.');
    }
    if (conv.patientId !== patientId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this conversation.');
    }
    return ok(res, {
      conversationId: conv.conversationId,
      title: conv.title || 'Untitled Conversation',
      messages: conv.messages || [],
      context: conv.context,
      lastActive: conv.lastActive,
      createdAt: conv.createdAt,
    });
  })
);

/**
 * DELETE /api/ai/conversations/:id
 * Delete a conversation. Ownership enforced.
 */
router.delete(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = req.user.patientId || req.user.sub;
    const conv = await Conversation.findOne({ conversationId: req.params.id });
    if (!conv) {
      throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.');
    }
    if (conv.patientId !== patientId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this conversation.');
    }
    await conv.deleteOne();
    return ok(res, { deleted: true });
  })
);

module.exports = router;
