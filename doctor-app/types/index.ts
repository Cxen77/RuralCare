/**
 * Canonical domain types for RuralCare Doctor App.
 * Completely decoupled from mock data.
 */

export type AppointmentStatus = 'waiting' | 'in-consult' | 'done';

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  phone: string;
  bloodGroup?: string;
  allergies: string[];
  abhaId: string;
  avatar?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  date?: string;
  time: string;
  reason: string;
  triage: string;
  mode: 'clinic' | 'video';
  status: AppointmentStatus;
  patient?: Patient | null;
}

export interface PrescriptionItem {
  medicine: string;
  dose: string;
  frequency: string;
  duration: string;
}

export type PharmacyStatus = 'pending' | 'sent' | 'confirmed' | 'preparing' | 'ready' | 'dispensed' | 'partial';

export interface Prescription {
  id: string;
  code: string;
  patientId: string;
  patientName: string;
  items: PrescriptionItem[];
  createdAt: string;
  pharmacyName: string;
  pharmacyStatus: PharmacyStatus;
  diagnosis?: string;
  doctorName?: string;
  rawItems?: any[];
}

export type Urgency = 'routine' | 'priority' | 'emergency';
export type ReferralStatus = 'pending' | 'accepted' | 'rejected';

export interface Referral {
  id: string;
  patientName: string;
  specialty: string;
  beds: string;
  diagnostics: string[];
  urgency: Urgency;
  status: ReferralStatus;
  hospitalName?: string;
  createdAt: string;
}

export interface DoctorProfileData {
  id?: string;
  name: string;
  degrees: string;
  specialty?: string;
  facility: string;
  clinicAddress?: string;
  hprId: string;
  phone?: string;
  languages: string[];
  consultationFee?: number;
  maxPatientsPerDay?: number;
  ayushmanPaneled?: boolean;
  teleconsultation?: boolean;
  latitude?: number;
  longitude?: number;
}
