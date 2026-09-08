/**
 * OpenRouter AI Provider Adapter
 * 
 * Supports dozens of top-tier LLMs via OpenRouter's unified OpenAI-compatible API.
 */

const BaseProvider = require('./BaseProvider');

class OpenRouterProvider extends BaseProvider {
  constructor(config = {}) {
    const chosenModel = config.model || process.env.OPENROUTER_MODEL || 'inclusionai/ling-3.0-flash-sante:free';
    super({
      name: 'openrouter',
      apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || (process.env.AI_PROVIDER === 'openrouter' ? process.env.AI_API_KEY : null),
      model: chosenModel,
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1'
    });
  }

  async chat({ messages = [], tools = [], systemPrompt = '', temperature = 0.2, maxTokens = 600 }) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured on the backend.');
    }

    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    const allowedToolCallIds = new Set();
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        allowedToolCallIds.add(msg.tool_calls[0].id);
        formattedMessages.push({
          role: 'assistant',
          content: msg.content || '',
          tool_calls: [msg.tool_calls[0]]
        });
      } else if (msg.role === 'tool') {
        if (allowedToolCallIds.has(msg.tool_call_id)) {
          formattedMessages.push({
            role: 'tool',
            tool_call_id: msg.tool_call_id,
            name: msg.name,
            content: msg.content || ''
          });
        } else {
          formattedMessages.push({
            role: 'user',
            content: `[Tool ${msg.name || 'system'} observation]: ${msg.content || ''}`
          });
        }
      } else {
        formattedMessages.push({
          role: msg.role,
          content: msg.content || ''
        });
      }
    }

    const payload = {
      model: this.model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens
    };

    if (Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);

    try {
      let res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://ruralcare.health',
          'X-Title': 'RuralCare AI'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 404 && this.model !== 'meta-llama/llama-3.3-70b-instruct') {
          console.warn(`[OpenRouterProvider] Model "${this.model}" failed (${errorText.slice(0, 80)}). Retrying with "meta-llama/llama-3.3-70b-instruct"...`);
          this.model = 'meta-llama/llama-3.3-70b-instruct';
          payload.model = this.model;
          res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'HTTP-Referer': 'https://ruralcare.health',
              'X-Title': 'RuralCare AI'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
        }
        if (!res.ok) {
          const retryErr = await res.text().catch(() => '');
          throw new Error(`OpenRouter error ${res.status}: ${retryErr.slice(0, 150) || errorText.slice(0, 150)}`);
        }
      }

      clearTimeout(timeoutId);

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message || {};

      const toolCalls = (message.tool_calls || []).map(tc => ({
        id: tc.id,
        name: tc.function?.name,
        args: tc.function?.arguments ? (typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments) : {}
      }));

      return {
        content: message.content || '',
        tool_calls: toolCalls,
        finish_reason: choice?.finish_reason || 'stop',
        raw_message: message,
        usage: data.usage || null
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

module.exports = OpenRouterProvider;
