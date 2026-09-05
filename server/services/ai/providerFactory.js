/**
 * AI Provider Factory
 * 
 * Selects and instantiates the active and fallback AI providers based on:
 * - AI_PROVIDER (groq, gemini, openrouter, huggingface)
 * - AI_FALLBACK_PROVIDER (optional)
 * Allows hot-swapping providers with a single environment variable change.
 */

const GroqProvider = require('./providers/GroqProvider');
const GeminiProvider = require('./providers/GeminiProvider');
const OpenRouterProvider = require('./providers/OpenRouterProvider');
const HuggingFaceProvider = require('./providers/HuggingFaceProvider');

class ProviderFactory {
  static createProvider(name) {
    const normalized = (name || '').toLowerCase().trim();

    switch (normalized) {
      case 'groq':
        return new GroqProvider();
      case 'gemini':
      case 'google':
        return new GeminiProvider();
      case 'openrouter':
        return new OpenRouterProvider();
      case 'huggingface':
      case 'hf':
        return new HuggingFaceProvider();
      default:
        // Default to Groq if key exists, otherwise Gemini, otherwise OpenRouter
        if (process.env.GROQ_API_KEY) return new GroqProvider();
        if (process.env.GEMINI_API_KEY) return new GeminiProvider();
        if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider();
        if (process.env.HUGGINGFACE_API_KEY) return new HuggingFaceProvider();
        // Fallback default
        return new GroqProvider();
    }
  }

  static getActiveProvider() {
    const requested = process.env.AI_PROVIDER || 'groq';
    return this.createProvider(requested);
  }

  static getFallbackProvider() {
    const fallbackName = process.env.AI_FALLBACK_PROVIDER;
    if (!fallbackName) return null;
    return this.createProvider(fallbackName);
  }
}

module.exports = ProviderFactory;
