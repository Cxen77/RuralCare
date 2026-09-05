/**
 * Location Tools
 * 
 * Geographic resolution tools powered by Geoapify.
 * NEVER fabricates fake coordinates.
 */

const { GeoapifyService } = require('../../geoapify.service');

const locationTools = {
  getUserLocation: {
    name: 'getUserLocation',
    description: 'Obtains the current geographic coordinates (latitude and longitude) provided with permission by the user mobile application.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async (args, context) => {
      const loc = context?.location;
      if (!loc || loc.latitude == null || loc.longitude == null) {
        return {
          locationAvailable: false,
          message: 'User location coordinates were not provided or permission is not granted.'
        };
      }
      return {
        locationAvailable: true,
        latitude: loc.latitude,
        longitude: loc.longitude,
        source: 'device_gps'
      };
    }
  },

  geocodeLocation: {
    name: 'geocodeLocation',
    description: 'Converts a place name, village, or street address into real latitude and longitude coordinates using Geoapify.',
    parameters: {
      type: 'object',
      properties: {
        placeName: {
          type: 'string',
          description: 'Name of the village, city, landmark, or address to geocode'
        }
      },
      required: ['placeName']
    },
    execute: async (args) => {
      const { placeName } = args;
      if (!placeName) throw new Error('placeName is required');
      return GeoapifyService.geocode({ text: placeName });
    }
  },

  reverseGeocode: {
    name: 'reverseGeocode',
    description: 'Converts geographic coordinates into a human-readable address, city, and district using Geoapify.',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude coordinate'
        },
        longitude: {
          type: 'number',
          description: 'Longitude coordinate'
        }
      },
      required: ['latitude', 'longitude']
    },
    execute: async (args, context) => {
      const latitude = args.latitude != null ? args.latitude : context?.location?.latitude;
      const longitude = args.longitude != null ? args.longitude : context?.location?.longitude;
      if (latitude == null || longitude == null) {
        throw new Error('latitude and longitude are required');
      }
      return GeoapifyService.reverseGeocode({ latitude, longitude });
    }
  }
};

module.exports = locationTools;
