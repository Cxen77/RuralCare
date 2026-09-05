/**
 * Emergency & Urgent Care Safety Tools
 * 
 * Detects life-threatening symptoms and directs patients immediately
 * to SOS ambulance services and emergency hospital care.
 */

const Hospital = require('../../../models/Hospital');

const CRITICAL_RED_FLAGS = [
  { flag: 'chest pain', message: 'Potential acute cardiac event or myocardial ischemia' },
  { flag: 'cannot breathe', message: 'Severe respiratory distress' },
  { flag: "can't breathe", message: 'Severe respiratory distress' },
  { flag: 'difficulty breathing', message: 'Acute respiratory compromise' },
  { flag: 'unconscious', message: 'Loss of consciousness / neurological emergency' },
  { flag: 'fainted', message: 'Syncope or sudden circulatory collapse' },
  { flag: 'heavy bleeding', message: 'Active severe hemorrhage' },
  { flag: 'severe bleeding', message: 'Active severe hemorrhage' },
  { flag: 'stroke', message: 'Suspected acute cerebrovascular accident (FAST)' },
  { flag: 'paralysis', message: 'Sudden motor deficit or acute stroke' },
  { flag: 'seizure', message: 'Active convulsion or status epilepticus' },
  { flag: 'vomiting blood', message: 'Upper gastrointestinal hemorrhage' },
  { flag: 'coughing blood', message: 'Hemoptysis / pulmonary emergency' }
];

const emergencyTools = {
  checkEmergencyRedFlags: {
    name: 'checkEmergencyRedFlags',
    description: 'Checks patient symptoms for life-threatening medical emergencies (e.g. chest pain, stroke, breathing failure, massive hemorrhage) and returns urgent emergency guidance.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Patient symptoms or description' }
      },
      required: ['text']
    },
    execute: async (args, context) => {
      const { text = '' } = args;
      const lower = text.toLowerCase();

      for (const item of CRITICAL_RED_FLAGS) {
        if (lower.includes(item.flag)) {
          // Find nearest hospital with emergency capabilities
          const emergencyHospital = await Hospital.findOne({
            $or: [
              { 'capabilities.icuBeds': { $gt: 0 } },
              { 'beds.emergency': { $gt: 0 } },
              { type: { $in: ['District Hospital', 'Sub-Divisional Hospital'] } }
            ]
          }).lean();

          return {
            isEmergency: true,
            detectedRedFlag: item.flag,
            clinicalConcern: item.message,
            ambulanceNumber: '108',
            nationalEmergencyNumber: '112',
            recommendedAction: 'CALL_AMBULANCE_IMMEDIATELY',
            urgentFacility: emergencyHospital ? {
              name: emergencyHospital.name,
              address: emergencyHospital.address,
              phone: emergencyHospital.phone || '108',
              emergencyBeds: emergencyHospital.beds?.emergency || 10
            } : {
              name: 'Nearest District Hospital Emergency Ward',
              address: 'Local Sub-Division HQ',
              phone: '108'
            },
            advisory: '🚨 CRITICAL MEDICAL ALERT: Do NOT wait for a routine clinic appointment. Press the red SOS Ambulance button or call 108 immediately.'
          };
        }
      }

      return {
        isEmergency: false,
        advisory: 'No immediate red-flag emergency detected. Standard outpatient clinical triage is appropriate.'
      };
    }
  }
};

module.exports = emergencyTools;
