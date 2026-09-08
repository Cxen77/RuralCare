/**
 * Google Gemini AI Provider Adapter
 * 
 * Supports Gemini 1.5 Flash / Pro with native functionDeclarations tool calling.
 */

const BaseProvider = require('./BaseProvider');

class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    const chosenModel = config.model || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    super({
      name: 'gemini',
      apiKey: config.apiKey || process.env.GEMINI_API_KEY || (process.env.AI_PROVIDER === 'gemini' ? process.env.AI_API_KEY : null),
      model: chosenModel,
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
        const textContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        contents.push({
          role: 'user',
          parts: [{
            text: `[Tool "${msg.name || 'tool'}" returned]: ${textContent}`
          }]
        });
      } else if (msg.role === 'assistant') {
        if (msg.raw_parts && Array.isArray(msg.raw_parts)) {
          contents.push({ role: 'model', parts: msg.raw_parts });
        } else {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content || '[Executed clinical lookup tools]' }]
          });
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
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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
            args: part.functionCall.args || {},
            thoughtSignature: part.thoughtSignature
          });
        }
      }

      return {
        content: contentText.trim(),
        tool_calls: toolCalls,
        finish_reason: candidate?.finishReason || 'STOP',
        raw_message: candidate?.content,
        raw_parts: parts,
        usage: data.usageMetadata || null
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

module.exports = GeminiProvider;
