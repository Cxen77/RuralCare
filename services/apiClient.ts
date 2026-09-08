/**
 * RuralCare API client (patient app).
 *
 * Single entry point for every backend call. Owns the auth token, unwraps the
 * server's { success, data } envelope, and turns error envelopes into ApiError.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function resolveInitialApiBase(): string {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('apiUrl');
    if (fromQuery) return fromQuery.replace(/\/+$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }
  return (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

const CANDIDATE_HOSTS = [
  resolveInitialApiBase(),
  'https://ruralcare-sia2.onrender.com',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://192.168.1.107:4000',
  'http://192.168.1.11:4000',
].filter(Boolean) as string[];

let activeApiBase = resolveInitialApiBase();

export const API_BASE_URL = activeApiBase;

const TOKEN_KEY = 'ruralcare.auth.token';
const USER_KEY = 'ruralcare.auth.user';

export type Role =
  | 'PATIENT'
  | 'DOCTOR'
  | 'PHARMACIST'
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_STAFF'
  | 'ADMIN'
  | 'SYSTEM_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  patientId?: string;
  doctorId?: string;
  pharmacyId?: string;
  hospitalId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** True when the request never reached the server, so the caller can queue it. */
  get isOffline(): boolean {
    return this.code === 'NETWORK_UNREACHABLE';
  }
}

let token: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const onSessionExpired = (handler: (() => void) | null) => {
  sessionExpiredHandler = handler;
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  { auth = true }: { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const hostsToTry = [
    activeApiBase,
    ...CANDIDATE_HOSTS.filter(h => h.replace(/\/+$/, '') !== activeApiBase)
  ];

  let lastError: Error | null = null;

  for (const host of hostsToTry) {
    const cleanHost = host.replace(/\/+$/, '');
    const url = `${cleanHost}/api${path}`;
    const controller = new AbortController();
    const timeoutMs = path.startsWith('/ai') ? 35000 : 12000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If success or valid HTTP status response, lock in this working host
      activeApiBase = cleanHost;

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const code = payload?.error?.code || 'REQUEST_FAILED';
        const message = payload?.error?.message || 'Something went wrong. Please try again.';
        if (response.status === 401) {
          await clearSession();
          sessionExpiredHandler?.();
        }
        throw new ApiError(response.status, code, message);
      }

      return payload?.data as T;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;
      if (err instanceof ApiError) {
        // Legitimate application error from server, don't try other hosts
        throw err;
      }
      // Otherwise network failure, continue to next candidate host
    }
  }

  throw new ApiError(0, 'NETWORK_UNREACHABLE', lastError?.message || 'Cannot reach RuralCare right now.');
}

// ─── Session ──────────────────────────────────────────────────────────────

async function clearSession() {
  token = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export const session = {
  /** Rehydrates a stored token on cold start. Returns null when signed out. */
  async restore(): Promise<AuthUser | null> {
    const [storedToken, storedUser] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    if (!storedToken || !storedUser) return null;
    token = storedToken;
    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      await clearSession();
      return null;
    }
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const data = await request<{ token: string; user: AuthUser }>(
      'POST',
      '/auth/login',
      { email, password },
      { auth: false }
    );
    token = data.token;
    await AsyncStorage.multiSet([
      [TOKEN_KEY, data.token],
      [USER_KEY, JSON.stringify(data.user)],
    ]);
    return data.user;
  },

  async logout(): Promise<void> {
    await clearSession();
  },

  me: () => request<AuthUser>('GET', '/auth/me'),

  hasToken: () => token !== null,

  /** Returns the current JWT, or null if not authenticated. */
  getToken: () => token,
};

// ─── Health (unauthenticated) ─────────────────────────────────────────────

export interface HealthReport {
  status: 'ok' | 'degraded';
  db: string;
  env: string;
  time: string;
}

export const health = async (): Promise<HealthReport> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/health`);
  } catch {
    throw new ApiError(0, 'NETWORK_UNREACHABLE', 'Cannot reach RuralCare right now.');
  }
  const payload = await response.json().catch(() => null);
  return payload?.data as HealthReport;
};

// ─── Endpoints ────────────────────────────────────────────────────────────

const query = (params: Record<string, string | undefined>) => {
  const pairs = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return pairs.length ? `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')}` : '';
};

