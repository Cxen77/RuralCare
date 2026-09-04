/**
 * RuralCare AI - Doctor Matching Service
 * Deterministically ranks local cached doctors based on AI triage outputs.
 */

import type { Doctor } from '../../types/schema';
import type { PatientSymptomAssessment } from './types';
import { SafetyRuleEngine } from './SafetyRuleEngine';

export interface DoctorMatchResult {
  doctor: Doctor;
  score: number;
  matchReasons: string[];
}

export class DoctorMatchingService {
  /**
   * Rank cached doctors based on the AI assessment and safety rules.
   */
  public static match(
    assessment: PatientSymptomAssessment,
    availableDoctors: Doctor[],
    patientLat?: number,
    patientLon?: number
  ): DoctorMatchResult[] {
    const evaluation = SafetyRuleEngine.evaluate(assessment);
    
    const scoredDoctors: DoctorMatchResult[] = availableDoctors
      .filter(doc => doc.isAvailable) // Only available doctors
      .map(doc => {
        let score = 0;
        const matchReasons: string[] = [];

        // 1. Specialty Match (Highest Weight)
        if (doc.specialty === evaluation.recommendedSpecialty) {
          score += 50;
          matchReasons.push(`Matches recommended specialty (${evaluation.recommendedSpecialty})`);
        } else if (doc.specialty === 'General Medicine') {
          // General Medicine is a good fallback
          score += 10;
          matchReasons.push('General Medicine fallback');
        }

        // 2. Language Match
        const pLang = assessment.language;
        let mappedLang = 'English';
        if (pLang === 'hi') mappedLang = 'Hindi';
        if (pLang === 'ne') mappedLang = 'Nepali';
        
        const docLangs = doc.languages || [];
        if (docLangs.includes(mappedLang)) {
          score += 20;
          matchReasons.push(`Speaks your language (${mappedLang})`);
        } else if (docLangs.includes('English')) {
           score += 5;
        }

        // 3. Distance (If coordinates provided, though we usually just have distanceKm populated)
        // Assume doc.distanceKm is pre-populated by the backend or location services
        if (doc.distanceKm !== undefined) {
           if (doc.distanceKm < 5) {
             score += 15;
             matchReasons.push(`Very close (${doc.distanceKm} km)`);
           } else if (doc.distanceKm < 15) {
             score += 10;
             matchReasons.push(`Nearby (${doc.distanceKm} km)`);
           }
        }

        return { doctor: doc, score, matchReasons };
      });

    // Sort by score descending
    return scoredDoctors.sort((a, b) => b.score - a.score);
  }
}
