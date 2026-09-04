/**
 * RuralCare AI - Deterministic Triage Conversation State Machine
 *
 * Implements a lightweight multi-turn clinical triage state engine:
 * 1. Understands patient symptoms & categories.
 * 2. Deterministically checks for emergency red flags outside the LLM.
 * 3. Asks 1-2 targeted follow-up questions (never flooding the user).
 * 4. Tracks chief complaint, mechanism, location, duration, severity, and functional flags.
 * 5. Generates structured triage summaries and recommends real doctors from local PHC.
 * 6. Strictly forbids hallucinated assumptions (no assuming pregnancy, diabetes, etc.).
 */

import { TerminologyNormalizer, MEDICAL_TERMINOLOGY } from './terminology';
import type { PatientSymptomAssessment, StructuredTriageSummary, AIRouterResponse } from './types';
import type { UrgencyLevel } from '../../types/schema';
import { KnowledgeRetriever } from './knowledge';

export type TriageCategory =
  | 'fever_respiratory'
  | 'headache'
  | 'limb_injury'
  | 'abdominal'
  | 'chest_cardio'
  | 'skin'
  | 'eye_ent'
  | 'general';

export interface TriageState {
  chiefComplaint: string | null;
  category: TriageCategory | null;
  bodyLocation: string | null;
  duration: string | null;
  severity: string | null; // e.g. "7/10", "severe", "mild"
  injuryMechanism: string | null; // e.g. "fall", "cut", "hit", "twist"
  fever: boolean | string | null;
  bleeding: boolean | null;
  swelling: boolean | null;
  difficultyBreathing: boolean | null;
  difficultyWalking: boolean | null;
  otherRedFlags: string[];
  questionsAsked: string[];
  collectedAnswers: Record<string, string>;
  turnCount: number;
  stage: 'initial' | 'asking_followup_1' | 'asking_followup_2' | 'summary_ready' | 'emergency';
  urgency: UrgencyLevel | 'emergency';
  recommendedSpecialty: string;
  isComplete: boolean;
  readyForDoctorMatch: boolean;
  language: 'en' | 'hi' | 'ne';
  homeCareTip?: string;
}

const INITIAL_TRIAGE_STATE: TriageState = {
  chiefComplaint: null,
  category: null,
  bodyLocation: null,
  duration: null,
  severity: null,
  injuryMechanism: null,
  fever: null,
  bleeding: null,
  swelling: null,
  difficultyBreathing: null,
  difficultyWalking: null,
  otherRedFlags: [],
  questionsAsked: [],
  collectedAnswers: {},
  turnCount: 0,
  stage: 'initial',
  urgency: 'routine',
  recommendedSpecialty: 'General Medicine',
  isComplete: false,
  readyForDoctorMatch: false,
  language: 'en',
};

export class TriageStateMachine {
  private static currentState: TriageState = { ...INITIAL_TRIAGE_STATE };

  /**
   * Reset conversation state completely (e.g. on Reset button click)
   */
  public static reset(): void {
    TriageStateMachine.currentState = { ...INITIAL_TRIAGE_STATE, otherRedFlags: [], questionsAsked: [], collectedAnswers: {} };
    console.log('[TriageStateMachine] 🔄 Triage state reset to initial.');
  }

  /**
   * Get current triage state snapshot
   */
  public static getState(): TriageState {
    return { ...TriageStateMachine.currentState };
  }

