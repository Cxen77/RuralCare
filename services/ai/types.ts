/**
 * RuralCare AI - Shared Types
 */
import type { UrgencyLevel } from '../../types/schema';

export interface PatientSymptomAssessment {
  symptoms: string[];
  bodyRegions: string[];
  duration: string | null;
  severity: string | null;
  onset: string | null;
  language: 'en' | 'hi' | 'ne';
  redFlags: string[];
  confidence: number | null;
  source: 'offline_ai' | 'online_ai' | 'rule_engine' | 'patient_manual';
}

export interface StructuredTriageSummary {
  chiefComplaint: string;
  category: string;
  bodyLocation?: string;
  cause?: string;
  duration?: string;
  severity?: string;
  swelling?: boolean;
  bleeding?: boolean;
  difficultyWalking?: boolean;
  difficultyBreathing?: boolean;
  urgency: UrgencyLevel | 'emergency';
  recommendedSpecialty: string;
  homeCareGuidance?: string;
}

export interface AIRouterResponse {
  text: string;
  assessment: PatientSymptomAssessment;
  isEmergency: boolean;
  emergencyReason?: string;
  recommendedSpecialty: string;
  suggestedQuestions: string[];
  readyForDoctorMatch?: boolean;
  structuredSummary?: StructuredTriageSummary;
  formattedTriageNote?: string;
  doctors?: any[];
  pharmacies?: any[];
  route?: any;
  confirmationNeeded?: any;
  intent?: string;
}
