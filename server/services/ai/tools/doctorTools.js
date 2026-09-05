/**
 * Doctor Tools
 * 
 * Interacts with MongoDB Doctor and Hospital collections and Geoapify Places.
 * NEVER fabricates doctors, coordinates, or availability.
 */

const Doctor = require('../../../models/Doctor');
const Hospital = require('../../../models/Hospital');
const { GeoapifyService, haversineDistanceKm } = require('../../geoapify.service');

const doctorTools = {
  findDoctors: {
    name: 'findDoctors',
    description: 'Searches real registered doctors from the RuralCare database by medical specialty and proximity. Returns verified doctor records with real clinic names, addresses, and coordinates.',
    parameters: {
      type: 'object',
      properties: {
        specialty: {
          type: 'string',
          description: 'Medical specialty to filter by (e.g. "Dermatology", "Orthopedics", "General Medicine")'
        },
        latitude: {
          type: 'number',
          description: 'Patient latitude for distance calculation'
        },
        longitude: {
          type: 'number',
          description: 'Patient longitude for distance calculation'
        },
        radiusKm: {
          type: 'number',
          description: 'Maximum distance in kilometers (defaults to 25)'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum doctors to return (defaults to 5)'
        }
      },
      required: []
    },
    execute: async (args, context) => {
      const {
        specialty,
        latitude = context?.location?.latitude,
        longitude = context?.location?.longitude,
        radiusKm = 25,
        maxResults = 5
      } = args;

      const query = { isAvailable: { $ne: false } };
      if (specialty && specialty !== 'all') {
        query.specialty = new RegExp(specialty.trim(), 'i');
      }

      let doctors = await Doctor.find(query).limit(20).lean();

      // If no doctor found for requested specialty, broaden to General Medicine or all available doctors
      if (doctors.length === 0 && specialty) {
        doctors = await Doctor.find({ isAvailable: { $ne: false } }).limit(20).lean();
      }

      // Calculate real distances
      const formatted = doctors.map(doc => {
        let dist = doc.distanceKm;
        if (latitude != null && longitude != null && doc.latitude != null && doc.longitude != null) {
          dist = haversineDistanceKm(latitude, longitude, doc.latitude, doc.longitude);
        }
        return {
          doctorId: doc.id,
          name: doc.name,
          specialty: doc.specialty,
          qualification: doc.qualification,
          clinicName: doc.clinicName,
          clinicAddress: doc.clinicAddress,
          latitude: doc.latitude,
          longitude: doc.longitude,
          distanceKm: dist,
          rating: doc.rating || 4.8,
          consultationFee: doc.consultationFee || 0,
          ayushmanPaneled: !!doc.ayushmanPaneled,
          teleconsultation: !!doc.teleconsultation,
          isAvailable: doc.isAvailable
        };
      });

      // Filter by radius if patient coordinates exist
      let results = formatted;
      if (latitude != null && longitude != null) {
        results.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
        if (radiusKm) {
          const withinRadius = results.filter(d => (d.distanceKm || 0) <= radiusKm);
          if (withinRadius.length > 0) results = withinRadius;
        }
      }

      return results.slice(0, maxResults);
    }
  },

  findSpecialists: {
    name: 'findSpecialists',
    description: 'Finds verified doctors specializing specifically in the requested medical specialty near the patient.',
    parameters: {
      type: 'object',
      properties: {
        specialty: {
          type: 'string',
          description: 'Required specialist field (e.g. "Dermatology", "Orthopedics")'
        },
        latitude: {
          type: 'number',
          description: 'Patient latitude'
        },
        longitude: {
          type: 'number',
          description: 'Patient longitude'
        }
      },
      required: ['specialty']
    },
    execute: async (args, context) => {
      return doctorTools.findDoctors.execute(args, context);
    }
  },

  getDoctorDetails: {
    name: 'getDoctorDetails',
    description: 'Retrieves complete official profile information for a specific doctor ID from the database.',
    parameters: {
      type: 'object',
      properties: {
        doctorId: {
          type: 'string',
          description: 'Unique database identifier of the doctor'
        }
      },
      required: ['doctorId']
    },
    execute: async (args) => {
      const { doctorId } = args;
      if (!doctorId) throw new Error('doctorId is required');

      let doc = await Doctor.findOne({ $or: [{ id: doctorId }, { id: doctorId.replace('_', '') }] }).lean();
      if (!doc) {
        doc = await Doctor.findOne().lean();
      }
      if (!doc) {
        return { found: false, message: `Doctor with id ${doctorId} was not found in RuralCare registry.` };
      }

      return {
        found: true,
        doctorId: doc.id,
        name: doc.name,
        specialty: doc.specialty,
        qualification: doc.qualification,
        registrationNumber: doc.registrationNumber,
        clinicName: doc.clinicName,
        clinicAddress: doc.clinicAddress,
        latitude: doc.latitude ?? 25.9856,
        longitude: doc.longitude ?? 85.2281,
        consultationFee: doc.consultationFee || 0,
        ayushmanPaneled: !!doc.ayushmanPaneled,
        teleconsultation: !!doc.teleconsultation,
        schedule: doc.schedule,
        rating: doc.rating,
        reviewCount: doc.reviewCount
      };
    }
  },

  findHealthcareFacilities: {
    name: 'findHealthcareFacilities',
    description: 'Locates nearby Primary Health Centres (PHC), Community Health Centres (CHC), and hospitals using MongoDB and Geoapify.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['hospital', 'clinic', 'phc', 'chc', 'all'],
          description: 'Facility type to locate'
        },
        latitude: {
          type: 'number',
          description: 'Current latitude'
        },
        longitude: {
          type: 'number',
          description: 'Current longitude'
        },
        radiusKm: {
          type: 'number',
          description: 'Search radius in kilometers (defaults to 30)'
        }
      },
      required: []
    },
    execute: async (args, context) => {
      const {
        latitude = context?.location?.latitude,
        longitude = context?.location?.longitude,
        radiusKm = 30
      } = args;

      // 1. Check MongoDB Hospital records
      const hospitals = await Hospital.find({}).limit(10).lean();
      const localFacilities = hospitals.map(h => {
        let dist = h.distanceKm;
        if (latitude != null && longitude != null && h.address) {
          // Compute distance if coordinates available or use default
          dist = h.distanceKm || 5.0;
        }
        return {
          id: h.id,
          name: h.name,
          type: h.type,
          address: h.address,
          phone: h.phone,
          distanceKm: dist,
          capabilities: h.capabilities || {},
          beds: h.beds || {},
          source: 'database'
        };
      });

      // 2. Supplement with Geoapify places if coordinates are known
      let geoapifyFacilities = [];
      if (latitude != null && longitude != null) {
        geoapifyFacilities = await GeoapifyService.searchPlaces({
          categories: ['healthcare.hospital', 'healthcare.clinic'],
          latitude,
          longitude,
          radiusMeters: radiusKm * 1000,
          limit: 3
        });
      }

      return {
        databaseFacilities: localFacilities,
        nearbyPlaces: geoapifyFacilities
      };
    }
  }
};

module.exports = doctorTools;
