/**
 * Patient Tools
 * 
 * Exposes minimal, privacy-preserving patient data to the AI agent.
 * NEVER exposes passwords, auth tokens, or unrelated private files.
 */

const Patient = require('../../../models/Patient');
const User = require('../../../models/User');

const patientTools = {
  getCurrentUser: {
    name: 'getCurrentUser',
    description: 'Retrieves minimal authenticated user identity (id, name, role) to personalize medical assistance without exposing sensitive tokens or credentials.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async (args, context) => {
      const user = context?.user;
      if (!user) {
        return { authenticated: false, message: 'User is interacting as a guest.' };
      }
      return {
        authenticated: true,
        id: user.id || user._id,
        name: user.name,
        role: user.role,
        patientId: user.patientId
      };
    }
  },

  getPatientProfile: {
    name: 'getPatientProfile',
    description: 'Retrieves basic clinical background (age, gender, chronic conditions, allergies) for the current patient to inform medical triage reasoning.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async (args, context) => {
      const user = context?.user;
      const patientId = user?.patientId || context?.patientId;
      if (!patientId) {
        return { profileAvailable: false, message: 'No patient record linked to current session.' };
      }

      const patient = await Patient.findOne({ id: patientId }).select('-__v');
      if (!patient) {
        return { profileAvailable: false, message: 'Patient profile not found.' };
      }

      return {
        profileAvailable: true,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        chronicConditions: patient.chronicConditions || [],
        allergies: patient.allergies || [],
        primaryLanguage: patient.primaryLanguage || 'English'
      };
    }
  }
};

module.exports = patientTools;
