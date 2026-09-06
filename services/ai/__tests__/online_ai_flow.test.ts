import { AIService } from '../AIService';
import { StorageService } from '../../storageService';
import { apiClient } from '../../apiClient';

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
    aiChat: jest.fn(),
  },
}));
jest.mock('../../storageService');

describe('RuralCare Online AI Chatbot Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (StorageService.getOnlineStatus as jest.Mock).mockReturnValue(true);
  });

  it('TEST 1: "Hello" calls backend AI chat and returns welcome message', async () => {
    (apiClient.aiChat as jest.Mock).mockResolvedValue({
      message: 'Hello! Welcome to RuralCare. How can I assist you today?',
      intent: 'general_question',
      doctors: [],
      pharmacies: [],
      route: null,
      requiresUrgentCare: false,
    });

    const result = await AIService.processPatientMessage('Hello', [], 'online');

    expect(apiClient.aiChat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Hello' })
    );
    expect(result.text).toBe('Hello! Welcome to RuralCare. How can I assist you today?');
    expect(result.assessment.source).toBe('online_ai');
  });

  it('TEST 2: "I have a headache" sends symptom to backend AI and returns clinical guidance', async () => {
    (apiClient.aiChat as jest.Mock).mockResolvedValue({
      message: 'I understand you have a headache. Can you describe where it hurts?',
      intent: 'symptom_inquiry',
      specialty: 'General Medicine',
      requiresUrgentCare: false,
      doctors: [],
      pharmacies: [],
    });

    const result = await AIService.processPatientMessage('I have a headache', [], 'online');

    expect(apiClient.aiChat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'I have a headache' })
    );
    expect(result.text).toContain('headache');
    expect(result.assessment.source).toBe('online_ai');
  });

  it('TEST 3: "Find doctors near me" returns doctors array from online AI', async () => {
    (apiClient.aiChat as jest.Mock).mockResolvedValue({
      message: 'Here are nearby doctors at Ramnagar PHC.',
      intent: 'doctor_search',
      specialty: 'General Medicine',
      doctors: [
        {
          id: 'd1',
          name: 'Dr. Anita Sharma',
          specialty: 'General Medicine',
          clinic: 'Ramnagar PHC',
          distanceKm: 2.5,
        },
      ],
      pharmacies: [],
      route: null,
    });

    const result = await AIService.processPatientMessage('Find doctors near me', [], 'online', {
      latitude: 25.9892,
      longitude: 85.2345,
    });

    expect(apiClient.aiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Find doctors near me',
        location: { latitude: 25.9892, longitude: 85.2345 },
      })
    );
    expect(result.doctors).toBeDefined();
    expect(result.doctors?.length).toBe(1);
    expect(result.doctors?.[0].name).toBe('Dr. Anita Sharma');
    expect(result.assessment.source).toBe('online_ai');
  });

  it('TEST 4: Gracefully falls back to offline engine if online AI fails', async () => {
    (apiClient.aiChat as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await AIService.processPatientMessage('I hurt my leg', [], 'auto');

    expect(result.text).toBeDefined();
    // Falls back to offline state machine
    expect(result.assessment.source).toBe('offline_ai');
  });
});
