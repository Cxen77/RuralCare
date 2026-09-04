# RuralCare Network
## Product Requirements Document (PRD)
### Integrated Rural Healthcare Access, Coordination & Offline Continuity Platform

> **Single source of truth:** This document defines the intended product scope and architecture for implementation. Coding assistants and team members should follow it instead of inventing unrelated functionality.  
> **SIH 2026 alignment:** Software problem statement: *"Accessibility and quality of public healthcare services, particularly in rural and underserved areas."*  
> **Core safety rule:** AI assists with symptom intake, triage, information and coordination. Doctors remain responsible for diagnosis, treatment and prescriptions. AI must not independently diagnose or prescribe.

---

## 1. Product Vision

RuralCare Network connects patients, doctors, pharmacies, hospitals and emergency transport through three applications: **Patient App**, **Hospital App**, and **Pharmacy/Medical Store App**. A shared backend coordinates the complete care journey. The Patient App supports offline continuity using on-device AI and cached local healthcare information, then synchronizes securely when connectivity returns.

```text
Patient
  ↓
AI-assisted symptom intake
  ↓
Doctor / specialty matching
  ↓
Consultation
  ↓
Doctor prescription
  ↓
Pharmacy availability network
  ↓
Medicine reservation / pickup
  ↓
Further-care referral
  ↓
Hospital capability matching
  ↓
Hospital acceptance
  ↓
Ambulance / self-transport
  ↓
Hospital care
  ↓
Follow-up
```

---

## 2. Goals

- Improve access to appropriate healthcare in rural and underserved areas.
- Connect patients, doctors, pharmacies, hospitals and emergency transport.
- Reduce unnecessary trips caused by unavailable medicines, beds, doctors or diagnostics.
- Provide offline-first operation for intermittent connectivity.
- Use AI without making the product dependent on a custom medical-diagnosis model.
- Make the patient journey traceable from first contact through referral and follow-up.

---

## 3. Safety / Non-Goals

- Do not make custom disease diagnosis the core feature.
- Do not let AI prescribe medication or replace a doctor.
- Do not present cached inventory or hospital capacity as live data.
- Do not expose a patient's complete medical history to a pharmacy unnecessarily.
- Do not make emergency care dependent on internet availability.
- Do not make the SIH demo depend on an actual pharmacy/hospital answering an automated call.

---

## 4. Three Applications

### 4.1 Patient App
- Registration and secure login.
- Patient profile: demographics, location, emergency contact, blood group, allergies, medications and relevant history.
- Multilingual and voice-first symptom intake.
- Online AI-assisted symptom extraction and preliminary triage.
- Offline on-device speech recognition, symptom extraction and conservative triage.
- Emergency red-flag screening.
- Doctor and specialty discovery.
- Appointment booking and reminders.
- Audio/video/chat consultation.
- Prescription and medical-record access.
- Nearby pharmacy search and medicine availability.
- Prescription-based pharmacy matching and reservation.
- Route planning to one or multiple pharmacies.
- Hospital referral tracking.
- Hospital capability matching and acceptance status.
- Ambulance request/tracking where supported.
- Offline cache, pending-action queue and automatic synchronization.
- Notifications and follow-up reminders.

### 4.2 Hospital App
- Hospital registration/profile.
- Departments and specialties.
- Doctor availability.
- General/emergency/ICU bed availability.
- Diagnostic and laboratory availability.
- Blood availability where applicable.
- Referral inbox.
- Referral accept/reject with reason.
- Permitted patient/referral information.
- Ambulance availability and dispatch.
- Patient arrival/check-in.
- Treatment and follow-up workflow.
- Offline queue for temporary connectivity loss.

### 4.3 Pharmacy / Medical Store App
- Pharmacy registration/profile.
- Location and opening hours.
- Medicine inventory.
- Quantity, availability, batch/expiry where required.
- Prescription requests.
- Availability response: full/partial/unavailable.
- Medicine reservation.
- Alternative pharmacy discovery.
- Pickup/order status.
- Optional AI voice-agent confirmation.
- Inventory synchronization and audit history.

---

## 5. Shared Backend Architecture

The three apps never directly access one another's databases. All communication goes through shared backend APIs/services.

```text
Patient App   ──┐
Hospital App  ──┼──> [ API / Backend Gateway ] ──> [ Database ]
Pharmacy App  ──┘             │
                              ├── AI Services
                              ├── Notifications
                              ├── Maps / Routing
                              ├── Offline Sync
                              └── Audit / Security
```

### 5.1 Backend Services
- Authentication and identity.
- Role-based access control.
- Patient and provider management.
- Appointments and consultations.
- AI triage.
- Prescriptions.
- Pharmacy inventory and matching.
- Hospital capability matching.
- Referrals.
- Ambulance coordination.
- Notifications.
- Medical records/documents.
- Maps/routing.
- Offline synchronization.
- Audit/security.
- Analytics.

