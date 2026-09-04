const express = require('express');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Reservation = require('../models/Reservation');
const Patient = require('../models/Patient');
const Ambulance = require('../models/Ambulance');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const genId = require('../utils/id');
const { writeAudit } = require('../utils/audit');
const { sendNotification } = require('../utils/notify');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const results = [];

    for (const item of items) {
      try {
        const { action, payload } = item;
        let entityId = null;

        if (action === 'book_appointment') {
          const patientId = req.user.role === 'PATIENT' ? req.user.patientId : payload.patientId;
          const appt = await Appointment.create({
            id: genId('appt'),
            patientId,
            doctorId: payload.doctorId,
            date: payload.date,
            time: payload.time,
            mode: payload.mode || 'in-person',
            chiefComplaint: payload.chiefComplaint || payload.reason,
            aiTriageSummary: payload.aiTriageSummary,
            aiSymptoms: payload.aiSymptoms,
            urgency: payload.urgency || 'routine',
            status: 'confirmed',
            createdAt: payload.createdAt || new Date().toISOString(),
          });
          entityId = appt.id;

          await sendNotification({
            recipientId: payload.doctorId,
            role: 'DOCTOR',
            type: 'appointment',
            title: 'New Appointment Booked (Synced)',
            message: `Appointment booked by ${req.user.name} for ${appt.date} at ${appt.time}.`,
            relatedEntity: { type: 'appointment', id: appt.id },
          });
        } else if (action === 'cancel_appointment') {
          const appt = await Appointment.findOne({ id: payload.appointmentId || payload.id });
          if (appt) {
            appt.status = 'cancelled';
            await appt.save();
            entityId = appt.id;
          }
        } else if (action === 'reserve_medicine') {
          const patientId = req.user.role === 'PATIENT' ? req.user.patientId : payload.patientId;
          const token = `RC-${Math.floor(1000 + Math.random() * 8999)}`;
          const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();

          const resv = await Reservation.create({
            id: genId('resv'),
            prescriptionId: payload.prescriptionId,
            pharmacyId: payload.pharmacyId,
            patientId,
            patientName: req.user.name,
            reservationToken: token,
            items: payload.items || [],
            totalCost: payload.totalCost || 0,
            status: 'reserved',
            reservedAt: new Date().toISOString(),
            expiresAt,
          });
          entityId = resv.id;

          await Prescription.updateOne(
            { id: payload.prescriptionId },
            { $set: { pharmacyId: payload.pharmacyId, reservationToken: token } }
          );

          await sendNotification({
            recipientId: payload.pharmacyId,
            role: 'PHARMACIST',
            type: 'reservation',
            title: 'New Medicine Reservation (Synced)',
            message: `Reservation token ${token} received for prescription hold.`,
            relatedEntity: { type: 'reservation', id: resv.id },
          });
        } else if (action === 'update_patient') {
          const patientId = req.user.role === 'PATIENT' ? req.user.patientId : payload.patientId;
          if (patientId) {
            const patient = await Patient.findOne({ id: patientId });
            if (patient) {
              const before = patient.toObject();
              delete payload.id;
              delete payload._id;
              delete payload.abhaId;
              Object.assign(patient, payload);
              await patient.save();
              entityId = patient.id;

              await writeAudit({
                actorId: req.user.sub,
                actorRole: req.user.role,
                action: 'patient.sync_update',
                entityType: 'patient',
                entityId: patient.id,
                before: { name: before.name, phone: before.phone },
                after: { name: patient.name, phone: patient.phone },
              });
            }
          }
        } else if (action === 'request_emergency') {
          const ambulance = await Ambulance.findOneAndUpdate(
            { status: 'available' },
            {
              $set: {
                status: 'dispatched',
                patientName: payload.patientName || req.user.name,
                pickup: payload.location || 'Emergency Location',
                eta: '12 mins',
              },
            },
            { new: true }
          );
          if (ambulance) entityId = ambulance.id;
        }

        results.push({
          id: item.id,
          action: item.action,
          status: 'synced',
          entityId,
        });
      } catch (err) {
        results.push({
          id: item.id,
          action: item.action,
          status: 'failed',
          error: err.message,
        });
      }
    }

    return ok(res, {
      total: items.length,
      synced: results.filter(r => r.status === 'synced').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
      serverTime: new Date().toISOString(),
    });
  })
);

module.exports = router;
