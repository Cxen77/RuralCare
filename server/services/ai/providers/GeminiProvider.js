/**
 * Google Gemini AI Provider Adapter
 * 
 * Supports Gemini 1.5 Flash / Pro with native functionDeclarations tool calling.
 */

const BaseProvider = require('./BaseProvider');

class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'gemini',
      apiKey: config.apiKey || process.env.GEMINI_API_KEY || (process.env.AI_PROVIDER === 'gemini' ? process.env.AI_API_KEY : null),
      model: config.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
    });
  }

  async chat({ messages = [], tools = [], systemPrompt = '', temperature = 0.2, maxTokens = 600 }) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the backend.');
    }

    // Convert messages to Gemini contents structure
    const contents = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        // System instruction handled separately in Gemini
        continue;
      } else if (msg.role === 'tool') {
        // Tool execution result
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || 'tool_response',
              response: { content: msg.content }
            }
          }]
        });
      } else if (msg.role === 'assistant') {
        const parts = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            parts.push({
              functionCall: {
                name: tc.name || tc.function?.name,
                args: tc.args || (tc.function?.arguments ? (typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments) : {})
              }
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      } else {
        // User message
        contents.push({
          role: 'user',
          parts: [{ text: msg.content || '' }]
        });
      }
    }

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };

    if (systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    // Convert tools if provided
    if (Array.isArray(tools) && tools.length > 0) {
      // If tools are OpenAI format, convert to Gemini functionDeclarations
      const functionDeclarations = tools.map(t => {
        if (t.function) {
          return {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          };
        }
        return t;
      });
      payload.tools = [{ functionDeclarations }];
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let contentText = '';
      const toolCalls = [];

      for (const part of parts) {
        if (part.text) {
          contentText += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          });
        }
      }

      return {
        content: contentText.trim(),
        tool_calls: toolCalls,
        finish_reason: candidate?.finishReason || 'STOP',
        raw_message: candidate?.content,
        usage: data.usageMetadata || null
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

module.exports = GeminiProvider;