---

## 6. AI Architecture

```text
                      ┌───────────────────────────┐
                      │         AI LAYER          │
                      └─────────────┬─────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ↓                         ↓                         ↓
   [ On-Device AI ]           [ Online AI ]           [ Voice Agent ]
  • Speech recognition      • Richer conversation   • Pharmacy / Hospital
  • Text extraction         • Controlled RAG          automated phone calls
  • Conservative triage     • Document assist       • Records responses &
  • Works offline           • Translation             timestamps only
          │                         │
          └─────────────────────────┴─────────> Specialty Routing
```

- **On-device AI:** Lightweight speech recognition, symptom extraction, language handling and conservative triage/routing. It continues working without internet.
- **Online AI:** Richer conversation, controlled RAG-based healthcare information, document assistance and translation where appropriate.
- **Voice agent:** Optional automated phone confirmation. It records responses and timestamps and never makes clinical decisions.

---

## 7. Online / Offline

### 7.1 Online
```text
Internet available
  ↓
Live backend services
  ↓
Live doctor / pharmacy / hospital information
  ↓
Local cache updated
```

### 7.2 Offline
```text
Internet unavailable
  ↓
Connectivity Manager detects offline state
  ↓
On-device AI remains available
  ↓
Encrypted local database
  ↓
Cached doctors / pharmacies / hospitals
  ↓
Phone-call contacts where cellular service exists
  ↓
Server-dependent actions enter Pending Sync Queue
  ↓
Internet returns → Secure synchronization
```

> **Important:** No internet does not necessarily mean no cellular phone service. A patient may call a cached doctor or emergency contact. Live inventory, live bed availability and live referral acceptance cannot be guaranteed offline. Cached information must show a last-synchronized timestamp and must be labeled as last-known/stale where appropriate.

---

## 8. Local Data Pre-Fetch

- Nearby doctor directory: name, specialty, facility, phone, hours and language where available.
- Nearby hospital directory: name, location, phone, specialties and configured capabilities.
- Nearby pharmacy directory: name, location, phone, hours and last-known services/inventory.
- Emergency contacts.
- Patient's own encrypted profile and relevant records.
- Offline AI models.
- Pending actions created while offline.

---

## 9. Core Workflows

### 9.1 Patient Journey
1. Patient opens app.
2. Speaks/types symptoms.
3. AI extracts symptoms and performs preliminary triage.
4. System recommends specialty.
5. Patient selects doctor.
6. Appointment is booked.
7. Doctor consults patient.
8. Doctor makes clinical decision and may prescribe.
9. Prescription enters pharmacy network.
10. Nearby pharmacies are checked.
11. Pharmacies respond with availability.
12. Best complete-fulfilment option is selected.
13. Patient reserves/collects medicine.
14. If further care is needed, doctor creates referral.
15. Hospitals are searched by required capabilities.
16. Hospital accepts/rejects.
17. Patient chooses ambulance or self-transport where appropriate.
18. Ambulance is dispatched if requested/available.
19. Hospital receives referral information.
20. Patient checks in and receives care.
21. Follow-up is recorded.

### 9.2 Pharmacy Matching
```text
Prescription
  ↓
Required medicines
  ↓
Search nearby pharmacies
  ↓
Live / last-known inventory
  ↓
Medicine completeness
  ↓
Distance / travel time
  ↓
Opening hours / confirmation
  ↓
Best option
  ↓
Reservation
```
*The recommendation should prioritize complete prescription fulfillment with the fewest practical trips, not merely the closest store.*

### 9.3 Hospital Matching
```text
Referral requirements
  ↓
Specialty + bed + diagnostics + other required services
  ↓
Hospital capability search
  ↓
Hospital confirmation
  ↓
Accepted hospital
  ↓
Transport coordination
```

---

## 10. Hospital Capability Model

- Specialties/departments.
- Doctor availability.
- General, emergency and ICU beds.
- Diagnostic services such as CBC, X-ray, CT, MRI or ultrasound.
- Blood availability where applicable.
- Emergency services.
- Ambulance availability.
- Operating/service hours.

---

## 11. Pharmacy Inventory Model

- Medicine name.
- Strength/form.
- Available quantity.
- Availability status.
- Batch/expiry where implemented.
- Last updated time.
- Reservation status.
- Optional price information.

*Live availability should be based on recent synchronization or direct confirmation. Offline information must be labeled as last-known status.*

---

## 12. Data Model

