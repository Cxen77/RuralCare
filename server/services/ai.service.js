/**
 * RuralCare Backend AI Service
 * 
 * Public facade unifying:
 * 1. Autonomous tool-using AI Agent (`AIAgent`)
 * 2. Triage analysis endpoint (`analyzeTriage`)
 * 3. Provider abstraction and fallback
 */

const AIAgent = require('./ai/AIAgent');
const { ToolRegistry } = require('./ai/tools/toolRegistry');

class AIService {
  /**
   * Main entry point for conversational tool-using agent requests.
   */
  static async chatTurn({
    message,
    conversationId,
    location,
    user = null,
    history = []
  }) {
    return AIAgent.runChatTurn({
      message,
      conversationId,
      location,
      user,
      history
    });
  }

  /**
   * Backwards-compatible triage endpoint.
   */
  static async analyzeTriage({ userInput, history = [], language = 'en', user = null, location = null }) {
    return AIAgent.runChatTurn({
      message: userInput,
      history,
      location,
      user
    });
  }

  /**
   * General tool execution helper.
   */
  static async executeTool(toolName, args, context) {
    return ToolRegistry.executeTool(toolName, args, context);
  }
}

module.exports = {
  AIService
};
