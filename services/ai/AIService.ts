/**
 * RuralCare AI - Router and Provider Interface
 * 
 * HYBRID ARCHITECTURE:
 * 1. TriageStateMachine (Deterministic Code / Rules):
 *    - Tracks multi-turn triage conversation state.
 *    - Detects emergency red flags deterministically outside the LLM.
 *    - Drives targeted, symptom-specific follow-up questions (1-2 at a time).
 *    - Compiles structured clinical triage summaries for doctor handoff.
 *    - Gates doctor recommendation cards until sufficient information is collected.
 * 2. On-Device LLM (SmolLM2-360M-Instruct via llama.rn):
 *    - Natural language understanding + short 1-2 sentence phrasing.
 *    - Zero-assumption guardrails (NEVER assumes pregnancy, diabetes, or diagnoses).
 * 3. Sanitizer & Fallback:
 *    - Automatically sanitizes output and falls back to structured state responses
 *      if LLM produces unprompted hallucinations or essays.
 */

import type { PatientSymptomAssessment, AIRouterResponse } from './types';
import { ModelManager } from './ModelManager';
import { KnowledgeRetriever } from './knowledge';
import { SafetyRuleEngine } from './SafetyRuleEngine';
import { TerminologyNormalizer } from './terminology';
import { StorageService } from '../storageService';
import { TriageStateMachine } from './TriageStateMachine';
import { apiClient } from '../apiClient';

export interface AIProvider {
  processInput(userInput: string, history: { sender: string; text: string }[]): Promise<any>;
}

/**
 * Online Cloud AI Provider
 */
export class OnlineAIProvider implements AIProvider {
  async processInput(userInput: string, history: { sender: string; text: string }[]): Promise<any> {
    const res = await apiClient.aiTriage({ userInput, history });
    return { text: res.text, source: 'online_ai', recommendedSpecialty: res.recommendedSpecialty };
  }
}

/**
 * Offline On-Device AI Provider (SmolLM2-360M-Instruct via llama.rn)
 */
export class OfflineAIProvider implements AIProvider {
  async processInput(
    userInput: string,
    history: { sender: string; text: string }[],
    targetedQuestion?: string,
    stateContext?: string
  ): Promise<{ text: string; source: string }> {
    const manager = ModelManager.getInstance();
    if (manager.getStatus() !== 'MODEL_READY') {
      throw new Error('Local model not ready');
    }

    const modelName = manager.getActiveModelName();
    
    let systemPrompt = `You are RuralCare AI, an on-device clinical triage assistant for rural India.
${stateContext || ''}
Rules:
- Respond strictly in 1 to 2 short sentences.
- NEVER assume or mention conditions not stated by the user (never mention pregnancy, pre-eclampsia, diabetes, or diagnoses).
- Ask the patient this exact follow-up question politely: "${targetedQuestion || 'How long have you had these symptoms?'}"
- Do not output disclaimers, apologies, or long essays.`;
    
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (only prior messages before the current one)
    const priorHistory = history.slice(0, -1).slice(-3);
    for (const msg of priorHistory) {
      const role = msg.sender === 'user' ? 'user' : 'assistant';
      messages.push({ role, content: msg.text });
    }

    // Add current user message
    messages.push({ role: 'user', content: userInput });

    console.log(`[OfflineAI] Sending ${messages.length} messages to ${modelName}.`);
    
    let text = await manager.generateChatCompletion(messages, {
      temperature: 0.5,
      n_predict: 80,
      stop: ['<|im_end|>', '<|endoftext|>', '\n\n\n'],
    });

    // Sanitize any hallucinations
    text = TriageStateMachine.sanitizeOutput(text, userInput);
    return { text, source: 'offline_ai' };
  }
}

/**
 * Validate LLM output quality. Returns true if the response is usable.
 */