export const apiClient = {
  // Directory
  getDoctors: () => request<any[]>('GET', '/doctors'),
  getDoctor: (id: string) => request<any>('GET', `/doctors/${id}`),
  getPharmacies: () => request<any[]>('GET', '/pharmacies'),
  getPatient: (id: string) => request<any>('GET', `/patients/${id}`),
  updatePatient: (id: string, data: unknown) => request<any>('PATCH', `/patients/${id}`, data),
  getHospitals: () => request<any[]>('GET', '/hospitals'),
  getHospital: (id: string) => request<any>('GET', `/hospitals/${id}`),

  // Appointments
  getAppointments: (params: { doctorId?: string; patientId?: string; status?: string } = {}) =>
    request<any[]>('GET', `/appointments${query(params)}`),
  getDoctorAvailability: (doctorId: string, date?: string) =>
    request<any>('GET', `/appointments/availability${query({ doctorId, date })}`),
  createAppointment: (data: unknown) => request<any>('POST', '/appointments', data),
  updateAppointment: (id: string, data: unknown) =>
    request<any>('PATCH', `/appointments/${id}`, data),

  // Consultations
  getConsultations: (params: { doctorId?: string; patientId?: string } = {}) =>
    request<any[]>('GET', `/consultations${query(params)}`),
  createConsultation: (data: unknown) => request<any>('POST', '/consultations', data),
  updateConsultation: (id: string, data: unknown) =>
    request<any>('PATCH', `/consultations/${id}`, data),

  // Prescriptions
  getPrescriptions: (params: { patientId?: string; doctorId?: string } = {}) =>
    request<any[]>('GET', `/prescriptions${query(params)}`),
  createPrescription: (data: unknown) => request<any>('POST', '/prescriptions', data),
  updatePrescription: (id: string, data: unknown) =>
    request<any>('PATCH', `/prescriptions/${id}`, data),

  // Pharmacy fulfilment & Matching
  getPharmacyRequests: (params: { pharmacyId?: string; status?: string } = {}) =>
    request<any[]>('GET', `/pharmacy/requests${query(params)}`),
  matchPharmacies: (data: { prescriptionId?: string; items?: any[] }) =>
    request<any>('POST', '/pharmacy/match', data),

  // Reservations
  getReservations: (params: { pharmacyId?: string; patientId?: string; status?: string } = {}) =>
    request<any[]>('GET', `/reservations${query(params)}`),
  createReservation: (data: unknown) => request<any>('POST', '/reservations', data),
  updateReservation: (id: string, data: unknown) =>
    request<any>('PATCH', `/reservations/${id}`, data),
  dispenseReservation: (id: string, data?: unknown) =>
    request<any>('POST', `/reservations/${id}/dispense`, data),

  // Referrals & Hospital Matching
  getReferrals: (params: { patientId?: string; hospitalId?: string; status?: string } = {}) =>
    request<any[]>('GET', `/referrals${query(params)}`),
  createReferral: (data: unknown) => request<any>('POST', '/referrals', data),
  updateReferral: (id: string, data: unknown) => request<any>('PATCH', `/referrals/${id}`, data),
  matchHospitals: (data: { specialty?: string; beds?: string; diagnostics?: string[] }) =>
    request<any>('POST', '/hospitals/match', data),

  // Ambulances
  getAmbulances: (params: { hospitalId?: string; status?: string } = {}) =>
    request<any[]>('GET', `/ambulances${query(params)}`),
  requestAmbulance: (data: unknown) => request<any>('POST', '/ambulances/request', data),

  // Notifications
  getNotifications: (params: { recipientId?: string; unread?: string; read?: string } = {}) =>
    request<any[]>('GET', `/notifications${query(params)}`),
  markNotificationRead: (id: string) => request<any>('PATCH', `/notifications/${id}`, { read: true }),

  // Offline Sync Queue
  syncBatch: (items: any[]) =>
    request<{ results: any[]; serverTime: string }>('POST', '/sync', { items }),

  // AI
  aiTriage: (data: unknown) => request<any>('POST', '/ai/triage', data),
  aiChat: (data: unknown) => request<any>('POST', '/ai/chat', data),

  // AI Conversation History
  getAiConversations: () => request<any[]>('GET', '/ai/conversations'),
  getAiConversation: (id: string) => request<any>('GET', `/ai/conversations/${id}`),
  deleteAiConversation: (id: string) => request<any>('DELETE', `/ai/conversations/${id}`),

  // Appointment Chat Messages
  getAppointmentMessages: (appointmentId: string) =>
    request<any[]>('GET', `/appointments/${appointmentId}/messages`),
  sendAppointmentMessage: (appointmentId: string, text: string) =>
    request<any>('POST', `/appointments/${appointmentId}/messages`, { text }),

  // Teleconsultation Video Access
  getVideoAccess: (appointmentId: string) =>
    request<any>('GET', `/appointments/${appointmentId}/video/access`),

  getActiveBaseUrl: () => activeApiBase,
};
