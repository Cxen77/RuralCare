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
const APInexProvider = require('./providers/APInexProvider');

class ProviderFactory {
  static createProvider(name) {
    const normalized = (name || '').toLowerCase().trim();

    switch (normalized) {
      case 'apinex':
        return new APInexProvider();
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
        if (process.env.OPENROUTER_API_KEY) return new OpenRouterProvider();
        if (process.env.GROQ_API_KEY) return new GroqProvider();
        if (process.env.APINEX_API_KEY) return new APInexProvider();
        if (process.env.HUGGINGFACE_API_KEY) return new HuggingFaceProvider();
        return new OpenRouterProvider();
    }
  }

  static getProviderChain() {
    const openrouter = new OpenRouterProvider();
    const groq = new GroqProvider();
    const apinex = new APInexProvider();

    // Priority order: 1st OpenRouter (ling-3.0-flash-sante:free) -> 2nd Groq -> 3rd APInex
    const chain = [openrouter, groq, apinex];

    // If an explicit AI_PROVIDER is set, elevate it to first
    const primaryName = (process.env.AI_PROVIDER || '').toLowerCase().trim();
    if (primaryName && primaryName !== 'openrouter') {
      const idx = chain.findIndex(p => p.name === primaryName);
      if (idx > 0) {
        const [elevated] = chain.splice(idx, 1);
        chain.unshift(elevated);
      }
    }

    const configured = chain.filter(p => p.isConfigured());
    return configured.length > 0 ? configured : [openrouter];
  }

  static getActiveProvider() {
    return this.getProviderChain()[0];
  }

  static getFallbackProvider() {
    const chain = this.getProviderChain();
    return chain.length > 1 ? chain[1] : null;
  }
}

module.exports = ProviderFactory;
