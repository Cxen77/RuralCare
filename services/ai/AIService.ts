/**
 * RuralCare AI - Router and Provider Interface
 * 
 * SECURE SERVER-SIDE & DETERMINISTIC OFFLINE ARCHITECTURE:
 * 1. TriageStateMachine (Deterministic Rules / State Machine):
 *    - Tracks multi-turn triage conversation state locally.
 *    - Detects emergency red flags deterministically.
 *    - Drives targeted, symptom-specific follow-up questions.
 *    - Compiles structured clinical triage summaries for doctor handoff.
 *    - Gates doctor recommendation cards until sufficient information is collected.
 * 2. Online Server-Side AI Provider:
 *    - Calls RuralCare Express backend (/api/ai/triage) which communicates with
 *      the medical LLM API safely with backend-held API keys.
 * 3. Offline Triage Engine:
 *    - Uses deterministic clinical state machine & safety rules when offline
 *      without requiring local native C++ compilation or heavy model downloads.
 */

import type { PatientSymptomAssessment, AIRouterResponse } from './types';
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
 * Online Cloud AI Provider (Calls RuralCare Backend)
 */
export class OnlineAIProvider implements AIProvider {
  async processInput(userInput: string, history: { sender: string; text: string }[], location?: { latitude: number; longitude: number }, conversationId?: string): Promise<any> {
    const startTime = Date.now();
    const targetUrl = `${apiClient.getActiveBaseUrl?.() || 'https://ruralcare-sia2.onrender.com'}/api/ai/chat`;
    console.log(`[AI DEBUG] mode=online url=${targetUrl} requestStarted=${new Date(startTime).toISOString()}`);

    try {
      const res = await apiClient.aiChat({ message: userInput, history, location, conversationId });
      const duration = Date.now() - startTime;
      console.log(`[AI DEBUG] mode=online url=${targetUrl} responseStatus=200 responseTime=${duration}ms responseBodyKeys=${Object.keys(res || {}).join(',')}`);
      return {
        text: res.message || res.text,
        source: 'online_ai',
        recommendedSpecialty: res.specialty || res.recommendedSpecialty,
        suggestedQuestions: res.suggestedQuestions || ['Find doctor nearby', 'Check pharmacy stock', 'What should I avoid?'],
        isEmergency: !!res.requiresUrgentCare || !!res.isEmergency,
        doctors: res.doctors,
        pharmacies: res.pharmacies,
        route: res.route,
        confirmationNeeded: res.confirmationNeeded,
        intent: res.intent,
        conversationId: res.conversationId,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.log(`[AI DEBUG] mode=online url=${targetUrl} responseStatus=${err?.status || 'network_error'} responseTime=${duration}ms errorName=${err?.name || 'Error'} errorMessage=${err?.message || 'Unknown'}`);
      throw err;
    }
  }
}

/**
 * Offline Clinical Triage Provider (Deterministic State Machine & Rules)
 */
export class OfflineAIProvider implements AIProvider {
  async processInput(
    userInput: string,
    history: { sender: string; text: string }[],
    targetedQuestion?: string,
    stateContext?: string
  ): Promise<{ text: string; source: string }> {
    const state = TriageStateMachine.getState();
    const text = targetedQuestion || `Please share more about what you are experiencing. For example, how long have you had this issue?`;
    return { text, source: 'offline_ai' };
  }
}

/**
 * The Main AI Router Service — Hybrid Server-Side AI + Deterministic Fallback
 */
export class AIService {
  private static onlineProvider = new OnlineAIProvider();
  private static offlineProvider = new OfflineAIProvider();

  public static async processPatientMessage(
    userInput: string,
    history: { sender: string; text: string }[],
    targetMode: 'auto' | 'online' | 'offline' = 'auto',
    location?: { latitude: number; longitude: number },
    conversationId?: string
  ): Promise<AIRouterResponse> {
    
    // 1. Process turn through deterministic TriageStateMachine
    const triageResult = TriageStateMachine.processTurn(userInput, history);
    const state = TriageStateMachine.getState();

    // 2. Comprehensive Dev Logging
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

    const isOnline = targetMode === 'online' ? true : targetMode === 'offline' ? false : StorageService.getOnlineStatus();

    let responseText = triageResult.text;
    let source = triageResult.assessment.source || 'rule_engine';
    let onlineData: any = null;

    // In offline mode, if emergency was detected, return immediately
    if (targetMode === 'offline' && triageResult.isEmergency) {
      return triageResult;
    }

    try {
      if (targetMode === 'online' || (targetMode === 'auto' && isOnline)) {
        // ── ONLINE MODE (Calls RuralCare Express Backend) ──
        let timer: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Online timeout')), 38000);
        });
        try {
          const res = await Promise.race([
             this.onlineProvider.processInput(userInput, history, location, conversationId),
             timeoutPromise
          ]);
          clearTimeout(timer);
          responseText = res.text;
          source = 'online_ai';
          onlineData = res;
        } catch (onlineErr) {
          clearTimeout(timer);
          console.warn('[AIService] Online AI request failed, falling back to local engine:', onlineErr);
          if (targetMode === 'online') {
            responseText = `⚠️ *[Cloud AI Unavailable — Using Offline Triage]*\n\n${triageResult.text}`;
            source = 'rule_engine';
          } else {
            // Fallback to local offline state machine
            source = 'offline_ai';
          }
        }
      } else {
        // ── OFFLINE MODE (Deterministic State Machine Guidance) ──
        const offlineRes = await this.offlineProvider.processInput(userInput, history, triageResult.text);
        responseText = offlineRes.text;
        source = 'offline_ai';
      }
    } catch {
      source = 'rule_engine';
    }

    return {
      ...triageResult,
      text: responseText,
      doctors: (onlineData?.doctors && onlineData.doctors.length > 0) ? onlineData.doctors : (triageResult.readyForDoctorMatch ? triageResult.doctors : undefined),
      pharmacies: (onlineData?.pharmacies && onlineData.pharmacies.length > 0) ? onlineData.pharmacies : undefined,
      route: onlineData?.route || undefined,
      confirmationNeeded: onlineData?.confirmationNeeded || undefined,
      intent: onlineData?.intent || undefined,
      isEmergency: onlineData?.isEmergency !== undefined ? onlineData.isEmergency : triageResult.isEmergency,
      suggestedQuestions: onlineData?.suggestedQuestions?.length ? onlineData.suggestedQuestions : triageResult.suggestedQuestions,
      assessment: {
        ...triageResult.assessment,
        source: source as any,
      },
      conversationId: onlineData?.conversationId || conversationId,
    };
  }
}
