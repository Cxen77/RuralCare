/**
 * RuralCare Autonomous AI Agent Orchestrator
 * 
 * Manages the multi-step tool-calling reasoning loop, provider fallback,
 * context persistence, and structured response assembly.
 * 
 * Flow:
 * User Message
 *   ↓
 * Primary Provider (Groq / Gemini / OpenRouter / HuggingFace)
 *   ↓ (requests tool)
 * ToolRegistry Execution (MongoDB / Geoapify)
 *   ↓ (tool result)
 * AI continues reasoning (up to 5 iterations)
 *   ↓
 * Final Structured JSON Response
 */

const ProviderFactory = require('./providerFactory');
const { ToolRegistry } = require('./tools/toolRegistry');
const Conversation = require('../../models/Conversation');

const MAX_TOOL_ITERATIONS = 3;

const SYSTEM_PROMPT = `You are RuralCare AI, an empathetic, highly capable clinical AI assistant for patients and rural health workers in India.
You have access to real RuralCare backend tools that query the live database and Geoapify routing services.
Emergency red flags have already been checked deterministically before this step.

CRITICAL RULES:
1. NEVER invent or hallucinate doctors, clinics, pharmacies, hospitals, bed numbers, blood units, medicine availability, coordinates, distances, travel times, or prescriptions.
2. ALWAYS use the provided backend tools when real medical, doctor, clinic, pharmacy, hospital, bed availability, blood stock, prescription, or route information is needed.
3. If a patient asks about nearby hospitals, hospital beds (general, ICU, emergency, ventilator), emergency admission, or hospital blood stock, IMMEDIATELY call findNearbyHospitals or checkHospitalBedAvailability.
4. If a patient describes symptoms or asks for care, call findSpecialists or findDoctors directly in your first turn.
5. If a patient asks about medicines or pharmacies, use findPharmaciesWithMedicines or getPrescription.
6. Be fast and efficient: call needed tools in parallel on the first turn. As soon as you receive tool data, immediately provide your final clear, reassuring answer with the exact bed numbers, hospital names, and contact details from the database.
7. NEVER diagnose definitively and never alter a prescription.
8. If life-threatening symptoms (chest pain, stroke, breathing failure, severe hemorrhage) are described, advise calling SOS 108 immediately.`;

