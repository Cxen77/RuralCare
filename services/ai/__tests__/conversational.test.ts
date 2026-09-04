import { AIService } from '../AIService';
import { ModelManager } from '../ModelManager';
import { StorageService } from '../../storageService';
import { TriageStateMachine } from '../TriageStateMachine';

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));
jest.mock('../../apiClient', () => ({
  apiClient: {
    aiTriage: jest.fn().mockResolvedValue({ text: 'Online AI response' }),
  },
}));
jest.mock('../../storageService');
jest.mock('../ModelManager', () => {
  return {
    ModelManager: {
      getInstance: jest.fn().mockReturnValue({
        getStatus: jest.fn().mockReturnValue('MODEL_NOT_INSTALLED'),
        getActiveModelName: jest.fn().mockReturnValue('SmolLM2-360M-Instruct'),
        generateCompletion: jest.fn().mockResolvedValue('How long have you had these symptoms?'),
        generateChatCompletion: jest.fn().mockResolvedValue('How long have you had these symptoms?'),
      }),
    },
  };
});

describe('RuralCare Offline AI Triage Flow (Hybrid State Machine)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TriageStateMachine.reset();
  });

  it('TEST 1: "I have a fever and cough" - Asks follow-up questions, does NOT immediately recommend doctor', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    const result = await AIService.processPatientMessage('I have a fever and cough', []);
    
    expect(result.isEmergency).toBe(false);
    expect(result.text).toMatch(/how many days|fever|breathing/i);
    // Must NOT show doctor recommendation card on initial mention
    expect(result.readyForDoctorMatch).toBe(false);
    expect(result.suggestedQuestions.length).toBeGreaterThan(0);
  });

  it('TEST 2: "I hurt my leg" - Asks how the injury happened and where it hurts', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    const result = await AIService.processPatientMessage('I hurt my leg', []);
    
    expect(result.isEmergency).toBe(false);
    expect(result.text.toLowerCase()).toMatch(/fall|cut|hit|twist|where/i);
    expect(result.readyForDoctorMatch).toBe(false);
  });

  it('TEST 3: "I fell and hurt my knee" - Asks about pain severity, swelling, and walking/movement', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    const result = await AIService.processPatientMessage('I fell and hurt my knee', []);
    
    expect(result.isEmergency).toBe(false);
    expect(result.text.toLowerCase()).toMatch(/1 to 10|pain|swelling|walking|standing/i);
    expect(result.readyForDoctorMatch).toBe(false);
  });

  it('TEST 4: "Severe headache" - Asks headache questions and NEVER mentions pregnancy or pre-eclampsia', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    const result = await AIService.processPatientMessage('Severe headache', []);
    
    expect(result.isEmergency).toBe(false);
    expect(result.text.toLowerCase()).toMatch(/headache|start|severe|vision|vomiting/i);
    // Strict Guard: Must NOT mention pregnancy or pre-eclampsia when user did not mention it
    expect(result.text.toLowerCase()).not.toContain('pregnant');
    expect(result.text.toLowerCase()).not.toContain('pregnancy');
    expect(result.text.toLowerCase()).not.toContain('pre-eclampsia');
    expect(result.text.toLowerCase()).not.toContain('diabetes');
    expect(result.readyForDoctorMatch).toBe(false);
  });

  it('TEST 5: "I can\'t breathe properly" - Emergency/urgent guidance takes priority', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    const result = await AIService.processPatientMessage("I can't breathe properly", []);
    
    expect(result.isEmergency).toBe(true);
    expect(result.text).toMatch(/Emergency Alert|Breathing Difficulty|SOS/i);
    expect(result.readyForDoctorMatch).toBe(false);
  });

  it('TEST 6: Multi-turn complete triage - Produces structured triage summary and displays doctor card', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    // Turn 1
    await AIService.processPatientMessage('I fell and hurt my knee', []);

    // Turn 2
    const history = [
      { sender: 'user', text: 'I fell and hurt my knee' },
      { sender: 'ai', text: 'How bad is the pain from 1 to 10? Is there swelling, bleeding, or difficulty walking?' }
    ];
    const turn2Result = await AIService.processPatientMessage('My knee, pain is 7/10, there is swelling and I cannot walk', history);

    expect(turn2Result.isEmergency).toBe(false);
    expect(turn2Result.readyForDoctorMatch).toBe(true);
    expect(turn2Result.recommendedSpecialty).toBe('Orthopedics');
    expect(turn2Result.structuredSummary).toBeDefined();
    expect(turn2Result.structuredSummary?.chiefComplaint).toMatch(/knee/i);
    expect(turn2Result.structuredSummary?.cause).toBe('Fall');
    expect(turn2Result.structuredSummary?.severity).toBe('7/10');
    expect(turn2Result.structuredSummary?.swelling).toBe(true);
    expect(turn2Result.structuredSummary?.difficultyWalking).toBe(true);
    expect(turn2Result.formattedTriageNote).toContain('Complaint:');
    expect(turn2Result.formattedTriageNote).toContain('Orthopedics');
  });

  it('TEST 7: Reset clears triage conversation state completely', async () => {
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(false);

    // Fill state
    await AIService.processPatientMessage('I hurt my leg', []);
    expect(TriageStateMachine.getState().chiefComplaint).toBeDefined();

    // Reset
    TriageStateMachine.reset();
    const cleanState = TriageStateMachine.getState();
    expect(cleanState.chiefComplaint).toBeNull();
    expect(cleanState.category).toBeNull();
    expect(cleanState.turnCount).toBe(0);
    expect(cleanState.readyForDoctorMatch).toBe(false);
  });
});
