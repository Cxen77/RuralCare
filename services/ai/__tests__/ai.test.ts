import { TerminologyNormalizer } from '../terminology';
import { SafetyRuleEngine } from '../SafetyRuleEngine';
import type { PatientSymptomAssessment } from '../types';

describe('TerminologyNormalizer', () => {
  it('extracts concepts in English', () => {
    const text = 'I have severe chest pain and a mild headache';
    const concepts = TerminologyNormalizer.extractConcepts(text);
    const conceptIds = concepts.map(c => c.concept);
    expect(conceptIds).toContain('CHEST_PAIN');
    expect(conceptIds).toContain('HEADACHE');
  });

  it('extracts concepts in Hindi', () => {
    const text = 'mujhe bahut tez pet dard aur bukhar hai';
    const concepts = TerminologyNormalizer.extractConcepts(text);
    const conceptIds = concepts.map(c => c.concept);
    expect(conceptIds).toContain('ABDOMINAL_PAIN');
    expect(conceptIds).toContain('FEVER');
  });

  it('extracts concepts in Nepali', () => {
    const text = 'mero tauko dukhcha ra jworo aako cha';
    const concepts = TerminologyNormalizer.extractConcepts(text);
    const conceptIds = concepts.map(c => c.concept);
    expect(conceptIds).toContain('HEADACHE');
    expect(conceptIds).toContain('FEVER');
  });
});

describe('SafetyRuleEngine', () => {
  it('flags emergency for severe single red flag', () => {
    const assessment: PatientSymptomAssessment = {
      symptoms: ['I have severe chest pain'],
      bodyRegions: [],
      duration: null,
      severity: 'severe',
      onset: null,
      language: 'en',
      redFlags: [],
      confidence: 1,
      source: 'offline_ai'
    };
    const evaluation = SafetyRuleEngine.evaluate(assessment);
    expect(evaluation.isEmergency).toBe(true);
    expect(evaluation.recommendedSpecialty).toBe('Cardiology');
  });

  it('flags emergency for unmapped red flag fallback', () => {
    const assessment: PatientSymptomAssessment = {
      symptoms: ['Something unknown is happening'],
      bodyRegions: [],
      duration: null,
      severity: null,
      onset: null,
      language: 'en',
      redFlags: ['Patient is non-responsive'],
      confidence: 1,
      source: 'offline_ai'
    };
    const evaluation = SafetyRuleEngine.evaluate(assessment);
    expect(evaluation.isEmergency).toBe(true);
    expect(evaluation.emergencyReason).toContain('Patient is non-responsive');
  });

  it('routes standard symptoms correctly', () => {
    const assessment: PatientSymptomAssessment = {
      symptoms: ['I have a rash on my arm'],
      bodyRegions: [],
      duration: null,
      severity: null,
      onset: null,
      language: 'en',
      redFlags: [],
      confidence: 1,
      source: 'offline_ai'
    };
    const evaluation = SafetyRuleEngine.evaluate(assessment);
    expect(evaluation.isEmergency).toBe(false);
    expect(evaluation.recommendedSpecialty).toBe('Dermatology');
  });
});
