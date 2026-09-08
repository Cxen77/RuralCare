const ApiError = require('./ApiError');

// Canonical status graphs. Any status change is validated against these;
// an illegal move throws 409 INVALID_TRANSITION.
const TRANSITIONS = {
  appointment: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['waiting', 'in_consultation', 'cancelled', 'no_show'],
    waiting: ['in_consultation', 'cancelled', 'no_show'],
    in_consultation: ['completed'],
    completed: [],
    cancelled: [],
    no_show: [],
  },
  prescription: {
    pending: ['sent_to_pharmacy', 'confirmed', 'preparing', 'ready_for_pickup', 'partial', 'dispensed', 'cancelled'],
    sent_to_pharmacy: ['confirmed', 'preparing', 'ready_for_pickup', 'partial', 'dispensed', 'cancelled'],
    confirmed: ['preparing', 'ready_for_pickup', 'partial', 'dispensed', 'cancelled'],
    preparing: ['ready_for_pickup', 'partial', 'dispensed', 'cancelled'],
    ready_for_pickup: ['dispensed', 'cancelled'],
    partial: ['confirmed', 'preparing', 'ready_for_pickup', 'dispensed', 'cancelled'],
    dispensed: [],
    cancelled: [],
  },
  reservation: {
    pending: ['reserved', 'cancelled'],
    reserved: ['ready_for_pickup', 'picked_up', 'cancelled', 'expired'],
    ready_for_pickup: ['picked_up', 'cancelled', 'expired'],
    picked_up: [],
    cancelled: [],
    expired: [],
  },
  referral: {
    // created/searching/pending_hospital_response reserved for Phase 10-12 hospital matching
    created: ['searching', 'pending', 'cancelled'],
    searching: ['pending_hospital_response', 'cancelled'],
    pending_hospital_response: ['accepted', 'rejected', 'cancelled'],
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['transferred', 'admitted', 'cancelled'],
    rejected: [],
    transferred: ['admitted', 'completed'],
    admitted: ['completed'],
    completed: [],
    cancelled: [],
  },
  ambulance: {
    // full dispatch lifecycle wired in Phase 13; portal currently does available<->dispatched
    available: ['requested', 'assigned', 'dispatched', 'maintenance'],
    requested: ['assigned', 'available'],
    assigned: ['dispatched', 'available'],
    dispatched: ['en_route', 'available'],
    en_route: ['arrived', 'available'],
    arrived: ['transporting'],
    transporting: ['at_hospital'],
    at_hospital: ['returning'],
    returning: ['available'],
    maintenance: ['available'],
  },
};

function assertTransition(entity, from, to) {
  if (from === to) return; // no-op PATCH is idempotent, always allowed
  const map = TRANSITIONS[entity];
  if (!map) {
    throw new ApiError(500, 'UNKNOWN_ENTITY', `No transition map for entity: ${entity}`);
  }
  const allowed = map[from] || [];
  if (!allowed.includes(to)) {
    throw new ApiError(
      409,
      'INVALID_TRANSITION',
      `Cannot move ${entity} from "${from}" to "${to}".`
    );
  }
}

module.exports = { TRANSITIONS, assertTransition };
