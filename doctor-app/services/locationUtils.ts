import { Linking, Platform } from 'react-native';

/**
 * Calculates straight-line distance in kilometers between two coordinates using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    lat1 === undefined || lat1 === null || isNaN(lat1) ||
    lon1 === undefined || lon1 === null || isNaN(lon1) ||
    lat2 === undefined || lat2 === null || isNaN(lat2) ||
    lon2 === undefined || lon2 === null || isNaN(lon2)
  ) {
    return 0;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Opens native turn-by-turn navigation or directions using the user's installed map app.
 * Falls back safely to Google Maps web URL if no map application is registered.
 */
export function openDirections(lat: number, lng: number, label: string): void {
  const cleanLabel = encodeURIComponent(label || 'Medical Facility');
  const scheme = Platform.select({
    ios: `maps:0,0?q=${cleanLabel}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${cleanLabel})`,
  });

  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  if (scheme) {
    Linking.canOpenURL(scheme)
      .then((supported) => {
        if (supported) {
          Linking.openURL(scheme).catch(() => Linking.openURL(webUrl).catch(() => {}));
        } else {
          Linking.openURL(webUrl).catch(() => {});
        }
      })
      .catch(() => {
        Linking.openURL(webUrl).catch(() => {});
      });
  } else {
    Linking.openURL(webUrl).catch(() => {});
  }
}

// In-memory cache for reverse geocoding to avoid duplicate network requests
const reverseGeocodeCache = new Map<string, string>();

/**
 * Converts latitude and longitude coordinates into a human-readable address.
 * Uses OpenStreetMap Nominatim reverse geocoder with caching and rate limiting safety.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const roundedKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseGeocodeCache.has(roundedKey)) {
    return reverseGeocodeCache.get(roundedKey)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RuralCare-Doctor-App/1.0',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const village = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || addr.town || addr.city || '';
        const district = addr.county || addr.state_district || addr.district || '';
        const state = addr.state || '';

        let formatted = '';
        if (village && district) {
          formatted = `${village}, ${district}${state ? `, ${state}` : ''}`;
        } else {
          const parts = (data.display_name as string).split(',').map((s: string) => s.trim());
          formatted = parts.slice(0, 3).join(', ');
        }

        reverseGeocodeCache.set(roundedKey, formatted);
        return formatted;
      }
    }
  } catch {
    // Network / abort fallback
  }

  // Graceful coordinate fallback
  const fallback = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
  return fallback;
}
