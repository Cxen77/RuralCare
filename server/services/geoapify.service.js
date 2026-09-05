/**
 * Geoapify Service (RuralCare Backend)
 * 
 * Handles geographic operations using Geoapify APIs:
 * - Geocoding (search & reverse)
 * - Nearby Places (hospitals, clinics, pharmacies)
 * - Routing & Distance calculations (single route & multi-waypoint: Patient -> Doctor -> Pharmacy)
 * - Haversine fallback when external network/API key is unavailable
 */

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

class GeoapifyService {
  static getApiKey() {
    return process.env.GEOAPIFY_API_KEY || process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || null;
  }

  /**
   * Geocode a place/address string into geographic coordinates.
   */
  static async geocode({ text }) {
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Address/text is required for geocoding');

    const apiKey = this.getApiKey();
    if (!apiKey) {
      // Default fallback coordinates for Ramnagar / Bihar reference region if offline
      return {
        latitude: 25.9856,
        longitude: 85.2281,
        formattedAddress: trimmed,
        source: 'fallback_reference'
      };
    }

    try {
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(trimmed)}&limit=1&apiKey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Geoapify geocode error ${res.status}`);
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) {
        return {
          latitude: 25.9856,
          longitude: 85.2281,
          formattedAddress: trimmed,
          source: 'not_found_fallback'
        };
      }

      const [lon, lat] = feature.geometry.coordinates;
      return {
        latitude: lat,
        longitude: lon,
        formattedAddress: feature.properties?.formatted || trimmed,
        city: feature.properties?.city,
        state: feature.properties?.state,
        country: feature.properties?.country,
        source: 'geoapify'
      };
    } catch (err) {
      console.warn('[GeoapifyService] Geocode error:', err.message);
      return {
        latitude: 25.9856,
        longitude: 85.2281,
        formattedAddress: trimmed,
        source: 'error_fallback'
      };
    }
  }

  /**
   * Reverse geocode coordinates into a human-readable street address.
   */
  static async reverseGeocode({ latitude, longitude }) {
    if (latitude == null || longitude == null) {
      throw new Error('latitude and longitude are required for reverse geocoding');
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
        source: 'coordinates_only'
      };
    }

    try {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Geoapify reverse geocode error ${res.status}`);
      const data = await res.json();
      const feature = data.features?.[0];
      return {
        formattedAddress: feature?.properties?.formatted || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        city: feature?.properties?.city || 'Local Region',
        state: feature?.properties?.state || '',
        latitude,
        longitude,
        source: 'geoapify'
      };
    } catch (err) {
      console.warn('[GeoapifyService] Reverse geocode error:', err.message);
      return {
        formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
        source: 'error_fallback'
      };
    }
  }

  /**
   * Search real nearby places (e.g. healthcare.hospital, healthcare.clinic, commercial.pharmacy).
   */
  static async searchPlaces({ categories = ['healthcare.hospital', 'commercial.pharmacy'], latitude, longitude, radiusMeters = 10000, limit = 5 }) {
    if (latitude == null || longitude == null) {
      throw new Error('latitude and longitude are required for place search');
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return [];
    }

    try {
      const cats = Array.isArray(categories) ? categories.join(',') : categories;
      const url = `https://api.geoapify.com/v2/places?categories=${cats}&filter=circle:${longitude},${latitude},${radiusMeters}&bias=proximity:${longitude},${latitude}&limit=${limit}&apiKey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Geoapify places error ${res.status}`);
      const data = await res.json();

      return (data.features || []).map(f => {
        const props = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return {
          placeId: props.place_id,
          name: props.name || props.formatted || 'Healthcare Facility',
          category: props.categories?.[0] || categories[0],
          address: props.formatted || props.address_line2 || props.street,
          latitude: lat,
          longitude: lon,
          distanceMeters: props.distance || Math.round(haversineDistanceKm(latitude, longitude, lat, lon) * 1000),
          source: 'geoapify'
        };
      });
    } catch (err) {
      console.warn('[GeoapifyService] Place search error:', err.message);
      return [];
    }
  }

  /**
   * Calculate a real route between waypoints using Geoapify Routing API.
   * Supports mode: 'drive' | 'walk' | 'bicycle'.
   * Handles 2 waypoints (origin -> destination) or N waypoints (e.g. Patient -> Doctor -> Pharmacy).
   */
  static async calculateRoute({ waypoints, mode = 'drive' }) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required for route calculation');
    }

    for (const wp of waypoints) {
      if (wp.latitude == null || wp.longitude == null) {
        throw new Error('Each waypoint must have latitude and longitude');
      }
    }

    const apiKey = this.getApiKey();

    // If no API key, compute realistic straight-line estimate fallback
    if (!apiKey) {
      let totalDistanceKm = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        totalDistanceKm += haversineDistanceKm(
          waypoints[i].latitude, waypoints[i].longitude,
          waypoints[i + 1].latitude, waypoints[i + 1].longitude
        );
      }
      const distanceMeters = Math.round(totalDistanceKm * 1000);
      const avgSpeedKmh = mode === 'walk' ? 4.5 : mode === 'bicycle' ? 12 : 35;
      const durationSeconds = Math.round((totalDistanceKm / avgSpeedKmh) * 3600);

      return {
        distanceMeters,
        distanceKm: Math.round(totalDistanceKm * 10) / 10,
        durationSeconds,
        durationMinutes: Math.ceil(durationSeconds / 60),
        mode,
        waypointsCount: waypoints.length,
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map(w => [w.longitude, w.latitude])
        },
        instructions: [
          `Proceed towards ${waypoints[waypoints.length - 1].name || 'destination'}`
        ],
        source: 'haversine_estimate'
      };
    }

    try {
      // Geoapify waypoints format: lat,lon|lat,lon|...
      const waypointsParam = waypoints.map(w => `${w.latitude},${w.longitude}`).join('|');
      const routeMode = mode === 'walk' ? 'walk' : mode === 'bicycle' ? 'bicycle' : 'drive';
      const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsParam}&mode=${routeMode}&apiKey=${apiKey}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`Geoapify routing error ${res.status}`);
      }

      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) throw new Error('No route found from Geoapify');

      const props = feature.properties || {};
      const distanceMeters = Math.round(props.distance || 0);
      const durationSeconds = Math.round(props.time || 0);

      // Extract high-level turn instructions
      const instructions = [];
      const legs = props.legs || [];
      for (const leg of legs) {
        for (const step of leg.steps || []) {
          if (step.instruction?.text) {
            instructions.push(step.instruction.text);
          }
        }
      }

      return {
        distanceMeters,
        distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
        durationSeconds,
        durationMinutes: Math.ceil(durationSeconds / 60),
        mode: routeMode,
        waypointsCount: waypoints.length,
        geometry: feature.geometry, // GeoJSON LineString coordinates [[lon, lat], ...]
        instructions: instructions.slice(0, 8),
        source: 'geoapify'
      };
    } catch (err) {
      console.warn('[GeoapifyService] Route error, falling back:', err.message);
      // Fallback to Haversine
      let totalDistanceKm = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        totalDistanceKm += haversineDistanceKm(
          waypoints[i].latitude, waypoints[i].longitude,
          waypoints[i + 1].latitude, waypoints[i + 1].longitude
        );
      }
      const distanceMeters = Math.round(totalDistanceKm * 1000);
      const durationSeconds = Math.round((totalDistanceKm / 35) * 3600);
      return {
        distanceMeters,
        distanceKm: Math.round(totalDistanceKm * 10) / 10,
        durationSeconds,
        durationMinutes: Math.ceil(durationSeconds / 60),
        mode,
        waypointsCount: waypoints.length,
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map(w => [w.longitude, w.latitude])
        },
        instructions: [`Head towards destination along primary local route (${Math.round(totalDistanceKm * 10) / 10} km)`],
        source: 'haversine_estimate'
      };
    }
  }

  /**
   * Calculate routes from one origin to multiple candidate destinations and rank them.
   */
  static async calculateMultipleRoutes({ originLat, originLon, destinations, mode = 'drive', sortBy = 'duration' }) {
    if (!Array.isArray(destinations) || destinations.length === 0) {
      return [];
    }

    const routePromises = destinations.map(async (dest) => {
      const route = await this.calculateRoute({
        waypoints: [
          { latitude: originLat, longitude: originLon, name: 'Patient' },
          { latitude: dest.latitude, longitude: dest.longitude, name: dest.name || 'Destination' }
        ],
        mode
      });
      return {
        ...dest,
        route
      };
    });

    const results = await Promise.all(routePromises);

    // Sort by duration or distance
    results.sort((a, b) => {
      if (sortBy === 'distance') {
        return (a.route?.distanceMeters || 0) - (b.route?.distanceMeters || 0);
      }
      return (a.route?.durationSeconds || 0) - (b.route?.durationSeconds || 0);
    });

    return results;
  }
}

module.exports = {
  GeoapifyService,
  haversineDistanceKm
};
