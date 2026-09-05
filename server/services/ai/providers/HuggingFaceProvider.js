/**
 * Hugging Face AI Provider Adapter
 * 
 * Interacts with Hugging Face Serverless Inference / Router.
 */

const BaseProvider = require('./BaseProvider');

class HuggingFaceProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'huggingface',
      apiKey: config.apiKey || process.env.HUGGINGFACE_API_KEY || (process.env.AI_PROVIDER === 'huggingface' ? process.env.AI_API_KEY : null),
      model: config.model || process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.3-70B-Instruct',
      baseUrl: config.baseUrl || 'https://router.huggingface.co/hf-inference/v1'
    });
  }

  async chat({ messages = [], tools = [], systemPrompt = '', temperature = 0.2, maxTokens = 600 }) {
    if (!this.apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is not configured on the backend.');
    }

    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role,
        content: msg.content || '',
        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
        ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
        ...(msg.name ? { name: msg.name } : {})
      });
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
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`HuggingFace error ${res.status}: ${errorText.slice(0, 150)}`);
      }

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

module.exports = HuggingFaceProvider;
