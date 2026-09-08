import { Linking, Platform } from 'react-native';

export const DEFAULT_LOCATION = {
  latitude: 25.9856,
  longitude: 85.2281, // Ramnagar PHC Coordinates
  address: 'Ramnagar, Vaishali, Bihar',
};

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
let lastNominatimRequestTime = 0;

/**
 * Converts latitude and longitude coordinates into a human-readable address.
 * Uses Geoapify reverse geocoding when available (CORS-friendly, fast), with
 * graceful OpenStreetMap Nominatim fallback and rate-limiting / 429 protection.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<string> {
  const roundedKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseGeocodeCache.has(roundedKey)) {
    return reverseGeocodeCache.get(roundedKey)!;
  }

  const fallback = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
  if (signal?.aborted) return fallback;

  // 1. Primary: Geoapify reverse geocoder (CORS-friendly, reliable on web & native)
  const geoapifyKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;
  if (geoapifyKey) {
    try {
      const geoapifyUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${geoapifyKey}`;
      const res = await fetch(geoapifyUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        const feat = data?.features?.[0]?.properties;
        if (feat) {
          const formatted =
            feat.formatted ||
            [feat.address_line1, feat.city || feat.county, feat.state].filter(Boolean).join(', ') ||
            fallback;
          reverseGeocodeCache.set(roundedKey, formatted);
          return formatted;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return fallback;
      // If Geoapify fails, fall through to Nominatim
    }
  }

  // 2. Fallback: OpenStreetMap Nominatim with strict client rate limiting
  const now = Date.now();
  if (now - lastNominatimRequestTime < 1000) {
    // Avoid spamming Nominatim within 1 second window
    return fallback;
  }
  lastNominatimRequestTime = now;

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'RuralCare-Healthcare-Platform/1.0 (contact@ruralcare.org)',
        'Accept-Language': 'en',
      },
      signal,
    });

    if (res.status === 429) {
      console.warn('[reverseGeocode] Nominatim 429 Too Many Requests - using coordinate fallback');
      return fallback;
    }

    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const village =
          addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || addr.town || addr.city || '';
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
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) return fallback;
  }

  return fallback;
}

// ─── Coordinate validation ──────────────────────────────────────────────────

/**
 * Validates that coordinates are within the WGS-84 ranges.
 * Never trust coordinates coming from AI output, external APIs or user input.
 */
export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

// ─── Driving route (OSRM) ───────────────────────────────────────────────────

const routeCache = new Map<string, { distanceKm: number; durationMin: number }>();

/**
 * Fetches real driving distance/duration from the free OSRM demo server.
 * Returns null on any failure (offline, timeout, rate limit) — callers must
 * degrade gracefully to straight-line Haversine distance.
 * Never call this on every map move; only on explicit user actions (cached).
 */
export async function fetchDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ distanceKm: number; durationMin: number } | null> {
  if (!isValidCoordinate(fromLat, fromLng) || !isValidCoordinate(toLat, toLng)) return null;

  const key = `${fromLat.toFixed(4)},${fromLng.toFixed(4)}|${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  if (routeCache.has(key)) return routeCache.get(key)!;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route || typeof route.distance !== 'number') return null;

    const result = {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round((route.duration || 0) / 60),
    };
    routeCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Fetches the driving route polyline (GeoJSON coordinates) for map display.
 * Returns null on failure.
 */
export async function fetchRouteGeometry(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<[number, number][] | null> {
  if (!isValidCoordinate(fromLat, fromLng) || !isValidCoordinate(toLat, toLng)) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    // GeoJSON is [lng, lat]; MapView expects [lat, lng]
    return coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  } catch {
    return null;
  }
}

// ─── Distance labels ────────────────────────────────────────────────────────

export interface DistanceLabel {
  text: string;
  /** True when the value is an estimate (server-seeded or straight-line fallback), not a live route. */
  isEstimate: boolean;
}

/**
 * Resolves the best available distance label for a doctor relative to the
 * patient. Uses REAL coordinates when both sides have them (straight-line
 * Haversine — clearly labelled), and falls back to the server-seeded
 * `distanceKm` otherwise. Never invents a distance from fake coordinates.
 */
export function resolveDistanceLabel(
  patientLocation?: { latitude?: number; longitude?: number } | null,
  doctor?: { latitude?: number; longitude?: number; distanceKm?: number } | null
): DistanceLabel {
  const hasPatient =
    patientLocation &&
    isValidCoordinate(patientLocation.latitude, patientLocation.longitude);
  const hasDoctor = doctor && isValidCoordinate(doctor.latitude, doctor.longitude);

  if (hasPatient && hasDoctor) {
    const dist = calculateDistanceKm(
      patientLocation!.latitude!,
      patientLocation!.longitude!,
      doctor!.latitude!,
      doctor!.longitude!
    );
    if (dist > 0) return { text: `${dist} km away`, isEstimate: false };
  }

  if (doctor?.distanceKm && doctor.distanceKm > 0) {
    return { text: `~${doctor.distanceKm} km away (approx.)`, isEstimate: true };
  }

  return { text: 'Distance unavailable', isEstimate: true };
}