- `User`
- `Patient`
- `Doctor`
- `Hospital`
- `Pharmacy`
- `Appointment`
- `Consultation`
- `Prescription`
- `PrescriptionItem`
- `Medicine`
- `InventoryItem`
- `PharmacyRequest`
- `MedicineReservation`
- `Referral`
- `HospitalCapability`
- `Bed`
- `DiagnosticService`
- `BloodInventory`
- `Ambulance`
- `EmergencyRequest`
- `MedicalRecord`
- `MedicalDocument`
- `Notification`
- `SyncQueueItem`
- `AuditLog`

---

## 13. Roles and Access

- **Patient:** Own profile, records, appointments, prescriptions, referrals and permitted care information.
- **Doctor:** Patient information required for consultation/treatment.
- **Hospital Administrator:** Hospital resources, referrals and permitted patient information.
- **Pharmacist:** Prescription/dispensing information required to fulfill medicines, not unrestricted medical history.
- **System Administrator:** Operational management with strict audit logging.

---

## 14. Security & Privacy

- Secure authentication.
- Role-based authorization.
- Encryption in transit.
- Encryption for sensitive local storage.
- Consent-aware medical-record access.
- Audit logs for sensitive access and major actions.
- Minimum-data principle.
- Secure session/token handling.
- Separation of public facility data from private patient data.
- Protection of offline data if a device is lost.

---

## 15. Notifications

- **Patient:** Appointment, prescription, pharmacy response, reservation, referral status, hospital acceptance, ambulance status and follow-up.
- **Pharmacy:** Prescription request, reservation, cancellation and inventory alerts.
- **Hospital:** Referral request, emergency request, ambulance request, patient arrival and relevant updates.

---

## 16. SIH MVP

- Patient registration.
- Voice/text symptom intake.
- Offline-capable local AI demo.
- Online AI triage.
- Specialty recommendation.
- Doctor listing and appointment.
- Consultation demo/integration.
- Doctor prescription.
- Pharmacy registration and inventory.
- Prescription-to-pharmacy matching.
- Availability response.
- Medicine reservation.
- Hospital capability dashboard.
- Referral creation.
- Hospital matching and accept/reject.
- Ambulance request/status.
- Offline cache and synchronization demo.
- Notifications.
- Basic role-based security.

*Build the complete journey first. Advanced features should be added only after the core workflow is stable.*

---

## 17. Advanced Features

- AI voice-agent pharmacy confirmation.
- Multilingual voice interaction.
- Offline maps.
- Advanced route optimization.
- Hospital resource analytics/forecasting.
- Government/admin analytics dashboard.
- Health-worker mode.
- SMS fallback.
- Document OCR.
- Advanced offline conflict resolution.
- Expanded real-world facility/inventory integrations.

---

## 18. SIH Demo Scenario

```text
Rural patient → speaks symptoms
  → on-device AI works offline
  → local doctor directory available
  → online when available → appointment
  → doctor consultation
  → doctor prescription
  → pharmacy network searches medicines
  → complete prescription matched
  → medicine reserved
  → further treatment required
  → referral created
  → hospitals checked for specialty/bed/diagnostics
  → hospital accepts
  → ambulance requested
  → ambulance dispatched
  → hospital receives referral information
  → patient arrives
  → care and follow-up
```

---

## 19. Product Differentiation

- Healthcare-service orchestration rather than a simple telemedicine app.
- Three connected operational applications.
- Real resource/capability matching.
- Offline-first patient continuity.
- On-device + online hybrid AI.
- Pharmacy network coordination.
- Hospital referral and acceptance workflow.
- Ambulance coordination.
- End-to-end traceability.

---

## 20. Development Rules for the Coding AI

- **Treat this PRD as the source of truth.**
- **Do not add unrelated modules without explicit approval.**
- **Keep Patient, Hospital and Pharmacy apps modular.**
- **Use APIs for inter-app communication.**
- **Use mock/test data where live integrations are unavailable.**
- **Prefer deterministic logic for matching, routing and resource calculations.**
- **AI must have a clearly defined role.**
- **Never make the product depend on custom medical diagnosis accuracy.**
- **Every feature must define online and offline behavior.**
- **All cached data must have timestamps and stale-data handling.**
- **Build MVP end-to-end before advanced features.**
- **Protect healthcare data and enforce role-based access.**

---

## 21. Final Product Definition

**RuralCare Network is a healthcare access and coordination platform, not a diagnosis app.** Its core pathway is:
$$\text{Patient} \longrightarrow \text{Doctor} \longrightarrow \text{Pharmacy} \longrightarrow \text{Hospital} \longrightarrow \text{Ambulance} \longrightarrow \text{Follow-up}$$

Its differentiator is the combination of **healthcare-service orchestration**, **resource/capability matching**, **offline-first continuity** and **AI-assisted interaction**.

The platform is designed around intermittent rural connectivity: essential local information and lightweight AI remain available on-device, while live network services resume and synchronize when connectivity returns.
