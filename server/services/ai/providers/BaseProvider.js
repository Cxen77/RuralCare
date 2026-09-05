/**
 * Base AI Provider
 * 
 * Abstract interface for all RuralCare LLM provider adapters.
 */

class BaseProvider {
  constructor(config = {}) {
    this.name = config.name || 'base';
    this.apiKey = config.apiKey || null;
    this.model = config.model || null;
    this.baseUrl = config.baseUrl || null;
  }

  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Executes a chat turn with optional tool calling.
   * Returns standardized:
   * {
   *   content: string,
   *   tool_calls: [{ id, name, args }],
   *   finish_reason: string,
   *   usage: { prompt_tokens, completion_tokens }
   * }
   */
  async chat({ messages = [], tools = [], systemPrompt = '', temperature = 0.3, maxTokens = 400 }) {
    throw new Error('chat() must be implemented by subclass');
  }
}

module.exports = BaseProvider;
