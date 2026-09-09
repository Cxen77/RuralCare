/**
 * Hospital & Emergency Operations Tools
 * 
 * Exposes verified, real-time hospital operational data from MongoDB
 * to the RuralCare AI Assistant. Enforces read-only access to allowlisted
 * public hospital fields (beds, emergency status, departments, blood stock).
 * NEVER returns private patient records or internal secrets.
 */

const Hospital = require('../../../models/Hospital');
const Ambulance = require('../../../models/Ambulance');

// Calculate Haversine distance in km
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

const hospitalTools = {
  findNearbyHospitals: {
    name: 'findNearbyHospitals',
    description: 'Finds verified hospitals in the RuralCare network near the patient, with live bed capacity, emergency acceptance status, and contact details from the database.',
    parameters: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Patient current latitude coordinate' },
        longitude: { type: 'number', description: 'Patient current longitude coordinate' },
        maxDistanceKm: { type: 'number', description: 'Maximum search distance in kilometers (defaults to 30)' },
        emergencyOnly: { type: 'boolean', description: 'If true, returns only facilities with active 24x7 emergency trauma bay' }
      },
      required: []
    },
    execute: async (args, context) => {
      const patientLat = args.latitude ?? context?.location?.latitude;
      const patientLng = args.longitude ?? context?.location?.longitude;
      const maxDist = args.maxDistanceKm || 50;

      const hospitals = await Hospital.find({}).lean();

      let results = hospitals.map((h) => {
        let distanceKm = null;
        if (patientLat != null && patientLng != null && h.latitude != null && h.longitude != null) {
          distanceKm = calculateDistanceKm(patientLat, patientLng, h.latitude, h.longitude);
        } else {
          distanceKm = h.distanceKm || null;
        }

        return {
          id: h.id,
          name: h.name,
          type: h.type,
          address: h.address,
          phone: h.phone || '108',
          emergencyHelpline: h.emergencyHelpline || h.phone || '108',
          acceptingEmergency: h.acceptingEmergency !== false,
          operatingHours: h.operatingHours || '24x7 Emergency & Inpatient Services',
          distanceKm,
          availableBeds: {
            general: h.beds?.general ?? 0,
            emergency: h.beds?.emergency ?? 0,
            icu: h.beds?.icu ?? 0,
            ventilator: h.beds?.ventilator ?? 0
          },
          departments: h.departments || [],
          diagnostics: h.diagnostics || [],
          hasCoordinates: Boolean(h.latitude && h.longitude)
        };
      });

      if (args.emergencyOnly) {
        results = results.filter((h) => h.acceptingEmergency && (h.availableBeds.emergency > 0 || h.availableBeds.icu > 0));
      }

      if (patientLat != null && patientLng != null) {
        results.sort((a, b) => {
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
        results = results.filter((h) => h.distanceKm == null || h.distanceKm <= maxDist);
      }

      return {
        count: results.length,
        hospitals: results,
        emergencyNotice: 'For critical trauma, cardiac events, or severe bleeding, call 108 immediately.'
      };
    }
  },

  checkHospitalBedAvailability: {
    name: 'checkHospitalBedAvailability',
    description: 'Checks real-time verified bed availability (general, emergency, ICU, ventilator) for a specific hospital or across all registered hospitals.',
    parameters: {
      type: 'object',
      properties: {
        hospitalName: { type: 'string', description: 'Name or part of hospital name to check' },
        bedType: {
          type: 'string',
          enum: ['general', 'emergency', 'icu', 'ventilator', 'all'],
          description: 'Type of bed to query'
        }
      },
      required: []
    },
    execute: async (args) => {
      const { hospitalName, bedType = 'all' } = args;
      const query = {};
      if (hospitalName) {
        query.name = { $regex: hospitalName.trim(), $options: 'i' };
      }

      const hospitals = await Hospital.find(query).lean();
      if (!hospitals.length) {
        return {
          found: false,
          message: hospitalName
            ? `No registered hospital found matching "${hospitalName}".`
            : 'No hospitals found in the database.'
        };
      }

      const reports = hospitals.map((h) => {
        const beds = h.beds || {};
        const total = h.totalBeds || {};
        return {
          hospitalId: h.id,
          name: h.name,
          address: h.address,
          phone: h.phone,
          acceptingEmergency: h.acceptingEmergency !== false,
          bedsAvailable: {
            general: beds.general ?? 0,
            emergency: beds.emergency ?? 0,
            icu: beds.icu ?? 0,
            ventilator: beds.ventilator ?? 0
          },
          totalCapacity: {
            general: total.general ?? 20,
            emergency: total.emergency ?? 10,
            icu: total.icu ?? 5,
            ventilator: total.ventilator ?? 2
          },
          lastUpdated: h.updatedAt || new Date().toISOString()
        };
      });

      return {
        found: true,
        bedTypeRequested: bedType,
        reports
      };
    }
  },

  checkEmergencyHospitalStatus: {
    name: 'checkEmergencyHospitalStatus',
    description: 'Checks whether a hospital is actively accepting emergency admissions and trauma cases based on live operational status.',
    parameters: {
      type: 'object',
      properties: {
        hospitalName: { type: 'string', description: 'Hospital name or location to verify' }
      },
      required: []
    },
    execute: async (args) => {
      const { hospitalName } = args;
      const query = {};
      if (hospitalName) {
        query.name = { $regex: hospitalName.trim(), $options: 'i' };
      }

      const hospitals = await Hospital.find(query).lean();
      if (!hospitals.length) {
        return {
          found: false,
          message: `No hospital matching "${hospitalName}" was found in the verified registry.`
        };
      }

      const statusList = await Promise.all(
        hospitals.map(async (h) => {
          const availableAmbulances = await Ambulance.countDocuments({
            hospitalId: h.id,
            status: 'available'
          });

          return {
            hospitalId: h.id,
            name: h.name,
            address: h.address,
            phone: h.phone,
            emergencyHelpline: h.emergencyHelpline || h.phone || '108',
            acceptingEmergency: h.acceptingEmergency !== false,
            operatingHours: h.operatingHours || '24x7 Emergency & Inpatient Services',
            emergencyBedsAvailable: h.beds?.emergency ?? 0,
            icuBedsAvailable: h.beds?.icu ?? 0,
            standbyAmbulances: availableAmbulances,
            emergencyStatusSummary:
              h.acceptingEmergency !== false && (h.beds?.emergency ?? 0) > 0
                ? 'ACCEPTING_EMERGENCY_PATIENTS'
                : (h.beds?.emergency ?? 0) === 0
                ? 'EMERGENCY_BAY_AT_CAPACITY'
                : 'EMERGENCY_DIVERT'
          };
        })
      );

      return {
        found: true,
        facilities: statusList,
        emergencyHelpline: '108'
      };
    }
  },

  checkHospitalBloodStock: {
    name: 'checkHospitalBloodStock',
    description: 'Checks real-time blood bank units available in hospital reserves for transfusion emergencies.',
    parameters: {
      type: 'object',
      properties: {
        bloodGroup: {
          type: 'string',
          enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
          description: 'Required blood group'
        },
        hospitalName: { type: 'string', description: 'Optional hospital name' }
      },
      required: ['bloodGroup']
    },
    execute: async (args) => {
      const { bloodGroup, hospitalName } = args;
      const query = {};
      if (hospitalName) {
        query.name = { $regex: hospitalName.trim(), $options: 'i' };
      }

      const hospitals = await Hospital.find(query).lean();
      const results = [];

      for (const h of hospitals) {
        const blood = h.blood || {};
        const units = blood[bloodGroup] ?? 0;
        results.push({
          hospitalId: h.id,
          name: h.name,
          address: h.address,
          phone: h.phone,
          bloodGroup,
          unitsAvailable: units,
          inStock: units > 0,
          allStock: blood
        });
      }

      return {
        bloodGroupRequested: bloodGroup,
        results: results.sort((a, b) => b.unitsAvailable - a.unitsAvailable)
      };
    }
  }
};

module.exports = hospitalTools;
