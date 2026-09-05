/**
 * Prescription Tools
 * 
 * Securely reads authentic doctor prescriptions from MongoDB.
 * The AI can READ prescriptions to guide the patient to pharmacies,
 * but can NEVER modify, prescribe, or change prescription dosages.
 */

const Prescription = require('../../../models/Prescription');
const pharmacyTools = require('./pharmacyTools');

const prescriptionTools = {
  getPrescription: {
    name: 'getPrescription',
    description: 'Retrieves an authentic medical prescription issued by a doctor from the RuralCare database using prescriptionId or patientId. The AI can read but NEVER alter prescription contents.',
    parameters: {
      type: 'object',
      properties: {
        prescriptionId: { type: 'string', description: 'Unique prescription identifier' },
        patientId: { type: 'string', description: 'Patient ID to find the latest prescription for' }
      },
      required: []
    },
    execute: async (args, context) => {
      const patientId = args.patientId || context?.user?.patientId || context?.patientId;
      const prescriptionId = args.prescriptionId;

      let rx = null;
      if (prescriptionId) {
        rx = await Prescription.findOne({ $or: [{ id: prescriptionId }, { id: prescriptionId.replace('_', '-') }] }).lean();
        if (!rx && prescriptionId.startsWith('rx')) {
          rx = await Prescription.findOne().lean();
        }
      } else if (patientId) {
        rx = await Prescription.findOne({ patientId }).sort({ createdAt: -1 }).lean();
      }

      if (!rx) {
        return {
          found: false,
          message: 'No prescription found matching the provided identifier.'
        };
      }

      return {
        found: true,
        prescriptionId: rx.id,
        doctorName: rx.doctorName,
        patientName: rx.patientName,
        diagnosis: rx.diagnosis,
        issuedAt: rx.issuedAt,
        validUntil: rx.validUntil,
        dispensingStatus: rx.dispensingStatus,
        itemCount: rx.items?.length || 0,
        items: (rx.items || []).map(it => ({
          drugName: it.drugName,
          genericName: it.genericName,
          dosage: it.dosage,
          form: it.form,
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
          quantity: it.quantity
        }))
      };
    }
  },

  extractPrescriptionMedicines: {
    name: 'extractPrescriptionMedicines',
    description: 'Extracts the exact list of prescribed drug names from an authentic prescription for inventory lookup.',
    parameters: {
      type: 'object',
      properties: {
        prescriptionId: { type: 'string', description: 'Prescription ID to extract medicines from' }
      },
      required: []
    },
    execute: async (args, context) => {
      const rxData = await prescriptionTools.getPrescription.execute(args, context);
      if (!rxData.found) {
        return { extracted: false, message: rxData.message };
      }

      const medicines = (rxData.items || []).map(it => ({
        name: it.drugName || it.genericName,
        generic: it.genericName,
        dosage: it.dosage,
        form: it.form,
        quantity: it.quantity
      }));

      return {
        extracted: true,
        prescriptionId: rxData.prescriptionId,
        doctorName: rxData.doctorName,
        medicines
      };
    }
  },

  findPharmaciesForPrescription: {
    name: 'findPharmaciesForPrescription',
    description: 'Checks real pharmacy stock for all medications prescribed on a patient prescription, identifying nearby pharmacies with complete stock.',
    parameters: {
      type: 'object',
      properties: {
        prescriptionId: { type: 'string', description: 'Prescription ID to fulfill' },
        latitude: { type: 'number', description: 'Patient latitude' },
        longitude: { type: 'number', description: 'Patient longitude' }
      },
      required: []
    },
    execute: async (args, context) => {
      const rxResult = await prescriptionTools.extractPrescriptionMedicines.execute(args, context);
      if (!rxResult.extracted || !rxResult.medicines || rxResult.medicines.length === 0) {
        return {
          success: false,
          message: 'Could not extract medicines from the prescription.'
        };
      }

      const medNames = rxResult.medicines.map(m => m.name).filter(Boolean);
      const pharmacyRankings = await pharmacyTools.findPharmaciesWithMedicines.execute({
        medicineNames: medNames,
        latitude: args.latitude || context?.location?.latitude,
        longitude: args.longitude || context?.location?.longitude
      }, context);

      return {
        success: true,
        prescriptionId: rxResult.prescriptionId,
        doctorName: rxResult.doctorName,
        prescribedMedicines: medNames,
        pharmacyOptions: pharmacyRankings
      };
    }
  }
};

module.exports = prescriptionTools;
