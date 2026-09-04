/**
 * RuralCare AI - Medical Terminology Normalization
 * Supports English, Hindi, and Nepali.
 * Maps patient informal input to a canonical medical concept.
 */

export interface TerminologyConcept {
  concept: string; // e.g. "ABDOMINAL_PAIN"
  aliases: {
    en: string[];
    hi: string[];
    ne: string[];
  };
  bodyRegion: string;
  recommendedSpecialty: string;
  isEmergencyRelevant: boolean;
}

export const MEDICAL_TERMINOLOGY: TerminologyConcept[] = [
  {
    concept: 'ABDOMINAL_PAIN',
    aliases: {
      en: ['stomach pain', 'belly pain', 'abdominal pain', 'tummy ache', 'stomach ache'],
      hi: ['पेट दर्द', 'पेट में दर्द', 'pet dard', 'pet me dard'],
      ne: ['पेट दुख्ने', 'पेट दुखाइ', 'pet dukhcha', 'pet dukhiracha', 'pet dukhya'],
    },
    bodyRegion: 'abdomen',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'HEADACHE',
    aliases: {
      en: ['headache', 'head pain', 'migraine', 'head hurts'],
      hi: ['सिर दर्द', 'सर दर्द', 'sir dard', 'sar me dard'],
      ne: ['टाउको दुख्ने', 'टाउको दुखाइ', 'tauko dukhcha', 'tauko dukhiracha'],
    },
    bodyRegion: 'head',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'FEVER',
    aliases: {
      en: ['fever', 'temperature', 'hot body', 'running a temperature', 'feverish'],
      hi: ['बुखार', 'तापमान', 'bukhar', 'tapman', 'garam sharir'],
      ne: ['ज्वरो', 'jworo', 'jwaro', 'aang tateko'],
    },
    bodyRegion: 'systemic',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'COUGH',
    aliases: {
      en: ['cough', 'coughing', 'dry cough', 'wet cough', 'hacking'],
      hi: ['खांसी', 'khansi', 'khasi'],
      ne: ['खोकी', 'khoki', 'khokna'],
    },
    bodyRegion: 'respiratory',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'COLD',
    aliases: {
      en: ['cold', 'runny nose', 'sneezing', 'sniffles', 'stuffy nose'],
      hi: ['सर्दी', 'जुकाम', 'sardi', 'zukam', 'naak behna'],
      ne: ['रुघा', 'रुघाखोकी', 'rugha', 'rughakhoki'],
    },
    bodyRegion: 'respiratory',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'SORE_THROAT',
    aliases: {
      en: ['sore throat', 'throat pain', 'swallowing pain', 'scratchy throat'],
      hi: ['गले में दर्द', 'खराश', 'gale me dard', 'gale me kharash', 'gala kharab'],
      ne: ['घाँटी दुख्ने', 'ghanti dukhcha', 'ghanti dukhya'],
    },
    bodyRegion: 'throat',
    recommendedSpecialty: 'ENT',
    isEmergencyRelevant: false,
  },
  {
    concept: 'CHEST_PAIN',
    aliases: {
      en: ['chest pain', 'heart pain', 'chest tightness', 'heavy chest', 'chest pressure'],
      hi: ['सीने में दर्द', 'छाती में दर्द', 'chhati me dard', 'seene me dard'],
      ne: ['छाती दुख्ने', 'chhati dukhcha', 'chhati dukhiracha'],
    },
    bodyRegion: 'chest',
    recommendedSpecialty: 'Cardiology',
    isEmergencyRelevant: true,
  },
  {
    concept: 'SHORTNESS_OF_BREATH',
    aliases: {
      en: ['shortness of breath', 'can\'t breathe', 'hard to breathe', 'breathless', 'wheezing', 'panting'],
      hi: ['सांस लेने में तकलीफ', 'सांस फूलना', 'saans lene me dikkat', 'saans phoolna'],
      ne: ['सास फेर्न गाह्रो', 'saas ferna garho', 'saas rokine', 'saas ferna gaaro'],
    },
    bodyRegion: 'respiratory',
    recommendedSpecialty: 'Cardiology', // Often triaged to ED/Cardio/Pulmo
    isEmergencyRelevant: true,
  },
  {
    concept: 'BACK_PAIN',
    aliases: {
      en: ['back pain', 'backache', 'lower back pain', 'spine pain'],
      hi: ['कमर दर्द', 'पीठ दर्द', 'kamar dard', 'peeth dard'],
      ne: ['कम्मर दुख्ने', 'ढाड दुख्ने', 'kammar dukhcha', 'dhad dukhcha'],
    },
    bodyRegion: 'back',
    recommendedSpecialty: 'Orthopedics',
    isEmergencyRelevant: false,
  },
  {
    concept: 'JOINT_PAIN',
    aliases: {
      en: ['joint pain', 'knee pain', 'shoulder pain', 'aching joints'],
      hi: ['जोड़ों का दर्द', 'घुटने में दर्द', 'jodo ka dard', 'ghutne me dard'],
      ne: ['जोर्नी दुख्ने', 'jorni dukhcha', 'ghuda dukhcha'],
    },
    bodyRegion: 'musculoskeletal',
    recommendedSpecialty: 'Orthopedics',
    isEmergencyRelevant: false,
  },
  {
    concept: 'DIARRHEA',
    aliases: {
      en: ['diarrhea', 'loose motion', 'loose stools', 'watery stool', 'the runs'],
      hi: ['दस्त', 'पतले दस्त', 'dast', 'loose motion', 'pet kharab'],
      ne: ['पखाला', 'pakhala', 'pakhala lageko'],
    },
    bodyRegion: 'digestive',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'VOMITING',
    aliases: {
      en: ['vomiting', 'throwing up', 'puking', 'vomit'],
      hi: ['उल्टी', 'ulti', 'ulti aana'],
      ne: ['बान्ता', 'banta', 'banta aako'],
    },
    bodyRegion: 'digestive',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'NAUSEA',
    aliases: {
      en: ['nausea', 'feel sick', 'queasy', 'nauseous'],
      hi: ['जी मिचलाना', 'उबकाई', 'ji machlana', 'ubkai', 'ulti jaisa lagna'],
      ne: ['वाकवाकी', 'wakwaki', 'waka waka'],
    },
    bodyRegion: 'digestive',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'SKIN_RASH',
    aliases: {
      en: ['rash', 'skin rash', 'itching', 'hives', 'red spots', 'itchy skin'],
      hi: ['खुजली', 'दाने', 'khujli', 'dane', 'tvacha par lal nishan'],
      ne: ['चिलाउने', 'chilayo', 'chilako', 'chilaune', 'daabar'],
    },
    bodyRegion: 'skin',
    recommendedSpecialty: 'Dermatology',
    isEmergencyRelevant: false,
  },
  {
    concept: 'EYE_PAIN',
    aliases: {
      en: ['eye pain', 'hurting eye', 'sore eye', 'red eye', 'blurry vision'],
      hi: ['आंख में दर्द', 'aankh me dard', 'aankh dard'],
      ne: ['आँखा दुख्ने', 'aankha dukhcha', 'aankha dukhiracha'],
    },
    bodyRegion: 'eye',
    recommendedSpecialty: 'Ophthalmology',
    isEmergencyRelevant: false,
  },
  {
    concept: 'EAR_PAIN',
    aliases: {
      en: ['ear pain', 'earache', 'ear hurting', 'ringing in ear'],
      hi: ['कान में दर्द', 'kaan me dard', 'kaan dard'],
      ne: ['कान दुख्ने', 'kaan dukhcha'],
    },
    bodyRegion: 'ear',
    recommendedSpecialty: 'ENT',
    isEmergencyRelevant: false,
  },
  {
    concept: 'TOOTH_PAIN',
    aliases: {
      en: ['tooth pain', 'toothache', 'dental pain', 'gum pain', 'jaw pain'],
      hi: ['दांत में दर्द', 'दांत दर्द', 'daant me dard', 'daant dard'],
      ne: ['दाँत दुख्ने', 'daat dukhcha', 'daant dukhya'],
    },
    bodyRegion: 'mouth',
    recommendedSpecialty: 'Dentistry',
    isEmergencyRelevant: false,
  },
  {
    concept: 'URINARY_PROBLEM',
    aliases: {
      en: ['urinary problem', 'burning pee', 'painful urination', 'UTI', 'blood in urine'],
      hi: ['पेशाब में जलन', 'पेशाब की समस्या', 'peshab me jalan', 'peshab me dikkat'],
      ne: ['पिसाब पोल्ने', 'pisab polcha', 'pisab polne'],
    },
    bodyRegion: 'urinary',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'LIMB_INJURY',
    aliases: {
      en: ['hurt my leg', 'hurt my arm', 'hurt my knee', 'hurt my foot', 'leg injury', 'arm injury', 'knee injury', 'twisted ankle', 'sprained ankle', 'fracture', 'broken bone', 'fell down and hurt', 'leg pain', 'knee pain', 'arm pain', 'cannot walk', 'can\'t walk', 'foot pain', 'shoulder pain'],
      hi: ['पैर में चोट', 'हाथ में चोट', 'घुटना दर्द', 'पैर दर्द', 'chot lag gayi', 'pair me dard', 'ghutne me chot', 'gir gaya', 'hath me dard', 'chal nahi pa raha'],
      ne: ['खुट्टामा चोट', 'हातमा चोट', 'खुट्टा दुख्यो', 'ghuda ma chot', 'khutta dukhcha', 'hidna sakdina'],
    },
    bodyRegion: 'musculoskeletal',
    recommendedSpecialty: 'Orthopedics',
    isEmergencyRelevant: false,
  },
  {
    concept: 'CUT_WOUND',
    aliases: {
      en: ['cut', 'wound', 'bleeding', 'scraped', 'injury', 'laceration'],
      hi: ['कट गया', 'घाव', 'chot', 'ghav', 'khoon nikal raha'],
      ne: ['काट्यो', 'घाउ', 'ragat aayo', 'chot'],
    },
    bodyRegion: 'skin',
    recommendedSpecialty: 'General Medicine',
    isEmergencyRelevant: false,
  },
  {
    concept: 'LOSS_OF_CONSCIOUSNESS',
    aliases: {
      en: ['fainted', 'passed out', 'unconscious', 'blacked out', 'unresponsive'],
      hi: ['बेहोश', 'behoosh', 'behoshi', 'gir gaya aur uth nahi raha'],
      ne: ['बेहोश', 'behosh', 'hosh ma chaina'],
    },
    bodyRegion: 'systemic',
    recommendedSpecialty: 'Emergency',
    isEmergencyRelevant: true,
  },
  {
    concept: 'SEVERE_BLEEDING',
    aliases: {
      en: ['bleeding heavily', 'won\'t stop bleeding', 'blood everywhere', 'hemorrhaging'],
      hi: ['बहुत खून बह रहा है', 'khoon nahi ruk raha', 'bahut khoon'],
      ne: ['धेरै रगत बगिरहेको छ', 'ragat bageko bagyai cha', 'ragat narakieko'],
    },
    bodyRegion: 'systemic',
    recommendedSpecialty: 'Emergency',
    isEmergencyRelevant: true,
  }
];

export class TerminologyNormalizer {
  /**
   * Normalizes informal text into an array of matched TerminologyConcepts.
   * Simple substring matching strategy (can be expanded).
   */
  public static extractConcepts(text: string): TerminologyConcept[] {
    const normalizedText = text.toLowerCase();
    const matchedConcepts: TerminologyConcept[] = [];

    for (const term of MEDICAL_TERMINOLOGY) {
      const allAliases = [
        ...term.aliases.en,
        ...term.aliases.hi,
        ...term.aliases.ne,
      ].map(a => a.toLowerCase());

      // If any alias is found in the text, we mark this concept as extracted.
      for (const alias of allAliases) {
        if (normalizedText.includes(alias)) {
          matchedConcepts.push(term);
          break; // Avoid adding the same concept multiple times
        }
      }
    }

    return matchedConcepts;
  }

  public static getConceptById(conceptId: string): TerminologyConcept | undefined {
    return MEDICAL_TERMINOLOGY.find(t => t.concept === conceptId);
  }
}
