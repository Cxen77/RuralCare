/**
 * RuralCare AI Triage Engine
 * Symptom extraction, red-flag screening, specialty routing
 * PRD Core Safety Rule: AI assists with triage only, never diagnoses or prescribes
 */

import type { UrgencyLevel } from '../types/schema';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface TriageResult {
  symptoms: string[];
  urgency: UrgencyLevel;
  isRedFlag: boolean;
  redFlagReason?: string;
  recommendedSpecialty: string;
  summaryText: string;
  suggestedQuestions: string[];
}

// ─── Red Flag Rules ─────────────────────────────────────────────────────────

interface RedFlagRule {
  keywords: string[];
  reason: string;
}

const RED_FLAGS: RedFlagRule[] = [
  { keywords: ['chest pain', 'heart attack', 'cardiac arrest'], reason: 'Possible cardiac emergency – call 108 immediately' },
  { keywords: ['cannot breathe', 'breathing stopped', 'breathless', 'choking'], reason: 'Respiratory distress – immediate emergency response' },
  { keywords: ['heavy bleeding', 'blood loss', 'haemorrhage', 'hemorrhage'], reason: 'Severe hemorrhage – requires urgent medical intervention' },
  { keywords: ['paralysis', 'cannot move', 'stroke', 'face drooping'], reason: 'Possible stroke – time-critical window for treatment' },
  { keywords: ['unconscious', 'unresponsive', 'fainted', 'not waking'], reason: 'Loss of consciousness – immediate evaluation needed' },
  { keywords: ['seizure', 'convulsion', 'fits'], reason: 'Active seizure – stabilization required' },
  { keywords: ['snake bite', 'dog bite', 'scorpion sting'], reason: 'Envenomation / animal bite – anti-venom may be required' },
  { keywords: ['suicide', 'self harm', 'want to die'], reason: 'Mental health crisis – immediate counseling & safety support' },
  { keywords: ['labor pain', 'water broke', 'delivery', 'contractions'], reason: 'Obstetric emergency – transport to nearest delivery center' },
  { keywords: ['severe burn', 'burn injury', 'electrocution'], reason: 'Severe burn injury – emergency burn care needed' },
];

// ─── Specialty Routing Rules ────────────────────────────────────────────────

interface SpecialtyRule {
  keywords: string[];
  specialty: string;
}

const SPECIALTY_RULES: SpecialtyRule[] = [
  { keywords: ['heart', 'chest pain', 'palpitation', 'blood pressure', 'bp high', 'bp low'], specialty: 'Cardiology' },
  { keywords: ['bone', 'fracture', 'joint pain', 'knee pain', 'back pain', 'sprain', 'dislocation'], specialty: 'Orthopedics' },
  { keywords: ['child', 'baby', 'infant', 'newborn', 'pediatric', 'my son', 'my daughter', 'bachcha'], specialty: 'Pediatrics' },
  { keywords: ['pregnant', 'pregnancy', 'period', 'menstrual', 'gynec', 'delivery', 'labor'], specialty: 'Obstetrics & Gynecology' },
  { keywords: ['skin', 'rash', 'itching', 'pimple', 'allergy', 'eczema', 'fungal'], specialty: 'Dermatology' },
  { keywords: ['ear', 'nose', 'throat', 'hearing', 'sinus', 'tonsil', 'ENT'], specialty: 'ENT' },
  { keywords: ['eye', 'vision', 'blind', 'cataract', 'spectacles'], specialty: 'Ophthalmology' },
  { keywords: ['tooth', 'dental', 'gum', 'cavity'], specialty: 'Dentistry' },
  { keywords: ['mental', 'anxiety', 'depression', 'stress', 'sleep problem', 'insomnia'], specialty: 'Psychiatry' },
];

// ─── Symptom Extraction ─────────────────────────────────────────────────────

interface SymptomPattern {
  keywords: string[];
  symptomLabel: string;
}