function isLlmResponseUsable(text: string, userInput: string): boolean {
  if (!text || text.trim().length < 10) return false;
  
  const lower = text.toLowerCase();
  
  // Reject if it's mostly repetitive apologies
  const sorryCount = (lower.match(/\b(sorry|apologize|apolog|i'm sorry|i am sorry)\b/g) || []).length;
  if (sorryCount >= 2) return false;
  
  // Reject if it unpromptedly hallucinates pregnancy when user did not mention it
  if (!/\b(pregnant|pregnancy)\b/i.test(userInput) && /\b(pregnancy|pregnant|pre-eclampsia)\b/i.test(lower)) {
    return false;
  }

  // Reject generic deflections
  if (/^(i('m| am) (sorry|not sure|unable)|unfortunately|i cannot|i can't)/i.test(lower.trim())) return false;
  
  return true;
}

/**
 * The Main AI Router Service — Hybrid Rule-Engine-First Architecture
 */
export class AIService {
  private static onlineProvider = new OnlineAIProvider();
  private static offlineProvider = new OfflineAIProvider();

  public static async processPatientMessage(
    userInput: string,
    history: { sender: string; text: string }[],
    targetMode: 'auto' | 'online' | 'offline' = 'auto'
  ): Promise<AIRouterResponse> {
    
    // 1. Process turn through deterministic TriageStateMachine
    const triageResult = TriageStateMachine.processTurn(userInput, history);
    const state = TriageStateMachine.getState();

    // 2. Comprehensive Dev Logging (9 items requested)
    console.log('[AIService] === DEV TRIAGE LOG ===');
    console.log('1. User message:', userInput);
    console.log('2. Detected category:', state.category || 'general / casual');
    console.log('3. Current triage state:', state.stage, `(Turn ${state.turnCount})`);
    console.log('4. Questions asked:', state.questionsAsked);
    console.log('5. Collected information:', {
      complaint: state.chiefComplaint,
      location: state.bodyLocation,
      mechanism: state.injuryMechanism,
      duration: state.duration,
      severity: state.severity,
      swelling: state.swelling,
      walking: state.difficultyWalking,
      breathing: state.difficultyBreathing,
    });
    console.log('6. Red flags detected:', state.otherRedFlags);
    console.log('7. Final urgency:', triageResult.isEmergency ? 'EMERGENCY' : state.urgency);
    console.log('8. Doctor category selected:', triageResult.recommendedSpecialty);
    console.log('9. Doctor match ready:', triageResult.readyForDoctorMatch);
    console.log('==================================');

    // If emergency or greeting/meta, return immediately without local LLM variance
    if (triageResult.isEmergency || !state.chiefComplaint) {
      return triageResult;
    }

    const isOnline = targetMode === 'online' ? true : targetMode === 'offline' ? false : StorageService.getOnlineStatus();

    let responseText = triageResult.text;
    let source = triageResult.assessment.source || 'rule_engine';

    try {
      if (targetMode === 'online' || (targetMode === 'auto' && isOnline)) {
        // ── ONLINE MODE ──
        try {
          const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Online timeout')), 4000));
          const res = await Promise.race([
             this.onlineProvider.processInput(userInput, history),
             timeoutPromise
          ]);
          responseText = res.text;
          source = 'online_ai';
        } catch {
          if (targetMode === 'online') {
            responseText = `⚠️ *[Cloud AI Unavailable — Using Local Triage]*\n\n${triageResult.text}`;
            source = 'rule_engine';
          } else {
            // Fallback to local hybrid
            source = 'offline_ai';
          }
        }
      } else {
        // ── OFFLINE MODE (Hybrid State Machine + LLM Phrasing) ──
        const manager = ModelManager.getInstance();
        if (manager.getStatus() === 'MODEL_READY') {
          try {
            const stateContext = `Chief Complaint: ${state.chiefComplaint || 'none'}, Category: ${state.category || 'none'}, Stage: ${state.stage}`;
            const llmRes = await this.offlineProvider.processInput(userInput, history, triageResult.text, stateContext);
            if (isLlmResponseUsable(llmRes.text, userInput)) {
              responseText = llmRes.text;
              source = 'offline_ai';
            }
          } catch (llmErr) {
            console.log('[AIService] LLM phrasing fallback to state machine text:', llmErr);
            source = 'offline_ai';
          }
        }
      }
    } catch {
      source = 'rule_engine';
    }

    return {
      ...triageResult,
      text: responseText,
      assessment: {
        ...triageResult.assessment,
        source: source as any,
      },
    };
  }
}
