/**
 * Appointment Tools
 * 
 * Manages doctor availability inspection and appointment creation.
 * CRITICAL SAFETY GUARD: Creating or canceling appointments MUST require
 * explicit user confirmation (userConfirmed === true).
 */

const Appointment = require('../../../models/Appointment');
const Doctor = require('../../../models/Doctor');

const appointmentTools = {
  getDoctorAvailability: {
    name: 'getDoctorAvailability',
    description: 'Retrieves available consultation time slots for a specific doctor on a given date.',
    parameters: {
      type: 'object',
      properties: {
        doctorId: { type: 'string', description: 'Doctor ID' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' }
      },
      required: ['doctorId']
    },
    execute: async (args) => {
      const { doctorId, date = new Date().toISOString().split('T')[0] } = args || {};
      if (!doctorId) {
        return { available: false, message: 'doctorId is required.' };
      }
      let doc = await Doctor.findOne({ $or: [{ id: doctorId }, { id: doctorId.replace('_', '') }] }).lean();
      if (!doc) {
        doc = await Doctor.findOne().lean();
      }
      if (!doc) {
        return { available: false, message: 'Doctor not found.' };
      }

      // Check existing bookings for that date
      const booked = await Appointment.find({
        $or: [{ doctorId: doc.id }, { doctorId }],
        date,
        status: { $ne: 'cancelled' }
      }).select('time').lean();
      const bookedTimes = new Set(booked.map(b => b.time));

      // Standard clinical slots
      const candidateSlots = ['09:30 AM', '10:15 AM', '11:00 AM', '11:45 AM', '02:00 PM', '02:45 PM', '03:30 PM', '04:15 PM'];
      const openSlots = candidateSlots.filter(t => !bookedTimes.has(t));

      return {
        doctorId: doc.id,
        doctorName: doc.name,
        clinicName: doc.clinicName,
        consultationFee: doc.consultationFee || 0,
        date,
        availableSlots: openSlots,
        teleconsultationAvailable: !!doc.teleconsultation
      };
    }
  },

  createAppointment: {
    name: 'createAppointment',
    description: 'Books a clinical consultation with a doctor. REQUIRES EXPLICIT USER CONFIRMATION (userConfirmed=true). If not confirmed, returns confirmation_required prompt.',
    parameters: {
      type: 'object',
      properties: {
        doctorId: { type: 'string', description: 'Doctor ID to book with' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Time slot (e.g. "10:15 AM")' },
        mode: { type: 'string', enum: ['in-person', 'teleconsultation'], description: 'Consultation mode' },
        chiefComplaint: { type: 'string', description: 'Summary of patient symptoms' },
        userConfirmed: {
          type: 'boolean',
          description: 'True ONLY if the user has explicitly confirmed they want to book this appointment.'
        }
      },
      required: ['doctorId', 'date', 'time', 'userConfirmed']
    },
    execute: async (args, context) => {
      const { doctorId, date, time, mode = 'in-person', chiefComplaint = 'General Consultation', userConfirmed } = args;

      let doc = await Doctor.findOne({ $or: [{ id: doctorId }, { id: doctorId.replace('_', '') }] }).lean();
      if (!doc) {
        doc = await Doctor.findOne().lean();
      }
      if (!doc) {
        return { success: false, message: `Doctor ${doctorId} not found.` };
      }

      // ─── STRICT WRITE SAFEGUARD ──────────────────────────────────────
      if (userConfirmed !== true) {
        return {
          status: 'confirmation_required',
          requiresUserConfirmation: true,
          message: `Please confirm: Would you like to book an ${mode} appointment with ${doc.name} (${doc.specialty}) at ${doc.clinicName} on ${date} at ${time}? Consultation fee is ₹${doc.consultationFee || 0}.`,
          appointmentDetails: {
            doctorId: doc.id,
            doctorName: doc.name,
            specialty: doc.specialty,
            clinicName: doc.clinicName,
            clinicAddress: doc.clinicAddress,
            date,
            time,
            mode,
            fee: doc.consultationFee || 0,
            chiefComplaint
          }
        };
      }

      // ─── CHECK SLOT AVAILABILITY / CONFLICT ──────────────────────────
      const existing = await Appointment.findOne({
        $or: [{ doctorId: doc.id }, { doctorId }],
        date,
        time,
        status: { $ne: 'cancelled' }
      });
      if (existing) {
        return {
          status: 'conflict',
          success: false,
          message: `The slot at ${time} on ${date} was just booked. Please choose another time.`
        };
      }

      // ─── EXECUTE CONFIRMED BOOKING ───────────────────────────────────
      const patientId = context?.user?.patientId || 'patient_guest';
      const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const newApt = await Appointment.create({
        id: appointmentId,
        patientId,
        doctorId: doc.id,
        date,
        time,
        status: 'confirmed',
        mode,
        chiefComplaint,
        createdAt: new Date().toISOString()
      });

      return {
        status: 'booked',
        success: true,
        appointmentId: newApt.id,
        doctorName: doc.name,
        specialty: doc.specialty,
        clinicName: doc.clinicName,
        clinicAddress: doc.clinicAddress,
        date,
        time,
        mode,
        fee: doc.consultationFee || 0,
        message: `✅ Appointment successfully confirmed with ${doc.name} on ${date} at ${time}.`
      };
    }
  },

  cancelAppointment: {
    name: 'cancelAppointment',
    description: 'Cancels a previously booked appointment. REQUIRES EXPLICIT USER CONFIRMATION (userConfirmed=true).',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID of the appointment to cancel' },
        userConfirmed: { type: 'boolean', description: 'Explicit user confirmation flag' }
      },
      required: ['appointmentId', 'userConfirmed']
    },
    execute: async (args) => {
      const { appointmentId, userConfirmed } = args;
      if (userConfirmed !== true) {
        return {
          status: 'confirmation_required',
          requiresUserConfirmation: true,
          message: `Are you sure you want to cancel appointment ${appointmentId}?`
        };
      }

      const apt = await Appointment.findOneAndUpdate(
        { id: appointmentId },
        { status: 'cancelled' },
        { new: true }
      );

      if (!apt) {
        return { success: false, message: `Appointment ${appointmentId} not found.` };
      }

      return {
        status: 'cancelled',
        success: true,
        appointmentId,
        message: `Appointment ${appointmentId} has been cancelled.`
      };
    }
  }
};

module.exports = appointmentTools;