const SYMPTOM_PATTERNS: SymptomPattern[] = [
  { keywords: ['stomach pain', 'pet me dard', 'abdominal pain', 'pet dard'], symptomLabel: 'Abdominal pain' },
  { keywords: ['headache', 'sir me dard', 'sir dard', 'head pain'], symptomLabel: 'Headache' },
  { keywords: ['fever', 'bukhar', 'temperature', 'hot body'], symptomLabel: 'Fever' },
  { keywords: ['cough', 'khansi', 'dry cough', 'wet cough'], symptomLabel: 'Cough' },
  { keywords: ['cold', 'sardi', 'runny nose', 'naak behna'], symptomLabel: 'Cold / Rhinitis' },
  { keywords: ['vomit', 'ulti', 'nausea', 'ji machlana', 'throwing up'], symptomLabel: 'Nausea / Vomiting' },
  { keywords: ['diarrhea', 'loose motion', 'pet kharab', 'dast'], symptomLabel: 'Diarrhea' },
  { keywords: ['chest pain', 'chhati me dard', 'seene me dard'], symptomLabel: 'Chest pain' },
  { keywords: ['dizzy', 'chakkar', 'lightheaded', 'sir ghum raha'], symptomLabel: 'Dizziness' },
  { keywords: ['weakness', 'kamzori', 'fatigue', 'tired', 'thak gaya'], symptomLabel: 'Weakness / Fatigue' },
  { keywords: ['joint pain', 'jod me dard', 'knee pain', 'ghutne me dard'], symptomLabel: 'Joint pain' },
  { keywords: ['back pain', 'kamar dard', 'peeth dard', 'spine pain'], symptomLabel: 'Back pain' },
  { keywords: ['difficulty breathing', 'saans lena', 'breathless', 'saans nahi'], symptomLabel: 'Dyspnea (Breathing difficulty)' },
  { keywords: ['rash', 'skin problem', 'khujli', 'itching'], symptomLabel: 'Skin rash / Itching' },
  { keywords: ['sore throat', 'gala dard', 'throat pain', 'gale me dard'], symptomLabel: 'Sore throat' },
  { keywords: ['eye pain', 'aankh me dard', 'blurry vision'], symptomLabel: 'Eye pain / Vision issues' },
  { keywords: ['ear pain', 'kaan me dard', 'hearing problem'], symptomLabel: 'Ear pain' },
  { keywords: ['burning urine', 'peshab me jalan', 'urinary problem'], symptomLabel: 'Urinary burning / UTI' },
  { keywords: ['swelling', 'sujan', 'inflammation'], symptomLabel: 'Swelling' },
];

// ─── Severity / Qualifier Extraction ────────────────────────────────────────

const SEVERITY_KEYWORDS: { keywords: string[]; label: string }[] = [
  { keywords: ['sharp', 'severe', 'intense', 'tez'], label: 'Sharp / Severe' },
  { keywords: ['mild', 'halka', 'thoda', 'slight'], label: 'Mild' },
  { keywords: ['moderate', 'madhyam'], label: 'Moderate' },
  { keywords: ['chronic', 'long time', 'bahut din se', 'purana'], label: 'Chronic' },
];

const DURATION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /(\d+)\s*day/i, label: '' }, // filled dynamically
  { pattern: /(\d+)\s*week/i, label: '' },
  { pattern: /(\d+)\s*month/i, label: '' },
  { pattern: /since\s+(yesterday|kal)/i, label: 'Since yesterday' },
  { pattern: /since\s+(morning|subah)/i, label: 'Since this morning' },
  { pattern: /(\d+)\s*hour/i, label: '' },
  { pattern: /(\d+)\s*din/i, label: '' }, // Hindi: "2 din se"
];

// ─── Main Triage Function ───────────────────────────────────────────────────

