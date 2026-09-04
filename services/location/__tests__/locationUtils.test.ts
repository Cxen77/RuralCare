import { calculateDistanceKm, openDirections } from '../locationUtils';
import { Linking, Platform } from 'react-native';

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    openURL: jest.fn(() => Promise.resolve()),
  },
  Platform: {
    OS: 'android',
    select: jest.fn((dict: any) => dict.android || dict.default),
  },
}));

describe('Location Utilities', () => {
  describe('calculateDistanceKm', () => {
    it('calculates accurate distance between Ramnagar and Hajipur (approx 33-35 km)', () => {
      // Ramnagar: 25.9856 N, 85.2281 E
      // Hajipur: 25.6858 N, 85.2146 E
      const distance = calculateDistanceKm(25.9856, 85.2281, 25.6858, 85.2146);
      expect(distance).toBeGreaterThan(30);
      expect(distance).toBeLessThan(40);
      expect(distance).toBe(33.4);
    });

    it('returns 0 for identical coordinates', () => {
      const distance = calculateDistanceKm(25.9856, 85.2281, 25.9856, 85.2281);
      expect(distance).toBe(0);
    });

    it('handles invalid or undefined inputs gracefully without throwing', () => {
      expect(calculateDistanceKm(NaN as any, 85, 25, 85)).toBe(0);
      expect(calculateDistanceKm(25, undefined as any, 25, 85)).toBe(0);
      expect(calculateDistanceKm(null as any, 85, 25, 85)).toBe(0);
    });
  });

  describe('openDirections', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calls Linking.canOpenURL with android geo scheme', async () => {
      openDirections(25.9856, 85.2281, 'Ramnagar PHC');
      expect(Linking.canOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('geo:0,0?q=25.9856,85.2281(Ramnagar%20PHC)')
      );
    });
  });
});