  /**
   * Main entry point to process a turn in the triage conversation.
   */
  public static processTurn(
    userInput: string,
    history: { sender: string; text: string }[]
  ): AIRouterResponse {
    const text = userInput.trim();
    const cleanLower = text.toLowerCase();
    const state = TriageStateMachine.currentState;
    state.turnCount += 1;

    // Detect language
    const lang = TriageStateMachine.detectLanguage(text);
    state.language = lang;

    // ─── 1. DETERMINISTIC EMERGENCY CHECK ─────────────────────────────────────
    const emergencyCheck = TriageStateMachine.checkEmergencyRedFlags(text, history);
    if (emergencyCheck.isEmergency) {
      state.stage = 'emergency';
      state.urgency = 'emergency';
      state.readyForDoctorMatch = false;
      state.isComplete = true;

      const assessment: PatientSymptomAssessment = {
        symptoms: emergencyCheck.symptoms,
        bodyRegions: ['systemic'],
        duration: state.duration,
        severity: 'severe',
        onset: 'sudden',
        language: lang,
        redFlags: [emergencyCheck.reason],
        confidence: 0.99,
        source: 'rule_engine',
      };

      console.log('[TriageStateMachine] 🚨 EMERGENCY DETECTED:', emergencyCheck.reason);

      return {
        text: emergencyCheck.message,
        assessment,
        isEmergency: true,
        emergencyReason: emergencyCheck.reason,
        recommendedSpecialty: 'Emergency Medicine',
        suggestedQuestions: ['🚨 Call 108 Ambulance', 'Nearest Emergency Hospital', 'First Aid Steps'],
        readyForDoctorMatch: false,
      };
    }

    // ─── 2. CASUAL GREETINGS & METAS (No symptoms reported) ────────────────────
    if (TriageStateMachine.isCasualGreeting(cleanLower) && !state.chiefComplaint) {
      return TriageStateMachine.handleGreeting(lang);
    }
    if (TriageStateMachine.isMetaQuery(cleanLower) && !state.chiefComplaint) {
      return TriageStateMachine.handleMetaQuery(cleanLower, lang);
    }

    // ─── 3. EXTRACT & UPDATE STATE FROM USER INPUT ─────────────────────────────
    TriageStateMachine.updateStateFromInput(text);

    // ─── 4. DOCTOR INTENT DIRECT HANDLING ──────────────────────────────────────
    const isDirectDoctorRequest = /\b(doctor|appointment|book|booking|slot|consult|find doctor|need doctor|doctor chahiye|daktar)\b/i.test(cleanLower);
    if (isDirectDoctorRequest && state.chiefComplaint && (state.turnCount >= 2 || state.duration || state.severity || state.injuryMechanism)) {
      // User explicitly wants to book and we have basic info -> Finish triage
      return TriageStateMachine.finalizeTriage(state, lang);
    }

    // ─── 5. CATEGORY-SPECIFIC QUESTION SEQUENCING ──────────────────────────────
    const category = state.category || 'general';

    switch (category) {
      case 'limb_injury':
        return TriageStateMachine.handleLimbInjury(state, lang);

      case 'fever_respiratory':
        return TriageStateMachine.handleFeverRespiratory(state, lang);

      case 'headache':
        return TriageStateMachine.handleHeadache(state, lang);

      case 'abdominal':
        return TriageStateMachine.handleAbdominal(state, lang);

      case 'skin':
        return TriageStateMachine.handleSkin(state, lang);

      case 'chest_cardio':
        return TriageStateMachine.handleChestCardio(state, lang);

      case 'eye_ent':
        return TriageStateMachine.handleEyeEnt(state, lang);

      case 'general':
      default:
        return TriageStateMachine.handleGeneral(state, lang);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CATEGORY HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * LIMB & TRAUMA INJURY FLOW:
   * Turn 1: Mechanism (fall/hit/cut) + Exact Location
   * Turn 2: Severity (1-10) + Swelling/Bleeding + Walking/Standing difficulty
   * Turn 3: Complete -> Triage Summary + Doctor Card
   */
  private static handleLimbInjury(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'Orthopedics';

    // Step 1: Missing mechanism (e.g. user says "I hurt my leg")
    if (!state.injuryMechanism) {
      state.stage = 'asking_followup_1';
      const question = lang === 'hi'
        ? 'यह सुनकर दुख हुआ। क्या यह चोट गिरने, कटने, किसी चीज़ से टकराने या मुड़ने से लगी? और ठीक कहाँ दर्द हो रहा है?'
        : 'Sorry to hear that. Did you hurt it from a fall, a cut, a hit, or something else? Where exactly does it hurt?';
      
      const chips = lang === 'hi'
        ? ['मैं गिर गया था', 'चोट लग गई/कट गया', 'टकराने से चोट लगी', 'पैर मुड़ गया']
        : ['I fell down', 'Hit by object', 'Cut / wound', 'Twisted my ankle'];

      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    // Step 2: Missing severity OR functional check (swelling, bleeding, walking)
    const hasFunctionalData = state.difficultyWalking !== null || state.swelling !== null || state.bleeding !== null;
    const hasSeverityData = state.severity !== null;

    if (!hasFunctionalData || !hasSeverityData || state.turnCount < 2) {
      state.stage = 'asking_followup_2';
      const loc = state.bodyLocation || 'leg or arm';
      const question = lang === 'hi'
        ? `आपके ${loc} में दर्द 1 से 10 के पैमाने पर कितना है? क्या वहाँ सूजन, खून बहना या चलने/खड़े होने में परेशानी हो रही है?`
        : `Where on your ${loc} does it hurt, and how bad is the pain from 1 to 10? Is there swelling, bleeding, or difficulty standing or walking?`;

      const chips = lang === 'hi'
        ? ['घुटने में दर्द, 7/10', 'सूजन है और चल नहीं पा रहा', 'हल्का दर्द, चल सकता हूँ']
        : ['My knee, about 7/10', 'Swelling and cannot walk', 'Mild pain, can walk fine'];

      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    // Step 3: All necessary info collected -> Finalize
    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * FEVER & RESPIRATORY FLOW:
   * Turn 1: Duration + Fever level/severity + Breathing check + Cough/Sore throat
   * Turn 2: Complete -> Home care (hydration/paracetamol) + General Physician Card
   */
  private static handleFeverRespiratory(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'General Medicine';

    // Step 1: Check if duration or breathing status is unknown
    if (!state.duration && state.difficultyBreathing === null && state.turnCount < 2) {
      state.stage = 'asking_followup_1';
      const question = lang === 'hi'
        ? 'आपको बुखार और खांसी कितने दिनों से है? क्या बुखार हल्का है या तेज़, और क्या सांस लेने में कोई परेशानी है?'
        : 'How many days have you had the fever and cough? Is the fever mild or high, and do you have any difficulty breathing?';

      const chips = lang === 'hi'
        ? ['2 दिनों से, हल्का बुखार', 'कल से तेज़ बुखार है', 'सांस में कोई दिक्कत नहीं']
        : ['Started 2 days ago, mild fever', 'High fever since yesterday', 'No breathing trouble, just cough'];

      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    // Step 2: Finalize
    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * HEADACHE FLOW:
   * Turn 1: Duration/onset + Location + Severity + Red flags (vomiting, blurry vision, neck stiffness)
   * Turn 2: Complete -> Guidance + Doctor Recommendation
   * STRICT GUARD: NEVER mention pregnancy, pre-eclampsia, diabetes, etc.
   */
  private static handleHeadache(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'General Medicine';

    if (state.turnCount < 2 || !state.duration) {
      state.stage = 'asking_followup_1';
      const question = lang === 'hi'
        ? 'सिरदर्द कब शुरू हुआ और दर्द कहाँ है? क्या यह अचानक बहुत तेज़ हुआ, और क्या उल्टी, धुंधला दिखना या गर्दन में अकड़न है?'
        : 'When did the headache start and where does it hurt? Is it sudden or unusually severe, and do you have vomiting, blurry vision, or neck stiffness?';

      const chips = lang === 'hi'
        ? ['सुबह से हल्का सिरदर्द है', 'अचानक बहुत तेज़ दर्द हुआ', 'उल्टी या चक्कर नहीं है']
        : ['Dull headache since morning', 'Sudden severe pain', 'Throbbing on one side', 'No vomiting or vision issues'];

      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * ABDOMINAL / STOMACH PAIN FLOW:
   * Turn 1: Exact location (upper/lower right/all over) + Duration + Associated (vomiting, diarrhea, fever)
   * Turn 2: Complete -> Home guidance + Doctor recommendation
   */
  private static handleAbdominal(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'General Medicine';

    if (state.turnCount < 2 || !state.bodyLocation || !state.duration) {
      state.stage = 'asking_followup_1';
      const question = lang === 'hi'
        ? 'पेट में दर्द ठीक कहाँ हो रहा है (ऊपर, दाईं तरफ, या पूरे पेट में)? क्या जी मिचलाना, उल्टी, दस्त या बुखार भी है?'
        : 'Where in your stomach does it hurt (upper, lower right, or all over), and do you have nausea, vomiting, diarrhea, or fever?';

      const chips = lang === 'hi'
        ? ['खाने के बाद ऊपर पेट में दर्द', 'दाईं तरफ नीचे तेज़ दर्द', 'हल्का दर्द और दस्त']
        : ['Upper stomach after eating', 'Lower right sharp pain', 'Mild cramping with loose motion', 'Pain for 1 day'];

      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * SKIN / RASH FLOW
   */
  private static handleSkin(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'Dermatology';

    if (!state.duration && state.turnCount < 2) {
      state.stage = 'asking_followup_1';
      const question = lang === 'hi'
        ? 'यह खुजली या दाने कब से हैं? क्या इसमें जलन, सूजन या मवाद आ रहा है?'
        : 'How long have you had this rash or itching? Is there burning, swelling, or any spreading redness?';

      const chips = ['Started 2 days ago', 'Severe itching', 'Spreading on hands/body'];
      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * CHEST / CARDIO (Non-emergency mild or general questions)
   */
  private static handleChestCardio(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'Cardiology';

    // If severe or sudden -> Emergency override triggers earlier in checkEmergencyRedFlags.
    if (!state.duration && state.turnCount < 2) {
      state.stage = 'asking_followup_1';
      const question = 'Did the chest discomfort start after exertion or eating? Do you feel any sweating, dizziness, or shortness of breath?';
      const chips = ['After physical work', 'Mild burning after meals', 'Shortness of breath'];
      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * EYE / ENT FLOW
   */
  private static handleEyeEnt(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    if (state.chiefComplaint?.includes('eye')) {
      state.recommendedSpecialty = 'Ophthalmology';
    } else {
      state.recommendedSpecialty = 'ENT';
    }

    if (!state.duration && state.turnCount < 2) {
      state.stage = 'asking_followup_1';
      const question = 'How long have you had this pain or discomfort? Do you have any discharge, redness, or difficulty hearing/seeing?';
      const chips = ['Started yesterday', 'Mild pain, no discharge', 'Redness and irritation'];
      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    return TriageStateMachine.finalizeTriage(state, lang);
  }

  /**
   * GENERAL FALLBACK FLOW
   */
  private static handleGeneral(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.recommendedSpecialty = 'General Medicine';

    if (!state.chiefComplaint || state.turnCount < 2) {
      state.stage = 'asking_followup_1';
      const question = lang === 'hi'
        ? 'कृपया अपनी समस्या के बारे में थोड़ा और बताएं। यह लक्षण कब से है और क्या यह हल्का है या तेज़?'
        : 'Please tell me a bit more about what you are experiencing. How long have you had this and is it mild or severe?';

      const chips = ['Started 2 days ago', 'Mild discomfort', 'Need doctor checkup'];
      return TriageStateMachine.buildFollowupResponse(question, chips, state);
    }

    return TriageStateMachine.finalizeTriage(state, lang);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE FINALIZATION & SUMMARY GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Finalize triage, compile structured summary, and enable doctor match card.
   */
  public static finalizeTriage(state: TriageState, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    state.stage = 'summary_ready';
    state.isComplete = true;
    state.readyForDoctorMatch = true;

    // Calculate urgency
    if (state.otherRedFlags.length > 0 || state.severity === 'severe' || state.difficultyWalking || state.difficultyBreathing) {
      state.urgency = 'high';
    } else if (state.severity === 'moderate' || state.duration?.includes('week')) {
      state.urgency = 'medium';
    } else {
      state.urgency = 'routine';
    }

    // Generate home care guidance
    const homeCareTip = TriageStateMachine.getHomeCareGuidance(state);
    state.homeCareTip = homeCareTip;

    // Build structured summary
    const structuredSummary: StructuredTriageSummary = {
      chiefComplaint: state.chiefComplaint || 'General consultation',
      category: state.category || 'general',
      bodyLocation: state.bodyLocation || undefined,
      cause: state.injuryMechanism || undefined,
      duration: state.duration || undefined,
      severity: state.severity || undefined,
      swelling: state.swelling !== null ? state.swelling : undefined,
      bleeding: state.bleeding !== null ? state.bleeding : undefined,
      difficultyWalking: state.difficultyWalking !== null ? state.difficultyWalking : undefined,
      difficultyBreathing: state.difficultyBreathing !== null ? state.difficultyBreathing : undefined,
      urgency: state.urgency,
      recommendedSpecialty: state.recommendedSpecialty,
      homeCareGuidance: homeCareTip,
    };

    // Format concise triage note for doctor
    const formattedNote = TriageStateMachine.formatTriageNote(structuredSummary);

    // Build natural response text (1-3 sentences)
    let responseText = '';
    const complaintText = state.chiefComplaint ? state.chiefComplaint : 'your symptoms';
    const locText = state.bodyLocation ? ` (${state.bodyLocation})` : '';

    if (lang === 'hi') {
      responseText = `आपकी जानकारी नोट कर ली गई है।\n\n• **प्राथमिक सलाह:** ${homeCareTip}\n• **अगला कदम:** आपके लक्षणों के अनुसार प्राथमिक स्वास्थ्य केंद्र (PHC) में **${state.recommendedSpecialty}** डॉक्टर से जांच कराना उचित रहेगा। नीचे दिए गए कार्ड से स्लॉट बुक कर सकते हैं।`;
    } else if (lang === 'ne') {
      responseText = `तपाईंको जानकारी सुरक्षित गरिएको छ।\n\n• **सल्लाह:** ${homeCareTip}\n• **अर्को कदम:** स्वास्थ्य केन्द्रका **${state.recommendedSpecialty}** डाक्टरसँग परामर्श लिनु उपयुक्त हुनेछ।`;
    } else {
      responseText = `Based on your reported symptoms of ${complaintText}${locText}:\n\n• **Home Guidance:** ${homeCareTip}\n• **Recommendation:** A physical evaluation by our **${state.recommendedSpecialty}** doctor at your local Primary Health Centre (PHC) is recommended. Please book a slot below.`;
    }

    const assessment: PatientSymptomAssessment = {
      symptoms: [state.chiefComplaint || 'general'].filter(Boolean),
      bodyRegions: [state.bodyLocation || 'systemic'],
      duration: state.duration,
      severity: state.severity,
      onset: state.injuryMechanism ? 'acute' : null,
      language: lang,
      redFlags: state.otherRedFlags,
      confidence: 0.95,
      source: 'offline_ai',
    };

    console.log('[TriageStateMachine] ✅ Triage completed with structured summary:', structuredSummary);

    return {
      text: responseText,
      assessment,
      isEmergency: false,
      recommendedSpecialty: state.recommendedSpecialty,
      suggestedQuestions: ['Book earliest slot', 'Check another specialty', 'View doctor profile'],
      readyForDoctorMatch: true,
      structuredSummary,
      formattedTriageNote: formattedNote,
    };
  }

  /**
   * Format structured triage summary as a clean clinical note for doctors
   */
  public static formatTriageNote(summary: StructuredTriageSummary): string {
    const parts: string[] = [];
    parts.push(`Complaint: ${summary.chiefComplaint}${summary.bodyLocation ? ` (${summary.bodyLocation})` : ''}`);
    if (summary.cause) parts.push(`Cause: ${summary.cause}`);
    if (summary.duration) parts.push(`Duration: ${summary.duration}`);
    if (summary.severity) parts.push(`Severity: ${summary.severity}`);
    
    const flags: string[] = [];
    if (summary.swelling !== undefined) flags.push(`Swelling: ${summary.swelling ? 'Yes' : 'No'}`);
    if (summary.bleeding !== undefined) flags.push(`Bleeding: ${summary.bleeding ? 'Yes' : 'No'}`);
    if (summary.difficultyWalking !== undefined) flags.push(`Walking: ${summary.difficultyWalking ? 'Difficult' : 'Normal'}`);
    if (summary.difficultyBreathing !== undefined) flags.push(`Breathing: ${summary.difficultyBreathing ? 'Difficult' : 'Normal'}`);
    if (flags.length > 0) parts.push(flags.join(' | '));

    parts.push(`Urgency: ${summary.urgency.toUpperCase()} (${summary.recommendedSpecialty})`);
    return parts.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER EXTRACTION & STATE UPDATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Updates state variables from the latest user message
   */
  private static updateStateFromInput(text: string): void {
    const lower = text.toLowerCase();
    const state = TriageStateMachine.currentState;

    // 1. Extract chief complaint & category if not yet set
    const extracted = TriageStateMachine.extractSymptomCategory(lower);
    if (extracted.category) {
      if (!state.category) state.category = extracted.category;
      if (!state.chiefComplaint) state.chiefComplaint = extracted.complaint;
    }

    // 2. Extract body location
    const location = TriageStateMachine.extractLocation(lower);
    if (location) state.bodyLocation = location;

    // 3. Extract injury mechanism
    const mechanism = TriageStateMachine.extractMechanism(lower);
    if (mechanism) state.injuryMechanism = mechanism;

    // 4. Extract duration
    const dur = TriageStateMachine.extractDuration(text);
    if (dur) state.duration = dur;

    // 5. Extract severity (1-10 or mild/mod/sev)
    const sev = TriageStateMachine.extractSeverity(text);
    if (sev) state.severity = sev;

    // 6. Extract swelling
    if (/\b(swelling|swollen|sujan|suj gaya|phool gaya)\b/i.test(lower)) {
      state.swelling = !/\b(no swelling|not swollen|bina sujan|sujan nahi)\b/i.test(lower);
    }

    // 7. Extract bleeding
    if (/\b(bleeding|blood|khoon|ragat)\b/i.test(lower)) {
      state.bleeding = !/\b(no bleeding|not bleeding|khoon nahi)\b/i.test(lower);
    }

    // 8. Extract difficulty walking/standing
    if (/\b(cannot walk|can't walk|unable to walk|difficulty walking|hard to walk|cannot stand|chal nahi|hidna sakdina)\b/i.test(lower)) {
      state.difficultyWalking = true;
    } else if (/\b(can walk|able to walk|chal sakta|hidna sakchu)\b/i.test(lower)) {
      state.difficultyWalking = false;
    }

    // 9. Extract breathing difficulty
    if (/\b(shortness of breath|cannot breathe|hard to breathe|saans lene me|saas ferna)\b/i.test(lower)) {
      state.difficultyBreathing = true;
    } else if (/\b(no breathing trouble|breathing fine|saans theek)\b/i.test(lower)) {
      state.difficultyBreathing = false;
    }

    // 10. Extract fever
    if (/\b(fever|temperature|bukhar|jworo)\b/i.test(lower)) {
      state.fever = true;
    }

    // Log update
    console.log('[TriageStateMachine] 📝 Updated State:', {
      category: state.category,
      complaint: state.chiefComplaint,
      location: state.bodyLocation,
      mechanism: state.injuryMechanism,
      duration: state.duration,
      severity: state.severity,
      swelling: state.swelling,
      walking: state.difficultyWalking,
      breathing: state.difficultyBreathing,
      turn: state.turnCount,
    });
  }

  /**
   * Deterministic Emergency Red Flag Checker
   */
  public static checkEmergencyRedFlags(
    text: string,
    history: { sender: string; text: string }[]
  ): { isEmergency: boolean; reason: string; message: string; symptoms: string[] } {
    const lower = text.toLowerCase();

    // Red Flag 1: Severe Shortness of breath / Inability to breathe
    if (/\b(can't breathe|cannot breathe|unable to breathe|gasping for air|choking|saans nahi aa rahi)\b/i.test(lower)) {
      return {
        isEmergency: true,
        reason: 'Severe difficulty breathing detected.',
        message: '⚠️ **Emergency Alert: Severe Breathing Difficulty**\nPlease seek emergency medical care immediately. Sit upright, loosen tight clothing, and tap the red **SOS Ambulance (108)** button to request urgent transport.',
        symptoms: ['severe dyspnea', 'respiratory distress'],
      };
    }

    // Red Flag 2: Severe Chest Pain (especially with radiation or shortness of breath)
    if (/\b(severe chest pain|crushing chest pain|chest tightness|heart attack|seene me tez dard)\b/i.test(lower) ||
       (/\b(chest pain|chhati me dard)\b/i.test(lower) && /\b(sweating|dizziness|arm pain|breath|saans)\b/i.test(lower))) {
      return {
        isEmergency: true,
        reason: 'Severe chest pain / possible cardiac event.',
        message: '⚠️ **Emergency Alert: Cardiac / Chest Pain Emergency**\nChest pain with severe distress requires immediate hospital evaluation. Do not drive yourself. Tap **SOS Ambulance (108)** immediately.',
        symptoms: ['chest pain', 'cardiac red flag'],
      };
    }

    // Red Flag 3: Severe Uncontrolled Bleeding
    if (/\b(bleeding heavily|won't stop bleeding|hemorrhage|blood spurting|bahut khoon beh raha)\b/i.test(lower)) {
      return {
        isEmergency: true,
        reason: 'Severe uncontrolled bleeding.',
        message: '⚠️ **Emergency Alert: Severe Bleeding**\nApply firm, continuous pressure to the wound with a clean cloth. Elevate the injured limb if possible and seek immediate emergency care or call 108.',
        symptoms: ['severe hemorrhage'],
      };
    }

    // Red Flag 4: Loss of consciousness / Unresponsive
    if (/\b(unconscious|passed out|blacked out|fainted and not waking|behoosh)\b/i.test(lower)) {
      return {
        isEmergency: true,
        reason: 'Loss of consciousness / unresponsiveness.',
        message: '⚠️ **Emergency Alert: Unconsciousness**\nPlace the person on their side in the recovery position. Check that their airway is clear. Call 108 immediately.',
        symptoms: ['unconsciousness'],
      };
    }

    // Red Flag 5: Sudden Severe Weakness / Facial Droop (Stroke)
    if (/\b(sudden weakness|paralysis|face drooping|cannot speak|slurred speech|ek taraf ka hath)\b/i.test(lower)) {
      return {
        isEmergency: true,
        reason: 'Suspected acute stroke / neurological emergency.',
        message: '⚠️ **Emergency Alert: Suspected Stroke**\nSudden one-sided weakness or difficulty speaking requires immediate emergency intervention at a district hospital.',
        symptoms: ['acute stroke signs'],
      };
    }

    return { isEmergency: false, reason: '', message: '', symptoms: [] };
  }

  /**
   * Helper to identify symptom category and chief complaint
   */
  private static extractSymptomCategory(lower: string): { category: TriageCategory | null; complaint: string | null } {
    // 1. Limb & Joint Injury
    if (/\b(hurt my leg|hurt my arm|hurt my knee|hurt my foot|hurt my ankle|hurt my hand|leg injury|knee injury|twisted ankle|fracture|broken bone|fell down|hurt my back|knee pain|leg pain|arm pain|chot lag gayi|pair me chot|ghutne me chot)\b/i.test(lower)) {
      let complaint = 'Limb injury';
      if (lower.includes('knee')) complaint = 'Knee injury';
      else if (lower.includes('leg')) complaint = 'Leg injury';
      else if (lower.includes('arm')) complaint = 'Arm injury';
      else if (lower.includes('ankle')) complaint = 'Ankle injury';
      else if (lower.includes('back')) complaint = 'Back pain';
      return { category: 'limb_injury', complaint };
    }

    // 2. Fever & Respiratory
    if (/\b(fever|cough|cold|sore throat|chills|bukhar|khansi|sardi|gale me dard|jworo|khoki)\b/i.test(lower)) {
      const parts: string[] = [];
      if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('jworo')) parts.push('Fever');
      if (lower.includes('cough') || lower.includes('khansi') || lower.includes('khoki')) parts.push('Cough');
      if (lower.includes('cold') || lower.includes('sardi')) parts.push('Cold');
      if (lower.includes('throat') || lower.includes('gale')) parts.push('Sore throat');
      return { category: 'fever_respiratory', complaint: parts.length > 0 ? parts.join(' & ') : 'Fever & Cough' };
    }

    // 3. Headache
    if (/\b(headache|head pain|migraine|sir dard|sar dard|tauko dukh)\b/i.test(lower)) {
      return { category: 'headache', complaint: 'Headache' };
    }

    // 4. Abdominal Pain / Stomach
    if (/\b(stomach pain|belly pain|abdominal pain|tummy ache|pet dard|pet me dard|loose motion|diarrhea|vomiting|dast|ulti)\b/i.test(lower)) {
      return { category: 'abdominal', complaint: 'Stomach pain' };
    }

    // 5. Skin
    if (/\b(rash|skin rash|itching|hives|khujli|dane)\b/i.test(lower)) {
      return { category: 'skin', complaint: 'Skin rash / itching' };
    }

    // 6. Chest / Breathing
    if (/\b(chest pain|chest tightness|breathe|saans|chhati)\b/i.test(lower)) {
      return { category: 'chest_cardio', complaint: 'Chest discomfort' };
    }

    // 7. Eye / ENT
    if (/\b(eye pain|ear pain|tooth pain|aankh|kaan|daant)\b/i.test(lower)) {
      return { category: 'eye_ent', complaint: 'Eye/ENT pain' };
    }

    return { category: null, complaint: null };
  }

  /**
   * Extract body location
   */
  private static extractLocation(lower: string): string | null {
    const locations = [
      'knee', 'leg', 'ankle', 'foot', 'thigh', 'hip',
      'arm', 'elbow', 'wrist', 'hand', 'shoulder', 'finger',
      'head', 'forehead', 'neck', 'throat',
      'chest', 'stomach', 'belly', 'abdomen', 'back', 'lower back',
      'eye', 'ear', 'tooth', 'gum', 'skin'
    ];
    for (const loc of locations) {
      if (new RegExp(`\\b${loc}\\b`, 'i').test(lower)) return loc;
    }
    return null;
  }

  /**
   * Extract injury mechanism
   */
  private static extractMechanism(lower: string): string | null {
    if (/\b(fell|fall|falling|gir gaya|gir gaye|ladd gaye)\b/i.test(lower)) return 'Fall';
    if (/\b(hit|struck|collision|thok|takkar|mar laga)\b/i.test(lower)) return 'Direct Impact / Hit';
    if (/\b(cut|blade|knife|glass|wound|kat gaya|ghav)\b/i.test(lower)) return 'Cut / Laceration';
    if (/\b(twist|twisted|sprain|moch|lachak)\b/i.test(lower)) return 'Twist / Sprain';
    if (/\b(heavy lifting|weight|bojh|strain)\b/i.test(lower)) return 'Heavy Lifting / Strain';
    if (/\b(accident|bike|car|vehicle|gadi)\b/i.test(lower)) return 'Vehicle Accident';
    return null;
  }

  /**
   * Extract duration from text
   */
  private static extractDuration(text: string): string | null {
    const match = text.match(/(since\s+\d+\s*(days?|weeks?|months?|hours?|\w+)|\d+\s*(days?|weeks?|months?|hours?)|yesterday|today|since\s+morning|since\s+last\s+night|2\s+days|3\s+days|few\s+hours)/i);
    return match ? match[0] : null;
  }

  /**
   * Extract severity (1-10 or keywords)
   */
  private static extractSeverity(text: string): string | null {
    const numMatch = text.match(/\b([1-9]|10)\s*(\/\s*10)?\b/);
    if (numMatch && (text.toLowerCase().includes('pain') || text.toLowerCase().includes('about') || text.toLowerCase().includes('rate') || text.toLowerCase().includes('is'))) {
      return `${numMatch[1]}/10`;
    }
    if (/\b(severe|unbearable|very bad|extremely bad|bahut tez|bahut jyada)\b/i.test(text)) return 'severe';
    if (/\b(moderate|medium|theek theek)\b/i.test(text)) return 'moderate';
    if (/\b(mild|slight|little|halka|ali ali)\b/i.test(text)) return 'mild';
    return null;
  }

  /**
   * Safe Home Care Guidance based on state
   */
  private static getHomeCareGuidance(state: TriageState): string {
    const cat = state.category;
    if (cat === 'limb_injury') {
      return 'Rest the injured limb, apply a cold cloth or ice pack for 15 minutes, keep it elevated, and avoid putting heavy weight on it.';
    }
    if (cat === 'fever_respiratory') {
      return 'Drink plenty of clean fluids and ORS/water to stay hydrated. Rest well. Paracetamol can help relieve fever and body ache.';
    }
    if (cat === 'headache') {
      return 'Rest in a quiet, dimly lit room, stay well hydrated with water, and avoid screen strain.';
    }
    if (cat === 'abdominal') {
      return 'Sip warm water or ORS, eat light bland food (khichdi/banana), and avoid spicy or oily foods.';
    }
    if (cat === 'skin') {
      return 'Wash gently with clean water, avoid scratching, and apply a cool moist compress to soothe the area.';
    }
    return 'Rest well, drink plenty of clean fluids, and monitor your symptoms.';
  }

  /**
   * Helper to construct a follow-up question response
   */
  private static buildFollowupResponse(
    question: string,
    suggestedReplies: string[],
    state: TriageState
  ): AIRouterResponse {
    state.questionsAsked.push(question);

    const assessment: PatientSymptomAssessment = {
      symptoms: [state.chiefComplaint || 'general'].filter(Boolean),
      bodyRegions: [state.bodyLocation || 'systemic'],
      duration: state.duration,
      severity: state.severity,
      onset: state.injuryMechanism ? 'acute' : null,
      language: state.language,
      redFlags: [],
      confidence: 0.85,
      source: 'offline_ai',
    };

    return {
      text: question,
      assessment,
      isEmergency: false,
      recommendedSpecialty: state.recommendedSpecialty,
      suggestedQuestions: suggestedReplies,
      readyForDoctorMatch: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SANITIZER & SAFETY GUARDRAILS (CRITICAL: ZERO ASSUMPTIONS)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Scans and sanitizes any LLM output to strictly guarantee no hallucinated medical assumptions
   * (e.g. pregnancy, pre-eclampsia, diabetes) unless explicitly provided by the user.
   */
  public static sanitizeOutput(llmOutput: string, userInput: string, patientGender?: string): string {
    let sanitized = llmOutput;

    // Strict list of unprompted assumptions to eliminate
    const unmentionedPregnancy = !/\b(pregnant|pregnancy|garbhavastha)\b/i.test(userInput);
    if (unmentionedPregnancy) {
      sanitized = sanitized.replace(/\b(during pregnancy|since you are pregnant|pre-eclampsia|preeclampsia|pregnancy-related|in pregnant women)\b/gi, '');
    }

    const unmentionedDiabetes = !/\b(diabetes|diabetic|sugar)\b/i.test(userInput);
    if (unmentionedDiabetes) {
      sanitized = sanitized.replace(/\b(since you have diabetes|diabetic condition|blood sugar complications)\b/gi, '');
    }

    // Strip generic long essay openings
    sanitized = sanitized.replace(/^as an ai assistant[,\.\s]*/i, '');
    sanitized = sanitized.replace(/^based on the information provided[,\.\s]*/i, '');

    // Trim double spaces/newlines
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

    return sanitized;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CASUAL & META HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  private static isCasualGreeting(clean: string): boolean {
    return /^(hi|hello|hey|namaste|namaskar|pranam|good\s*(morning|afternoon|evening)|hola|salam)\b/i.test(clean) || clean === 'hi' || clean === 'hello';
  }

  private static handleGreeting(lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    const text = lang === 'hi'
      ? 'नमस्ते! मैं आपका रूरलकेयर AI स्वास्थ्य सहायक हूँ। आप आज कैसा महसूस कर रहे हैं? कृपया अपनी समस्या बताएं।'
      : 'Namaste! I am your RuralCare AI Triage Assistant. How are you feeling today? You can describe any symptoms in English, Hindi, or Bhojpuri.';

    const chips = lang === 'hi'
      ? ['मुझे बुखार और खांसी है', 'मेरे पैर में चोट लगी है', 'सिर में दर्द है']
      : ['I have a fever & cough', 'I hurt my leg', 'Severe headache', 'Stomach pain since yesterday'];

    return {
      text,
      assessment: { symptoms: [], bodyRegions: [], duration: null, severity: null, onset: null, language: lang, redFlags: [], confidence: 1, source: 'rule_engine' },
      isEmergency: false,
      recommendedSpecialty: 'General Medicine',
      suggestedQuestions: chips,
      readyForDoctorMatch: false,
    };
  }

  private static isMetaQuery(clean: string): boolean {
    return /^(who are you|how are you|what can you do|help me|thank you|thanks)\b/i.test(clean);
  }

  private static handleMetaQuery(clean: string, lang: 'en' | 'hi' | 'ne'): AIRouterResponse {
    let text = "I am RuralCare AI, an on-device clinical triage assistant. I help you assess symptoms, understand home care, and connect with doctors at your local PHC.";
    if (clean.includes('how are you')) {
      text = "I'm doing well, thank you! How are you feeling today? Please let me know what symptoms you are experiencing.";
    } else if (clean.includes('thank')) {
      text = "You're very welcome! Take care of your health and reach out anytime you need assistance.";
    }

    return {
      text,
      assessment: { symptoms: [], bodyRegions: [], duration: null, severity: null, onset: null, language: lang, redFlags: [], confidence: 1, source: 'rule_engine' },
      isEmergency: false,
      recommendedSpecialty: 'General Medicine',
      suggestedQuestions: ['I have a fever and cough', 'I hurt my knee', 'Need a doctor checkup'],
      readyForDoctorMatch: false,
    };
  }

  private static detectLanguage(text: string): 'en' | 'hi' | 'ne' {
    if (/[\u0900-\u097F]/.test(text)) {
      if (/\b(cha|chaan|dukhcha|gareko|aayo)\b/i.test(text)) return 'ne';
      return 'hi';
    }
    if (/\b(namaste|bukhar|dard|khansi|pet|sir|dawai|chot|pair)\b/i.test(text)) return 'hi';
    if (/\b(sanchai|dukhcha|jworo|tauko|pet|khoki|khutta)\b/i.test(text)) return 'ne';
    return 'en';
  }
}