export function runTriage(userInput: string): TriageResult {
  const lower = userInput.toLowerCase();

  // 1. Red-flag screening (highest priority)
  let isRedFlag = false;
  let redFlagReason: string | undefined;

  for (const rule of RED_FLAGS) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      isRedFlag = true;
      redFlagReason = rule.reason;
      break;
    }
  }

  // 2. Extract symptoms
  const symptoms: string[] = [];
  for (const sp of SYMPTOM_PATTERNS) {
    if (sp.keywords.some(kw => lower.includes(kw))) {
      // Check severity qualifier
      let severityLabel = '';
      for (const sv of SEVERITY_KEYWORDS) {
        if (sv.keywords.some(kw => lower.includes(kw))) {
          severityLabel = sv.label;
          break;
        }
      }
      symptoms.push(severityLabel ? `${sp.symptomLabel} (${severityLabel})` : sp.symptomLabel);
    }
  }

  // 3. Extract duration
  for (const dp of DURATION_PATTERNS) {
    const match = lower.match(dp.pattern);
    if (match) {
      if (dp.label) {
        symptoms.push(`Duration: ${dp.label}`);
      } else {
        symptoms.push(`Duration: ${match[0]}`);
      }
      break;
    }
  }

  // 4. Determine specialty
  let recommendedSpecialty = 'General Medicine';
  for (const sr of SPECIALTY_RULES) {
    if (sr.keywords.some(kw => lower.includes(kw))) {
      recommendedSpecialty = sr.specialty;
      break;
    }
  }

  // 5. Determine urgency
  let urgency: UrgencyLevel = 'routine';
  if (isRedFlag) {
    urgency = 'high';
  } else if (symptoms.length >= 3 || lower.includes('severe') || lower.includes('tez')) {
    urgency = 'medium';
  }

  // 6. Build summary
  const symptomList = symptoms.length > 0 ? symptoms.join(', ') : 'No specific symptoms identified';
  const summaryText = isRedFlag
    ? `CRITICAL ALERT: ${redFlagReason}. Extracted signs: ${symptomList}. Immediate attention required.`
    : `AI Triage — Extracted: ${symptomList}. Recommended specialty: ${recommendedSpecialty}. Urgency: ${urgency}.`;

  // 7. Generate follow-up questions
  const suggestedQuestions = generateFollowUpQuestions(symptoms, recommendedSpecialty);

  return {
    symptoms: symptoms.length > 0 ? symptoms : ['General discomfort (unspecified)'],
    urgency,
    isRedFlag,
    redFlagReason,
    recommendedSpecialty,
    summaryText,
    suggestedQuestions,
  };
}

function generateFollowUpQuestions(symptoms: string[], specialty: string): string[] {
  const questions: string[] = [];

  if (symptoms.some(s => s.toLowerCase().includes('abdominal') || s.toLowerCase().includes('stomach'))) {
    questions.push('Is the pain in the upper right area, around the navel, or across the whole stomach?');
    questions.push('Have you noticed any change in appetite or bowel movements?');
  }

  if (symptoms.some(s => s.toLowerCase().includes('fever'))) {
    questions.push('How high is the temperature? Have you measured it?');
    questions.push('Does the fever come and go, or is it continuous?');
  }

  if (symptoms.some(s => s.toLowerCase().includes('cough'))) {
    questions.push('Is the cough dry or producing phlegm?');
    questions.push('Have you noticed any blood in the sputum?');
  }

  if (symptoms.some(s => s.toLowerCase().includes('headache'))) {
    questions.push('Is the headache one-sided or across the entire head?');
    questions.push('Do you experience any sensitivity to light or nausea?');
  }

  // Generic fallback question
  if (questions.length === 0) {
    questions.push('Can you describe when the symptoms started?');
    questions.push('Have you taken any medication for this so far?');
  }

  questions.push('Do you have any known allergies or chronic conditions?');

  return questions.slice(0, 4);
}

// ─── Chat Response Generator ────────────────────────────────────────────────

export function generateAiChatResponse(
  userInput: string,
  conversationHistory: { sender: string; text: string }[]
): { text: string; triageResult: TriageResult } {
  const triage = runTriage(userInput);

  let responseText: string;

  if (triage.isRedFlag) {
    responseText = `**Emergency Alert**: ${triage.redFlagReason}\n\nPlease press the SOS button immediately to dispatch an ambulance. While waiting, stay calm and do not move unless it is unsafe to remain.`;
  } else if (triage.symptoms.length > 1) {
    responseText = `I've noted the following symptoms: ${triage.symptoms.join(', ')}.\n\nBased on the analysis, I recommend consulting a **${triage.recommendedSpecialty}** specialist. ${triage.suggestedQuestions[0]}`;
  } else {
    responseText = `Thank you for sharing. ${triage.suggestedQuestions[0]}\n\nThis helps me provide a more accurate triage recommendation for you.`;
  }

  return { text: responseText, triageResult: triage };
}
