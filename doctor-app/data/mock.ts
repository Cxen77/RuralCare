export type AppointmentStatus = 'waiting' | 'in-consult' | 'done';

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  phone: string;
  bloodGroup: string;
  allergies: string[];
  abhaId: string;
  avatar: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  time: string;
  reason: string;
  triage: string;
  mode: 'clinic' | 'video';
  status: AppointmentStatus;
}

export interface PrescriptionItem {
  medicine: string;
  dose: string;
  frequency: string;
  duration: string;
}

export type PharmacyStatus = 'sent' | 'partial' | 'ready';

export interface Prescription {
  id: string;
  code: string;
  patientId: string;
  patientName: string;
  items: PrescriptionItem[];
  createdAt: string;
  pharmacyName: string;
  pharmacyStatus: PharmacyStatus;
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

export const DOCTOR = {
  name: 'Dr. Anita Sharma',
  degrees: 'MBBS, MD (General Medicine)',
  facility: 'Ramnagar PHC',
  hprId: '78-4512-9032-8871',
  languages: ['English', 'Hindi', 'Bhojpuri'],
};

export const PATIENTS: Patient[] = [
  {
    id: 'p1',
    name: 'Rajesh Kumar',
    age: 54,
    gender: 'Male',
    village: 'Ramnagar',
    phone: '+91 98765 43210',
    bloodGroup: 'B+',
    allergies: ['Penicillin'],
    abhaId: '91-4829-1029-4821',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'p2',
    name: 'Sunita Devi',
    age: 34,
    gender: 'Female',
    village: 'Belaganj',
    phone: '+91 91234 56780',
    bloodGroup: 'O+',
    allergies: [],
    abhaId: '91-4829-1029-4822',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'p3',
    name: 'Mohan Prasad',
    age: 61,
    gender: 'Male',
    village: 'Kurtha',
    phone: '+91 99887 76655',
    bloodGroup: 'A+',
    allergies: ['Sulfa drugs'],
    abhaId: '91-4829-1029-4823',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'p4',
    name: 'Phoolmati Rai',
    age: 47,
    gender: 'Female',
    village: 'Ramnagar',
    phone: '+91 90011 22334',
    bloodGroup: 'AB+',
    allergies: [],
    abhaId: '91-4829-1029-4824',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
];

export const APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    patientId: 'p1',
    time: '02:00 PM',
    reason: 'Stomach pain & mild fever (2 days)',
    triage: 'AI Triage: Acute abdominal pain, fever 100.2°F, nausea. Suggested: General Medicine.',
    mode: 'clinic',
    status: 'waiting',
  },
  {
    id: 'a2',
    patientId: 'p2',
    time: '02:30 PM',
    reason: 'Persistent cough, weakness',
    triage: 'AI Triage: Low-grade fever, 8-day cough. Suggested: General Medicine.',
    mode: 'video',
    status: 'waiting',
  },
  {
    id: 'a3',
    patientId: 'p3',
    time: '03:00 PM',
    reason: 'Follow-up: hypertension review',
    triage: 'Walk-in follow-up. Last BP 150/95.',
    mode: 'clinic',
    status: 'waiting',
  },
  {
    id: 'a4',
    patientId: 'p4',
    time: '01:15 PM',
    reason: 'Knee pain, swelling right leg',
    triage: 'AI Triage: Joint pain, no red flags. Suggested: Orthopedics if persistent.',
    mode: 'clinic',
    status: 'done',
  },
];

export const PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx1',
    code: 'RX-882190',
    patientId: 'p4',
    patientName: 'Phoolmati Rai',
    items: [
      { medicine: 'Paracetamol 650mg', dose: '1 tablet', frequency: 'Twice daily', duration: '5 days' },
      { medicine: 'Calcium + Vitamin D3', dose: '1 tablet', frequency: 'Once daily', duration: '30 days' },
    ],
    createdAt: 'Today • 01:40 PM',
    pharmacyName: 'Ramnagar PHC Pharmacy',
    pharmacyStatus: 'sent',
  },
  {
    id: 'rx0',
    code: 'RX-881844',
    patientId: 'p3',
    patientName: 'Mohan Prasad',
    items: [
      { medicine: 'Telmisartan 40mg', dose: '1 tablet', frequency: 'Once daily', duration: '30 days' },
    ],
    createdAt: 'Yesterday • 04:20 PM',
    pharmacyName: 'Gramin Seva Medicals',
    pharmacyStatus: 'ready',
  },
];

export const REFERRALS: Referral[] = [
  {
    id: 'r1',
    patientName: 'Ramesh Sah',
    specialty: 'Cardiology',
    beds: 'General (2 days)',
    diagnostics: ['ECG', 'Echo'],
    urgency: 'priority',
    status: 'pending',
    createdAt: 'Today • 11:05 AM',
  },
];
