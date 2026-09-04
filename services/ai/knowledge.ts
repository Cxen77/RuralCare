/**
 * RuralCare AI - Local RAG Knowledge Base
 * Small curated local healthcare information database.
 * Used for safe, deterministic information retrieval before hitting the LLM.
 */

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  language: 'en' | 'hi' | 'ne';
  category: 'hydration' | 'fever' | 'cold' | 'emergency' | 'general_prevention';
  lastReviewedAt: string;
  source: string;
}

export const LOCAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  // ─── ENGLISH ─────────────────────────────────────────────────────────────
  {
    id: 'kb_en_fever_01',
    title: 'Basic Fever Management',
    content: 'For a mild fever (below 102°F or 38.9°C), rest and drink plenty of fluids to stay hydrated. A lukewarm sponge bath can help cool the body. If the fever lasts more than 3 days, or is accompanied by severe headache, stiff neck, or breathing difficulty, seek immediate medical attention.',
    language: 'en',
    category: 'fever',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },
  {
    id: 'kb_en_hydration_01',
    title: 'Hydration Guidelines',
    content: 'Drink at least 8 glasses of clean water daily. If experiencing diarrhea or vomiting, use Oral Rehydration Salts (ORS) mixed with clean, boiled water to prevent severe dehydration.',
    language: 'en',
    category: 'hydration',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },
  {
    id: 'kb_en_emergency_01',
    title: 'When to seek emergency care',
    content: 'Immediately contact emergency services (108) or go to the nearest hospital if you experience: chest pain, severe difficulty breathing, sudden weakness or numbness, severe bleeding, or loss of consciousness.',
    language: 'en',
    category: 'emergency',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },
  {
    id: 'kb_en_cold_01',
    title: 'Managing Cold and Cough',
    content: 'Rest, stay hydrated, and use steam inhalation to relieve nasal congestion. Avoid cold drinks. If a cough persists for more than 2 weeks, or produces blood, consult a doctor to rule out serious infections like Tuberculosis.',
    language: 'en',
    category: 'cold',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },

  // ─── HINDI ───────────────────────────────────────────────────────────────
  {
    id: 'kb_hi_fever_01',
    title: 'बुखार का घरेलू प्रबंधन (Fever Management)',
    content: 'हल्के बुखार के लिए आराम करें और खूब पानी पिएं। शरीर को ठंडा करने के लिए गुनगुने पानी की पट्टियां रख सकते हैं। यदि बुखार 3 दिन से अधिक रहता है, या इसके साथ तेज सिरदर्द, सांस लेने में तकलीफ हो, तो तुरंत डॉक्टर से संपर्क करें।',
    language: 'hi',
    category: 'fever',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },
  {
    id: 'kb_hi_hydration_01',
    title: 'पानी की कमी (Dehydration)',
    content: 'दिन में कम से कम 8 गिलास साफ पानी पिएं। यदि दस्त या उल्टी हो रही हो, तो ओआरएस (ORS) का घोल उबले हुए साफ पानी में मिलाकर पिएं।',
    language: 'hi',
    category: 'hydration',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },

  // ─── NEPALI ──────────────────────────────────────────────────────────────
  {
    id: 'kb_ne_fever_01',
    title: 'ज्वरो व्यवस्थापन (Fever Management)',
    content: 'सामान्य ज्वरोको लागि प्रशस्त पानी पिउनुहोस् र आराम गर्नुहोस्। मनतातो पानीको पट्टि लगाउन सकिन्छ। यदि ज्वरो ३ दिनभन्दा बढी रह्यो, वा सास फेर्न गाह्रो भयो भने तुरुन्त डाक्टरलाई देखाउनुहोस्।',
    language: 'ne',
    category: 'fever',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },
  {
    id: 'kb_ne_hydration_01',
    title: 'जलवियोजन (Dehydration)',
    content: 'दिनमा कम्तीमा ८ गिलास सफा पानी पिउनुहोस्। यदि पखाला वा बान्ता भएको छ भने जीवनजल (ORS) उमालेर सेलाएको पानीमा मिसाएर पिउनुहोस्।',
    language: 'ne',
    category: 'hydration',
    lastReviewedAt: '2025-10-01T00:00:00Z',
    source: 'RuralCare Clinical Guidelines v1',
  },
];

export class KnowledgeRetriever {
  /**
   * Simple keyword-based search over the local knowledge base.
   */
  public static search(query: string, preferredLanguage: 'en' | 'hi' | 'ne' = 'en'): KnowledgeItem[] {
    const q = query.toLowerCase();
    
    // 1. Filter by language (fallback to English if no results)
    let candidates = LOCAL_KNOWLEDGE_BASE.filter(item => item.language === preferredLanguage);
    
    // 2. Score based on title and content matches
    const scored = candidates.map(item => {
      let score = 0;
      if (item.title.toLowerCase().includes(q)) score += 3;
      if (item.content.toLowerCase().includes(q)) score += 1;
      
      // Bonus if category matches closely
      if (q.includes(item.category)) score += 2;

      return { item, score };
    });

    const results = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.item);
    
    // Fallback to English if no local language results exist
    if (results.length === 0 && preferredLanguage !== 'en') {
       return this.search(query, 'en');
    }

    return results;
  }
}