class AIAgent {
  /**
   * Executes an autonomous chat turn with multi-step tool execution.
   */
  static async runChatTurn({
    message,
    conversationId,
    location,
    user = null,
    history = []
  }) {
    const trimmedMessage = (message || '').trim();
    if (!trimmedMessage) {
      throw new Error('Message text is required');
    }

    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const patientId = user?.patientId || user?.sub || user?.id || null;
    const context = {
      conversationId: convId,
      user,
      patientId,
      location: location || null
    };

    // 1. Check for immediate life-threatening emergencies deterministically first
    const emergencyCheck = await ToolRegistry.executeTool('checkEmergencyRedFlags', { text: trimmedMessage }, context);
    if (emergencyCheck?.isEmergency) {
      const emergencyResponse = {
        message: emergencyCheck.advisory,
        intent: 'emergency',
        urgency: 'emergency',
        requiresUrgentCare: true,
        specialty: 'Emergency / Critical Care',
        emergencyDetails: emergencyCheck,
        doctors: [],
        pharmacies: [],
        hospitals: [],
        route: null,
        conversationId: convId
      };
      this.persistConversation(convId, patientId, trimmedMessage, emergencyResponse).catch(err => {
        console.warn('[AIAgent] Emergency persist warning:', err.message);
      });
      return emergencyResponse;
    }

    // 2. Load recent conversation messages
    const messages = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history.slice(-6)) {
        if (h.text) {
          messages.push({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: String(h.text)
          });
        }
      }
    } else if (conversationId) {
      try {
        const savedConv = await Conversation.findOne({ conversationId }).lean();
        if (savedConv && Array.isArray(savedConv.messages)) {
          for (const m of savedConv.messages.slice(-6)) {
            messages.push({ role: m.role, content: m.content });
          }
        }
      } catch (e) {
        // Continue if db load fails
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: trimmedMessage });

    // 3. Obtain provider chain in priority order (Groq -> Gemini -> OpenRouter)
    const providerChain = ProviderFactory.getProviderChain();
    let providerIndex = 0;
    let provider = providerChain[0];

    // If no provider is configured with an API key, use deterministic fallback
    if (!provider || !provider.isConfigured()) {
      console.warn('[AIAgent] No configured AI provider found. Using deterministic guideline fallback.');
      return this.runDeterministicFallback(trimmedMessage, convId, context);
    }

    const CORE_TOOL_NAMES = new Set([
      'analyzeSymptoms',
      'recommendSpecialty',
      'findDoctors',
      'findSpecialists',
      'getDoctorDetails',
      'getUserLocation',
      'findNearbyPharmacies',
      'findPharmaciesWithMedicines',
      'calculateRoute',
      'createAppointment',
      'getPrescription',
      'findNearbyHospitals',
      'checkHospitalBedAvailability',
      'checkEmergencyHospitalStatus',
      'checkHospitalBloodStock'
    ]);

    const tools = ToolRegistry.getOpenAIToolDefinitions().filter(t => CORE_TOOL_NAMES.has(t.function?.name));
    let systemPrompt = SYSTEM_PROMPT;
    if (context.location?.latitude && context.location?.longitude) {
      systemPrompt += `\nPATIENT LOCATION: Latitude ${context.location.latitude}, Longitude ${context.location.longitude}. Use these coordinates directly for doctor, clinic, hospital, bed, and pharmacy proximity searches.`;
    }

    const collectedData = {
      doctors: [],
      pharmacies: [],
      hospitals: [],
      hospitalReports: [],
      hospitalEmergency: null,
      hospitalBloodStock: null,
      route: null,
      specialty: null,
      urgency: 'routine',
      requiresUrgentCare: false,
      confirmationNeeded: null,
      toolsUsed: []
    };

    let iterations = 0;
    let finalAnswer = '';

    // ─── AUTONOMOUS TOOL CALLING LOOP ────────────────────────────────
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      let response = null;

      while (providerIndex < providerChain.length) {
        provider = providerChain[providerIndex];
        try {
          response = await provider.chat({
            messages,
            tools,
            systemPrompt
          });
          break; // Provider responded successfully
        } catch (providerErr) {
          console.warn(`[AIAgent] Provider "${provider.name}" error on iteration ${iterations}:`, providerErr.message);
          providerIndex++;
          if (providerIndex < providerChain.length) {
            console.log(`[AIAgent] 🔄 Shifting to next priority provider: "${providerChain[providerIndex].name}"`);
          }
        }
      }

      if (!response) break;

      const toolCalls = response.tool_calls || [];

      // If no tool calls requested, we have reached the final conversational answer
      if (toolCalls.length === 0) {
        finalAnswer = response.content || '';
        break;
      }

      // Add assistant message with tool calls to conversation history
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.raw_message?.tool_calls || toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          thoughtSignature: tc.thoughtSignature
        })),
        raw_parts: response.raw_parts
      });

      // Execute each tool call requested by the AI
      for (const tc of toolCalls) {
        collectedData.toolsUsed.push(tc.name);
        const toolResult = await ToolRegistry.executeTool(tc.name, tc.args, context);

        // Capture real data items into our structured response
        this.accumulateStructuredData(tc.name, toolResult, collectedData);

        // Append tool result message so the LLM can observe the real data
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          content: JSON.stringify(toolResult)
        });
      }
    }

    if (!finalAnswer && collectedData.doctors.length === 0 && collectedData.pharmacies.length === 0 && collectedData.hospitals.length === 0 && collectedData.hospitalReports.length === 0 && !collectedData.specialty) {
      console.warn('[AIAgent] AI providers produced no clinical data. Running deterministic fallback.');
      return this.runDeterministicFallback(trimmedMessage, convId, context);
    }

    if (!finalAnswer) {
      finalAnswer = this.generateSummaryFromData(collectedData, trimmedMessage);
    }

    // Determine high-level intent
    const intent = this.detectIntent(collectedData, trimmedMessage);

    const structuredResponse = {
      message: finalAnswer,
      intent,
      specialty: collectedData.specialty || 'General Medicine',
      urgency: collectedData.urgency,
      requiresUrgentCare: collectedData.requiresUrgentCare,
      doctors: collectedData.doctors,
      pharmacies: collectedData.pharmacies,
      hospitals: collectedData.hospitals,
      route: collectedData.route,
      confirmationNeeded: collectedData.confirmationNeeded,
      conversationId: convId,
      toolsUsed: collectedData.toolsUsed
    };

    // Persist conversation to MongoDB asynchronously if possible
    this.persistConversation(convId, context.patientId, trimmedMessage, structuredResponse).catch(err => {
      console.warn('[AIAgent] Conversation persist warning:', err.message);
    });

    return structuredResponse;
  }

  /**
   * Accumulates structured data returned by individual tools.
   */
  static accumulateStructuredData(toolName, result, collectedData) {
    if (!result || result.error) return;

    if (toolName === 'findDoctors' || toolName === 'findSpecialists') {
      if (Array.isArray(result)) {
        collectedData.doctors = result.map(d => ({
          id: d.doctorId || d.id,
          name: d.name,
          specialty: d.specialty,
          clinic: d.clinicName,
          address: d.clinicAddress,
          latitude: d.latitude,
          longitude: d.longitude,
          distanceKm: d.distanceKm,
          rating: d.rating || 4.8,
          fee: d.consultationFee || 0,
          ayushmanPaneled: d.ayushmanPaneled,
          teleconsultation: d.teleconsultation
        }));
      }
    } else if (toolName === 'getDoctorDetails' && result.found) {
      if (!collectedData.doctors.some(d => d.id === result.doctorId)) {
        collectedData.doctors.push({
          id: result.doctorId,
          name: result.name,
          specialty: result.specialty,
          clinic: result.clinicName,
          address: result.clinicAddress,
          latitude: result.latitude,
          longitude: result.longitude,
          fee: result.consultationFee
        });
      }
    } else if (toolName === 'recommendSpecialty') {
      collectedData.specialty = result.specialty;
      collectedData.urgency = result.urgency || 'routine';
    } else if (toolName === 'findNearbyPharmacies' && Array.isArray(result)) {
      collectedData.pharmacies = result.map(p => ({
        id: p.pharmacyId,
        name: p.name,
        address: p.address,
        distanceKm: p.distanceKm,
        isJanAushadhi: p.isJanAushadhi,
        phone: p.phone,
        latitude: p.latitude,
        longitude: p.longitude
      }));
    } else if (toolName === 'findPharmaciesWithMedicines' && Array.isArray(result)) {
      collectedData.pharmacies = result.map(p => ({
        id: p.pharmacyId,
        name: p.name,
        address: p.address,
        distanceKm: p.distanceKm,
        isJanAushadhi: p.isJanAushadhi,
        hasAllMedicines: p.hasAllMedicines,
        availableCount: p.availableCount,
        totalRequested: p.totalRequested,
        availabilityBreakdown: p.availabilityBreakdown,
        latitude: p.latitude,
        longitude: p.longitude
      }));
    } else if (toolName === 'findPharmaciesForPrescription' && Array.isArray(result.pharmacyOptions)) {
      collectedData.pharmacies = result.pharmacyOptions;
    } else if (toolName === 'calculateRoute' || toolName === 'calculateMultiWaypointRoute') {
      if (result.distanceMeters != null) {
        collectedData.route = {
          distanceMeters: result.distanceMeters,
          distanceKm: result.distanceKm,
          durationSeconds: result.durationSeconds,
          durationMinutes: result.durationMinutes,
          mode: result.mode,
          geometry: result.geometry,
          instructions: result.instructions || []
        };
      }
    } else if (toolName === 'checkEmergencyRedFlags' && result.isEmergency) {
      collectedData.requiresUrgentCare = true;
      collectedData.urgency = 'emergency';
    } else if (toolName === 'createAppointment' && result.status === 'confirmation_required') {
      collectedData.confirmationNeeded = {
        action: 'createAppointment',
        message: result.message,
        details: result.appointmentDetails
      };
    } else if (toolName === 'findNearbyHospitals') {
      if (Array.isArray(result?.hospitals)) {
        collectedData.hospitals = result.hospitals;
      }
    } else if (toolName === 'checkHospitalBedAvailability') {
      if (Array.isArray(result?.reports)) {
        collectedData.hospitalReports = result.reports;
        if (!collectedData.hospitals.length) {
          collectedData.hospitals = result.reports.map(r => ({
            id: r.hospitalId,
            name: r.name,
            address: r.address,
            phone: r.phone,
            availableBeds: r.bedsAvailable,
            totalCapacity: r.totalCapacity,
            acceptingEmergency: r.acceptingEmergency
          }));
        }
      }
    } else if (toolName === 'checkEmergencyHospitalStatus') {
      collectedData.hospitalEmergency = result;
      if (Array.isArray(result?.facilities) && !collectedData.hospitals.length) {
        collectedData.hospitals = result.facilities;
      }
    } else if (toolName === 'checkHospitalBloodStock') {
      collectedData.hospitalBloodStock = result;
    }
  }

  static detectIntent(collectedData, message) {
    if (collectedData.requiresUrgentCare) return 'emergency';
    if (collectedData.confirmationNeeded) return 'appointment_confirmation';
    if (collectedData.route) return 'route';
    if (collectedData.hospitalReports?.length > 0 || collectedData.hospitals?.length > 0 || collectedData.hospitalEmergency || collectedData.hospitalBloodStock) {
      return 'hospital_inquiry';
    }
    if (collectedData.pharmacies.length > 0) return 'pharmacy_search';
    if (collectedData.doctors.length > 0) return 'doctor_search';
    if (collectedData.specialty) return 'symptom_assessment';
    return 'general_question';
  }

  static generateSummaryFromData(data, userInput) {
    if (data.hospitalReports?.length > 0) {
      const topHosp = data.hospitalReports[0];
      const beds = topHosp.bedsAvailable || topHosp.beds || {};
      return `At **${topHosp.name}**, there are currently **${beds.general ?? 0}** general beds, **${beds.emergency ?? 0}** emergency beds, **${beds.icu ?? 0}** ICU beds, and **${beds.ventilator ?? 0}** ventilator beds available. Contact: ${topHosp.phone || '108'}.`;
    }
    if (data.hospitals?.length > 0) {
      const topHosp = data.hospitals[0];
      const beds = topHosp.availableBeds || {};
      return `At **${topHosp.name}**, there are **${beds.general ?? 0}** general beds, **${beds.emergency ?? 0}** emergency beds, and **${beds.icu ?? 0}** ICU beds available${topHosp.distanceKm ? ` (${topHosp.distanceKm} km away)` : ''}. Helpline: ${topHosp.emergencyHelpline || topHosp.phone || '108'}.`;
    }
    if (data.doctors.length > 0) {
      const topDoc = data.doctors[0];
      return `Based on your symptoms, a consultation with a **${data.specialty || topDoc.specialty}** specialist is recommended. I found **${topDoc.name}** at ${topDoc.clinic || 'PHC'}${topDoc.distanceKm ? ` (${topDoc.distanceKm} km away)` : ''}.`;
    }
    if (data.pharmacies.length > 0) {
      const topPh = data.pharmacies[0];
      return `I found verified pharmacies nearby. **${topPh.name}** is ${topPh.distanceKm ? `${topPh.distanceKm} km away` : 'nearby'}${topPh.hasAllMedicines ? ' and has all required medicines in stock' : ''}.`;
    }
    if (data.route) {
      return `The route is approximately ${data.route.distanceKm} km and takes about ${data.route.durationMinutes} minutes.`;
    }
    return 'Thank you for your message. Please share more details so I can assist you with clinical triage or finding doctors, hospitals, and pharmacies.';
  }

  /**
   * Deterministic Fallback when external AI providers are offline or not configured.
   */
  static async runDeterministicFallback(userInput, convId, context) {
    const lower = (userInput || '').toLowerCase();
    const isHospitalOrBedQuery = /hospital|bed|beds|icu|ventilator|admit|ward|chc|phc|trauma|emergency bay/i.test(lower);

    if (isHospitalOrBedQuery) {
      const bedReport = await ToolRegistry.executeTool('checkHospitalBedAvailability', {}, context);
      const hospitalList = await ToolRegistry.executeTool('findNearbyHospitals', {
        latitude: context?.location?.latitude,
        longitude: context?.location?.longitude
      }, context);

      const top = bedReport?.reports?.[0] || hospitalList?.hospitals?.[0];
      let msg = 'I checked our live hospital network database:';
      if (top) {
        const b = top.bedsAvailable || top.beds || top.availableBeds || {};
        msg = `Currently at **${top.name}**, there are **${b.general ?? 0}** General beds, **${b.emergency ?? 0}** Emergency beds, **${b.icu ?? 0}** ICU beds, and **${b.ventilator ?? 0}** Ventilator beds available. Contact: ${top.phone || '108'}.`;
      } else {
        msg = 'No hospital bed records were found in the database.';
      }

      const fallbackResult = {
        message: msg,
        intent: 'hospital_inquiry',
        specialty: 'Emergency / Inpatient Care',
        urgency: 'routine',
        requiresUrgentCare: false,
        hospitals: hospitalList?.hospitals || (top ? [top] : []),
        doctors: [],
        pharmacies: [],
        route: null,
        conversationId: convId,
        source: 'deterministic_fallback'
      };
      this.persistConversation(convId, context.patientId, userInput, fallbackResult).catch(err => {
        console.warn('[AIAgent] Deterministic fallback persist warning:', err.message);
      });
      return fallbackResult;
    }

    const spec = await ToolRegistry.executeTool('recommendSpecialty', { symptoms: userInput }, context);
    const docs = await ToolRegistry.executeTool('findDoctors', { specialty: spec.specialty }, context);

    const formattedDocs = (docs || []).slice(0, 3).map(d => ({
      id: d.doctorId || d.id,
      name: d.name,
      specialty: d.specialty,
      clinic: d.clinicName,
      address: d.clinicAddress,
      latitude: d.latitude,
      longitude: d.longitude,
      distanceKm: d.distanceKm
    }));

    const fallbackResult = {
      message: `Based on your description, a consultation with a **${spec.specialty}** doctor is recommended. Here are verified doctors nearby:`,
      intent: 'doctor_search',
      specialty: spec.specialty,
      urgency: spec.urgency || 'routine',
      requiresUrgentCare: false,
      doctors: formattedDocs,
      pharmacies: [],
      route: null,
      conversationId: convId,
      source: 'deterministic_fallback'
    };

    // Persist deterministic fallback conversations too
    this.persistConversation(convId, context.patientId, userInput, fallbackResult).catch(err => {
      console.warn('[AIAgent] Deterministic fallback persist warning:', err.message);
    });

    return fallbackResult;
  }

  static async persistConversation(conversationId, patientId, userMessage, agentResponse) {
    try {
      // Auto-generate a title from the first user message (truncated to 50 chars)
      const autoTitle = (userMessage || '').slice(0, 50).trim() || 'Untitled Conversation';

      const updateDoc = {
        $setOnInsert: {
          title: autoTitle
        },
        $push: {
          messages: {
            $each: [
              { role: 'user', content: userMessage, timestamp: new Date() },
              { role: 'assistant', content: agentResponse.message, timestamp: new Date() }
            ]
          }
        },
        $set: {
          lastActive: new Date(),
          'context.specialty': agentResponse.specialty,
          'context.doctorId': agentResponse.doctors?.[0]?.id
        }
      };

      if (patientId) {
        updateDoc.$set.patientId = patientId;
      }

      await Conversation.findOneAndUpdate(
        { conversationId },
        updateDoc,
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error('[AIAgent] persistConversation error:', e.message);
    }
  }
}

module.exports = AIAgent;
