/**
 * RuralCare Data Models & TypeScript Interfaces
 * Matches PRD Section 12 data structures
 */

// ─── Patient ────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  abhaId: string; // ABHA Health ID e.g. "91-4829-1029-4821"
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: string;
  village: string;
  district: string;
  state: string;
  primaryPHC: string;
  ashaWorker: { name: string; phone: string };
  language: 'Hindi' | 'Bhojpuri' | 'Bengali' | 'English';
  ayushmanEligible: boolean;
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
}

// ─── Doctor ─────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  registrationNumber: string; // e.g. "MCI-88219"
  clinicName: string;
  clinicAddress: string;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  avatarUrl?: string;
  isAvailable: boolean;
  ayushmanPaneled: boolean;
  consultationFee: number; // 0 if Ayushman covered
  teleconsultation: boolean;
  languages?: string[];
  schedule: DoctorSchedule;
  maxPatientsPerDay: number;
}

export interface DoctorSchedule {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface TimeSlot {
  start: string; // "09:00"
  end: string; // "13:00"
  mode: 'in-person' | 'teleconsultation' | 'both';
}

// ─── Appointment ────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_consultation'
  | 'completed'
  | 'cancelled';

export type UrgencyLevel = 'high' | 'medium' | 'routine';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string; // ISO date string e.g. "2026-08-25"
  time: string; // e.g. "14:00"
  status: AppointmentStatus;
  mode: 'in-person' | 'teleconsultation';
  chiefComplaint: string;
  aiTriageSummary?: string;
  aiSymptoms?: string[];
  urgency: UrgencyLevel;
  createdAt: string;
  notes?: string;
}

// ─── Consultation ───────────────────────────────────────────────────────────

export interface Vitals {
  bloodPressure?: string; // "120/80 mmHg"
  heartRate?: number; // bpm
  temperature?: number; // °F
  spO2?: number; // %
  weight?: number; // kg
  height?: number; // cm
}

export interface Consultation {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  vitals: Vitals;
  clinicalNotes: string;
  provisionalDiagnosis: string;
  icdCode?: string;
  prescriptionId?: string;
  referralId?: string;
  followUpDate?: string;
  followUpNotes?: string;
  completedAt?: string;
  status: 'in_progress' | 'completed';
}

// ─── Prescription ───────────────────────────────────────────────────────────

export interface PrescriptionItem {
  id: string;
  drugName: string;
  genericName: string;
  dosage: string; // "500mg"
  form: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'ointment' | 'drops';
  frequency: string; // "TDS" (thrice daily), "BD", "OD", "SOS"
  duration: string; // "5 days", "7 days"
  instructions: string; // "After meals", "With warm water"
  quantity: number;
}

export interface Prescription {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  items: PrescriptionItem[];
  diagnosis: string;
  qrCode: string; // unique QR verification code
  issuedAt: string;
  validUntil: string;
  dispensingStatus: 'pending' | 'partial' | 'dispensed';
  pharmacyId?: string;
  reservationToken?: string;
}

// ─── Pharmacy ───────────────────────────────────────────────────────────────

export interface MedicineStock {
  drugName: string;
  genericName: string;
  form: string;
  dosage: string;
  quantity: number; // units in stock
  pricePerUnit: number; // in INR
  isJanAushadhi: boolean; // Government subsidized
  expiryDate: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  phone: string;
  isJanAushadhi: boolean;
  operatingHours: string; // "8:00 AM - 10:00 PM"
  inventory: MedicineStock[];
  rating: number;
}

export interface PharmacyMatchResult {
  pharmacyId: string;
  pharmacyName: string;
  distanceKm: number;
  availableItems: { drugName: string; pricePerUnit: number; quantity: number; lastUpdated?: string }[];
  missingItems: string[];
  completeness: number; // 0-1 fraction
  totalCost: number;
  isJanAushadhi: boolean;
  isOpen?: boolean;
  operatingHours?: string;
  lastUpdated?: string;
  type?: 'single' | 'split';
  splitDetails?: unknown;
}

export interface MedicineReservation {
  id: string;
  prescriptionId: string;
  pharmacyId: string;
  patientId: string;
  reservationToken: string;
  items: { drugName: string; quantity: number; pricePerUnit: number }[];
  totalCost: number;
  status: 'reserved' | 'picked_up' | 'cancelled' | 'expired';
  reservedAt: string;
  expiresAt: string;
}

// ─── Hospital ───────────────────────────────────────────────────────────────

export interface HospitalCapability {
  icuBeds: number;
  generalBeds: number;
  availableBeds: number;
  hasCtScan: boolean;
  hasMri: boolean;
  hasXray: boolean;
  hasUltrasound: boolean;
  hasPathology: boolean;
  hasBloodBank: boolean;
  specialties: string[];
  ambulanceCount: number;
}

export interface Hospital {
  id: string;
  name: string;
  type: 'PHC' | 'CHC' | 'SubDistrict' | 'District' | 'Private';
  address: string;
  distanceKm: number;
  phone: string;
  capabilities: HospitalCapability;
  rating: number;
}

// ─── Hospital Referral ──────────────────────────────────────────────────────

export type ReferralStatus = 'pending' | 'accepted' | 'rejected' | 'transferred' | 'completed';

export interface HospitalReferral {
  id: string;
  patientId: string;
  doctorId: string;
  hospitalId: string;
  consultationId: string;
  reason: string;
  requiredCapabilities: string[]; // e.g. ["ICU bed", "CT Scan", "Orthopedic Surgery"]
  urgency: UrgencyLevel;
  status: ReferralStatus;
  assignedDepartment?: string;
  assignedBed?: string;
  ambulanceDispatched: boolean;
  ambulanceEta?: string;
  notes: string;
  createdAt: string;
  respondedAt?: string;
}

// ─── Emergency / Ambulance ──────────────────────────────────────────────────

export interface EmergencyRequest {
  id: string;
  patientId: string;
  location: string;
  description: string;
  type: 'medical' | 'accident' | 'obstetric' | 'cardiac';
  status: 'dispatched' | 'en_route' | 'arrived' | 'transporting' | 'completed';
  ambulanceId?: string;
  estimatedArrival?: string;
  createdAt: string;
}

// ─── Sync & Offline ─────────────────────────────────────────────────────────

export type SyncAction =
  | 'book_appointment'
  | 'cancel_appointment'
  | 'submit_triage'
  | 'reserve_medicine'
  | 'request_emergency'
  | 'update_patient';

export interface SyncQueueItem {
  id: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userRole: 'patient' | 'doctor';
  action: string;
  details: string;
  timestamp: string;
}
