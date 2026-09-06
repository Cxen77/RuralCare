// Canonical RBAC roles. Shared by the User model, auth middleware, and seed.
const ROLES = ['PATIENT', 'DOCTOR', 'PHARMACIST', 'HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'ADMIN', 'SYSTEM_ADMIN'];

module.exports = { ROLES };

