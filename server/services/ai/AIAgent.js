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

const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `You are RuralCare AI, an empathetic, highly capable clinical AI assistant for patients and rural health workers in India.
You have access to real RuralCare backend tools that query the live database and Geoapify routing services.

CRITICAL RULES:
1. NEVER invent or hallucinate doctors, clinics, pharmacies, medicine availability, coordinates, distances, travel times, or prescriptions.
2. ALWAYS use the provided backend tools whenever real medical, doctor, clinic, pharmacy, prescription, or route information is needed.
3. If a patient describes symptoms, first identify urgency and appropriate specialist (e.g. using recommendSpecialty or analyzeSymptoms). Then search for real nearby specialists using findSpecialists or findDoctors.
4. If a patient asks about prescription medicines or pharmacies, use getPrescription, extractPrescriptionMedicines, or findPharmaciesWithMedicines to retrieve real inventory.
5. If a patient needs travel directions, use calculateRoute or calculateMultiWaypointRoute (e.g. Patient -> Doctor -> Pharmacy).
6. NEVER diagnose definitively and never alter a prescription.
7. If life-threatening symptoms (chest pain, stroke, breathing failure, severe hemorrhage) are detected, prioritize immediate SOS 108 ambulance advice.
8. Keep conversational explanations polite, clear, and reassuring (2 to 3 sentences in conversational response). The system will automatically render your tool results as rich interactive cards in the mobile app.`;

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

    // 3. Obtain active provider & fallback provider
    let provider = ProviderFactory.getActiveProvider();
    const fallbackProvider = ProviderFactory.getFallbackProvider();

    // If no provider is configured with an API key, use deterministic fallback
    if (!provider.isConfigured() && (!fallbackProvider || !fallbackProvider.isConfigured())) {
      console.warn('[AIAgent] No AI provider API key found. Using deterministic guideline fallback.');
      return this.runDeterministicFallback(trimmedMessage, convId, context);
    }

    const tools = ToolRegistry.getOpenAIToolDefinitions();
    const collectedData = {
      doctors: [],
      pharmacies: [],
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

      try {
        response = await provider.chat({
          messages,
          tools,
          systemPrompt: SYSTEM_PROMPT
        });
      } catch (providerErr) {
        console.warn(`[AIAgent] Provider "${provider.name}" error on iteration ${iterations}:`, providerErr.message);

        // Try fallback provider if configured
        if (fallbackProvider && fallbackProvider.isConfigured() && fallbackProvider.name !== provider.name) {
          try {
            console.log(`[AIAgent] 🔄 Shifting to fallback provider: "${fallbackProvider.name}"`);
            response = await fallbackProvider.chat({
              messages,
              tools,
              systemPrompt: SYSTEM_PROMPT
            });
            provider = fallbackProvider; // Continue with fallback
          } catch (fallbackErr) {
            console.error(`[AIAgent] Fallback provider "${fallbackProvider.name}" also failed:`, fallbackErr.message);
            break;
          }
        } else {
          break;
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
          function: { name: tc.name, arguments: JSON.stringify(tc.args) }
        }))
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
    }
  }

  static detectIntent(collectedData, message) {
    if (collectedData.requiresUrgentCare) return 'emergency';
    if (collectedData.confirmationNeeded) return 'appointment_confirmation';
    if (collectedData.route) return 'route';
    if (collectedData.pharmacies.length > 0) return 'pharmacy_search';
    if (collectedData.doctors.length > 0) return 'doctor_search';
    if (collectedData.specialty) return 'symptom_assessment';
    return 'general_question';
  }

  static generateSummaryFromData(data, userInput) {
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
    return 'Thank you for your message. Please share more details so I can assist you with clinical triage or finding doctors and pharmacies.';
  }

  /**
   * Deterministic Fallback when external AI providers are offline or not configured.
   */
  static async runDeterministicFallback(userInput, convId, context) {
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
