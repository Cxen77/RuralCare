/**
 * Map / Routing Tools
 * 
 * Performs routing and multi-waypoint navigation calculations via Geoapify Routing API.
 * NEVER fabricates routes, distances, or durations.
 */

const { GeoapifyService } = require('../../geoapify.service');

const mapRoutingTools = {
  calculateRoute: {
    name: 'calculateRoute',
    description: 'Calculates a verified road navigation route between origin and destination coordinates using Geoapify. Returns real distance in meters/km, travel duration in seconds/minutes, geometry, and turn instructions.',
    parameters: {
      type: 'object',
      properties: {
        originLat: { type: 'number', description: 'Origin latitude' },
        originLon: { type: 'number', description: 'Origin longitude' },
        destLat: { type: 'number', description: 'Destination latitude' },
        destLon: { type: 'number', description: 'Destination longitude' },
        mode: {
          type: 'string',
          enum: ['drive', 'walk', 'bicycle'],
          description: 'Travel mode (defaults to drive)'
        }
      },
      required: ['destLat', 'destLon']
    },
    execute: async (args, context) => {
      const originLat = args.originLat != null ? args.originLat : context?.location?.latitude;
      const originLon = args.originLon != null ? args.originLon : context?.location?.longitude;
      const { destLat, destLon, mode = 'drive' } = args;

      if (originLat == null || originLon == null) {
        throw new Error('Origin coordinates are missing. Patient location is required to calculate route.');
      }
      if (destLat == null || destLon == null) {
        throw new Error('Destination coordinates are required to calculate route.');
      }

      return GeoapifyService.calculateRoute({
        waypoints: [
          { latitude: originLat, longitude: originLon, name: 'Origin' },
          { latitude: destLat, longitude: destLon, name: 'Destination' }
        ],
        mode
      });
    }
  },

  calculateMultiWaypointRoute: {
    name: 'calculateMultiWaypointRoute',
    description: 'Calculates a multi-stop sequence route (e.g. Patient -> Doctor Clinic -> Pharmacy) using Geoapify multi-waypoint routing.',
    parameters: {
      type: 'object',
      properties: {
        waypoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              name: { type: 'string' }
            },
            required: ['latitude', 'longitude']
          },
          description: 'Ordered list of coordinates to visit in sequence (minimum 2)'
        },
        mode: {
          type: 'string',
          enum: ['drive', 'walk', 'bicycle'],
          description: 'Mode of travel'
        }
      },
      required: ['waypoints']
    },
    execute: async (args, context) => {
      let { waypoints = [], mode = 'drive' } = args;

      // If the first waypoint is missing and user location is known, prepend it
      if (waypoints.length > 0 && context?.location?.latitude != null && (waypoints[0].name === 'Doctor' || waypoints[0].name === 'Clinic')) {
        waypoints = [
          { latitude: context.location.latitude, longitude: context.location.longitude, name: 'Patient' },
          ...waypoints
        ];
      }

      if (waypoints.length < 2) {
        throw new Error('At least 2 waypoints are required for multi-stop routing.');
      }

      return GeoapifyService.calculateRoute({ waypoints, mode });
    }
  },

  calculateMultipleRoutes: {
    name: 'calculateMultipleRoutes',
    description: 'Calculates and compares real routes from the patient to multiple destination options (e.g. comparing 3 different pharmacies or clinics).',
    parameters: {
      type: 'object',
      properties: {
        originLat: { type: 'number', description: 'Origin latitude' },
        originLon: { type: 'number', description: 'Origin longitude' },
        destinations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              latitude: { type: 'number' },
              longitude: { type: 'number' }
            },
            required: ['latitude', 'longitude']
          },
          description: 'List of destination places to compare'
        },
        mode: {
          type: 'string',
          enum: ['drive', 'walk', 'bicycle'],
          description: 'Mode of travel'
        },
        sortBy: {
          type: 'string',
          enum: ['duration', 'distance'],
          description: 'Sort criteria'
        }
      },
      required: ['destinations']
    },
    execute: async (args, context) => {
      const originLat = args.originLat != null ? args.originLat : context?.location?.latitude;
      const originLon = args.originLon != null ? args.originLon : context?.location?.longitude;
      const { destinations = [], mode = 'drive', sortBy = 'duration' } = args;

      if (originLat == null || originLon == null) {
        throw new Error('Origin coordinates are required for route comparison.');
      }

      return GeoapifyService.calculateMultipleRoutes({
        originLat,
        originLon,
        destinations,
        mode,
        sortBy
      });
    }
  },

  rankByRoute: {
    name: 'rankByRoute',
    description: 'Ranks a list of candidate facilities based on actual route travel time or distance returned by routing.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'object' },
          description: 'List of items with route info'
        },
        sortBy: {
          type: 'string',
          enum: ['travel_time', 'distance'],
          description: 'Sort by travel time or distance'
        }
      },
      required: ['items']
    },
    execute: async (args) => {
      const { items = [], sortBy = 'travel_time' } = args;
      const sorted = [...items].sort((a, b) => {
        if (sortBy === 'distance') {
          return (a.route?.distanceMeters || a.distanceKm || 0) - (b.route?.distanceMeters || b.distanceKm || 0);
        }
        return (a.route?.durationSeconds || 0) - (b.route?.durationSeconds || 0);
      });
      return sorted;
    }
  }
};

module.exports = mapRoutingTools;
