/**
 * Medical Understanding Tools
 * 
 * Supports structured clinical symptom assessment and specialty recommendations.
 * NEVER provides definitive diagnoses. All decisions remain with qualified doctors.
 */

const SPECIALTY_MAPPINGS = [
  {
    specialty: 'Cardiology',
    keywords: ['chest pain', 'heart', 'palpitation', 'angina', 'shortness of breath with chest pressure'],
    urgency: 'high',
    reason: 'Symptoms may involve cardiac or vascular function and warrant specialized cardiovascular examination.'
  },
  {
    specialty: 'Orthopedics',
    keywords: ['bone', 'joint', 'knee', 'fracture', 'sprain', 'back pain', 'spine', 'shoulder pain', 'hip', 'swollen leg after fall'],
    urgency: 'medium',
    reason: 'Musculoskeletal or joint-related symptoms warrant examination by an orthopedic specialist.'
  },
  {
    specialty: 'Dermatology',
    keywords: ['skin', 'rash', 'itching', 'itch', 'eczema', 'allergy', 'boil', 'acne', 'pigmentation', 'lesion', 'hive'],
    urgency: 'routine',
    reason: 'Skin surface lesions, rashes, or chronic itching are best evaluated by a dermatologist.'
  },
  {
    specialty: 'ENT',
    keywords: ['ear', 'throat', 'gala', 'kaan', 'hearing', 'tonsil', 'sinus', 'hoarse', 'sore throat'],
    urgency: 'routine',
    reason: 'Ear, nose, and throat discomfort should be evaluated by an ENT specialist.'
  },
  {
    specialty: 'Ophthalmology',
    keywords: ['eye', 'vision', 'blur', 'aankh', 'conjunctivitis', 'red eye', 'cataract'],
    urgency: 'medium',
    reason: 'Visual changes or ocular discomfort require targeted ophthalmic assessment.'
  },
  {
    specialty: 'Dentistry',
    keywords: ['tooth', 'teeth', 'dental', 'daant', 'gum', 'cavity', 'jaw pain'],
    urgency: 'routine',
    reason: 'Dental pain or gum irritation requires direct dental inspection.'
  },
  {
    specialty: 'General Medicine',
    keywords: ['fever', 'cough', 'cold', 'stomach', 'belly', 'abdomen', 'headache', 'fatigue', 'vomiting', 'loose motion', 'diarrhea', 'nausea'],
    urgency: 'routine',
    reason: 'Constitutional and systemic symptoms are best addressed first by a General Medicine physician at the PHC.'
  }
];

const medicalTools = {
  analyzeSymptoms: {
    name: 'analyzeSymptoms',
    description: 'Performs structured clinical triage analysis on symptoms, evaluating duration, severity level, affected body system, and red flag warnings.',
    parameters: {
      type: 'object',
      properties: {
        symptoms: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of observed or described symptoms'
        },
        duration: {
          type: 'string',
          description: 'How long symptoms have persisted (e.g. "2 days", "since yesterday", "3 weeks")'
        },
        severity: {
          type: 'string',
          enum: ['mild', 'moderate', 'severe'],
          description: 'Self-reported or estimated severity level'
        },
        context: {
          type: 'string',
          description: 'Any relevant mechanism of injury or environmental context (e.g. "fell from bike")'
        }
      },
      required: ['symptoms']
    },
    execute: async (args) => {
      const { symptoms = [], duration = 'unspecified', severity = 'moderate', context = '' } = args;
      const combinedText = `${symptoms.join(' ')} ${context}`.toLowerCase();

      // Check red flags
      const isRedFlag = /(chest pain|cannot breathe|can't breathe|heavy bleeding|unconscious|fainted|paralysis|stroke|vomiting blood)/i.test(combinedText);
      const isUrgent = isRedFlag || severity === 'severe';

      return {
        symptomsCount: symptoms.length,
        symptomsAnalyzed: symptoms,
        duration,
        estimatedSeverity: severity,
        contextProvided: context,
        isPotentiallyUrgent: isUrgent,
        urgencyLevel: isRedFlag ? 'emergency' : isUrgent ? 'high' : 'routine',
        advisoryNote: 'This preliminary analysis is for clinical triage sorting only and does not constitute a formal medical diagnosis.'
      };
    }
  },

  recommendSpecialty: {
    name: 'recommendSpecialty',
    description: 'Determines the appropriate medical specialty (e.g. Dermatology, Orthopedics, Cardiology, ENT) based on symptoms, providing clinical reasoning and urgency rating.',
    parameters: {
      type: 'object',
      properties: {
        symptoms: {
          type: 'string',
          description: 'Description of patient symptoms or chief complaint'
        },
        suspectedSpecialty: {
          type: 'string',
          description: 'Optional specialty candidate to validate'
        }
      },
      required: ['symptoms']
    },
    execute: async (args) => {
      const { symptoms, suspectedSpecialty } = args;
      const text = (symptoms || '').toLowerCase();

      if (suspectedSpecialty) {
        const found = SPECIALTY_MAPPINGS.find(s => s.specialty.toLowerCase() === suspectedSpecialty.toLowerCase());
        if (found) {
          return {
            specialty: found.specialty,
            reason: found.reason,
            urgency: found.urgency
          };
        }
      }

      for (const mapping of SPECIALTY_MAPPINGS) {
        for (const kw of mapping.keywords) {
          if (text.includes(kw)) {
            return {
              specialty: mapping.specialty,
              reason: mapping.reason,
              urgency: mapping.urgency
            };
          }
        }
      }

      return {
        specialty: 'General Medicine',
        reason: 'A Primary Health Centre General Medicine practitioner can assess non-specific or multi-system symptoms and refer if needed.',
        urgency: 'routine'
      };
    }
  }
};

module.exports = medicalTools;
