/**
 * RuralCare AI - Deterministic Safety Rule Engine
 * Ensures AI outputs are gated by strict deterministic medical rules.
 * Does NOT rely on LLM for emergency detection.
 */

import type { PatientSymptomAssessment } from './types';
import { TerminologyNormalizer } from './terminology';
import type { UrgencyLevel } from '../../types/schema';

export interface SafetyEvaluation {
  isEmergency: boolean;
  emergencyReason?: string;
  urgency: UrgencyLevel;
  recommendedSpecialty: string;
}

export class SafetyRuleEngine {
  /**
   * Evaluates the structured assessment against strict rules.
   */
  public static evaluate(assessment: PatientSymptomAssessment): SafetyEvaluation {
    let isEmergency = false;
    let emergencyReason: string | undefined;
    
    // Map raw symptom strings to normalized concepts
    const concepts = new Set<string>();
    assessment.symptoms.forEach(sym => {
      const matched = TerminologyNormalizer.extractConcepts(sym);
      matched.forEach(c => concepts.add(c.concept));
    });

    // 1. Check for standalone red-flag concepts
    for (const concept of concepts) {
      const term = TerminologyNormalizer.getConceptById(concept);
      if (term?.isEmergencyRelevant) {
        isEmergency = true;
        emergencyReason = `Critical symptom detected: ${term.concept.replace(/_/g, ' ')}`;
        break;
      }
    }

    // 2. Check compound emergency rules
    if (!isEmergency) {
      if (concepts.has('CHEST_PAIN') && concepts.has('SHORTNESS_OF_BREATH')) {
        isEmergency = true;
        emergencyReason = 'Chest pain combined with breathing difficulty requires immediate evaluation.';
      }
      if (assessment.severity?.toLowerCase().includes('severe') && concepts.has('HEADACHE') && assessment.onset?.toLowerCase().includes('sudden')) {
        isEmergency = true;
        emergencyReason = 'Sudden, severe headache requires immediate evaluation.';
      }
    }

    // 3. Fallback text check for unmapped red flags
    if (!isEmergency && assessment.redFlags && assessment.redFlags.length > 0) {
       isEmergency = true;
       emergencyReason = assessment.redFlags.join(', ');
    }

    // 4. Determine Urgency
    let urgency: UrgencyLevel = 'routine';
    if (isEmergency) {
      urgency = 'high';
    } else if (concepts.size >= 3 || assessment.severity?.toLowerCase().includes('severe')) {
      urgency = 'medium';
    }

    // 5. Determine Specialty mapping
    let recommendedSpecialty = 'General Medicine';
    
    // Simple priority mapping
    if (concepts.has('CHEST_PAIN') || concepts.has('SHORTNESS_OF_BREATH')) {
      recommendedSpecialty = 'Cardiology';
    } else if (concepts.has('JOINT_PAIN') || concepts.has('BACK_PAIN')) {
      recommendedSpecialty = 'Orthopedics';
    } else if (concepts.has('SKIN_RASH')) {
      recommendedSpecialty = 'Dermatology';
    } else if (concepts.has('EYE_PAIN')) {
      recommendedSpecialty = 'Ophthalmology';
    } else if (concepts.has('TOOTH_PAIN')) {
      recommendedSpecialty = 'Dentistry';
    } else if (concepts.has('EAR_PAIN') || concepts.has('SORE_THROAT')) {
      recommendedSpecialty = 'ENT';
    }

    // If a concept explicitly recommends a specialty and it's not General Med, prefer it over default
    if (recommendedSpecialty === 'General Medicine') {
       for (const concept of concepts) {
         const term = TerminologyNormalizer.getConceptById(concept);
         if (term && term.recommendedSpecialty !== 'General Medicine') {
            recommendedSpecialty = term.recommendedSpecialty;
            break;
         }
       }
    }

    return {
      isEmergency,
      emergencyReason,
      urgency,
      recommendedSpecialty,
    };
  }
}
