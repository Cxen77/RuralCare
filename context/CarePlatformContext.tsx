/**
 * RuralCare Platform Context
 *
 * Patient-side state. Every record shown here comes from the backend, which owns
 * ids, tokens and state transitions. Writes that cannot reach the server are
 * queued and reported as unconfirmed rather than shown as done.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  Patient,
  Doctor,
  Pharmacy,
  Hospital,
  Appointment,
  Prescription,
  HospitalReferral,
  MedicineReservation,
  UrgencyLevel,
  PharmacyMatchResult,
} from '../types/schema';
import { matchPharmacies } from '../services/pharmacyMatcher';
import { StorageService } from '../services/storageService';
import { apiClient, ApiError } from '../services/apiClient';
import { useAuth } from './AuthContext';
import { Button, LoadingOverlay } from '../components/ui';
import { Colors, Spacing, Typography } from '../constants/theme';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BookAppointmentInput {
  doctorId: string;
  date: string;
  time: string;
  mode: 'in-person' | 'teleconsultation';
  chiefComplaint: string;
  aiTriageSummary?: string;
  aiSymptoms?: string[];
  urgency?: UrgencyLevel;
}

export interface BookAppointmentResult {
  /** The record the backend created. Null when the request was queued offline. */
  appointment: Appointment | null;
  queued: boolean;
}

export interface ReserveMedicinesResult {
  /** The reservation the backend created. Null when the request was queued offline. */
  reservation: MedicineReservation | null;
  queued: boolean;
}

interface CarePlatformState {
  // Connectivity
  isOnline: boolean;
  toggleOnline: () => void;

  // Directory (server-owned, read-only)
  patient: Patient;
  doctors: Doctor[];
  pharmacies: Pharmacy[];
  hospitals: Hospital[];

  // Live State
  appointments: Appointment[];
  prescriptions: Prescription[];
  referrals: HospitalReferral[];
  reservations: MedicineReservation[];

  // Freshness
  lastSyncedAt: string | null;
  refresh: () => Promise<void>;

  // Patient Actions
  updatePatientProfile: (updated: Partial<Patient>) => Promise<void>;
  bookAppointment: (input: BookAppointmentInput) => Promise<BookAppointmentResult>;
  cancelAppointment: (appointmentId: string) => Promise<void>;
  reserveMedicines: (
    prescriptionId: string,
    pharmacyId: string,
    matchResult: PharmacyMatchResult
  ) => Promise<ReserveMedicinesResult>;
  getPharmacyMatches: (prescriptionId: string) => PharmacyMatchResult[];
  getPharmacyMatchesAsync: (prescriptionId: string) => Promise<PharmacyMatchResult[]>;

  // Emergency
  triggerSos: () => Promise<void>;

  // Sync
  pendingSyncCount: number;
  flushSync: () => Promise<{ flushed: number; failed: number }>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const CarePlatformContext = createContext<CarePlatformState | null>(null);

export const useCarePlatform = (): CarePlatformState => {
  const ctx = useContext(CarePlatformContext);
  if (!ctx) throw new Error('useCarePlatform must be used within CarePlatformProvider');
  return ctx;
};

// ─── Provider ───────────────────────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
}

export const CarePlatformProvider: React.FC<ProviderProps> = ({ children }) => {
  const { patientId } = useAuth();

  const [isOnline, setIsOnline] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [referrals, setReferrals] = useState<HospitalReferral[]>([]);
  const [reservations, setReservations] = useState<MedicineReservation[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!patientId) {
      setLoadError('This account is not linked to a patient record.');
      return;
    }
    try {
      if (isOnline) {
        const [me, docs, phcys, hosps, appts, rxs, refs, resvs] = await Promise.all([
          apiClient.getPatient(patientId),
          apiClient.getDoctors(),
          apiClient.getPharmacies(),
          apiClient.getHospitals(),
          apiClient.getAppointments(),
          apiClient.getPrescriptions(),
          apiClient.getReferrals(),
          apiClient.getReservations(),
        ]);
        
        // Cache directory data for offline AI matching
        StorageService.cacheData('patient', me);
        StorageService.cacheData('doctors', docs);
        StorageService.cacheData('pharmacies', phcys);
        StorageService.cacheData('hospitals', hosps);

        setPatient(me);
        setDoctors(docs);
        setPharmacies(phcys);
        setHospitals(hosps);
        setAppointments(appts);
        setPrescriptions(rxs);
        setReferrals(refs);
        setReservations(resvs);
        setLastSyncedAt(new Date().toISOString());
        setLoadError(null);
      } else {
        throw new Error('Offline');
      }
    } catch (e) {
      // Fallback to offline cache
      const [cachedMe, cachedDocs, cachedPhcys, cachedHosps] = await Promise.all([
        StorageService.getCachedData<Patient>('patient'),
        StorageService.getCachedData<Doctor[]>('doctors'),
        StorageService.getCachedData<Pharmacy[]>('pharmacies'),
        StorageService.getCachedData<Hospital[]>('hospitals'),
      ]);
      
      if (cachedMe?.data) setPatient(cachedMe.data);
      if (cachedDocs?.data) setDoctors(cachedDocs.data);
      if (cachedPhcys?.data) setPharmacies(cachedPhcys.data);
      if (cachedHosps?.data) setHospitals(cachedHosps.data);

      if (!cachedMe?.data && !isOnline) {
         setLoadError('You are offline and no cached profile was found.');
      } else {
         setLoadError(
           e instanceof ApiError ? e.message : 'Could not reach server. Using offline data.'
         );
      }
    }
  }, [patientId, isOnline]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (isOnline) refresh();
    }, 8000);
    return () => clearInterval(interval);
  }, [refresh, isOnline]);

  const updatePatientProfile = useCallback(
    async (updated: Partial<Patient>) => {
      setPatient(prev => (prev ? { ...prev, ...updated } : prev));
      if (!patientId) return;

      if (!isOnline) {
        StorageService.addToSyncQueue('update_patient', { patientId, ...updated });
        return;
      }

      try {
        const saved = await apiClient.updatePatient(patientId, updated);
        if (saved) setPatient(saved);
      } catch (e) {
        if (e instanceof ApiError && e.isOffline) {
          StorageService.addToSyncQueue('update_patient', { patientId, ...updated });
          return;
        }
        throw e;
      }
    },
    [isOnline, patientId]
  );

  const toggleOnline = useCallback(() => {
    setIsOnline(prev => {
      const next = !prev;
      StorageService.setOnlineStatus(next);
      if (next) {
        StorageService.flushSyncQueue();
        refresh();
      }
      return next;
    });
  }, [refresh]);

  // ─── Patient: Book Appointment ──────────────────────────────────────────
  // The backend owns the appointment id and status, so nothing is added to local
  // state until it confirms. Offline requests are queued and clearly reported as
  // unconfirmed rather than shown as booked.
  const bookAppointment = useCallback(
    async (input: BookAppointmentInput): Promise<BookAppointmentResult> => {
      const payload = { ...input, urgency: input.urgency ?? 'routine' };

      if (!isOnline) {
        StorageService.addToSyncQueue('book_appointment', payload);
        return { appointment: null, queued: true };
      }

      try {
        const created = (await apiClient.createAppointment(payload)) as Appointment;
        setAppointments(prev => [created, ...prev]);
        return { appointment: created, queued: false };
      } catch (e) {
        if (e instanceof ApiError && e.isOffline) {
          StorageService.addToSyncQueue('book_appointment', payload);
          return { appointment: null, queued: true };
        }
        throw e;
      }
    },
    [isOnline]
  );

  // ─── Patient: Cancel Appointment ────────────────────────────────────────
  const cancelAppointment = useCallback(async (appointmentId: string) => {
    const updated = (await apiClient.updateAppointment(appointmentId, {
      status: 'cancelled',
    })) as Appointment;
    setAppointments(prev => prev.map(a => (a.id === appointmentId ? updated : a)));
  }, []);

  // ─── Patient: Reserve Medicines ─────────────────────────────────────────
  // The reservation token, expiry and inventory hold are all server-side, so a
  // queued request is never shown as a live reservation.
  const reserveMedicines = useCallback(
    async (
      prescriptionId: string,
      pharmacyId: string,
      matchResult: PharmacyMatchResult
    ): Promise<ReserveMedicinesResult> => {
      const payload = {
        prescriptionId,
        pharmacyId,
        items: matchResult.availableItems,
      };

      if (!isOnline) {
        StorageService.addToSyncQueue('reserve_medicine', payload);
        return { reservation: null, queued: true };
      }

      try {
        const created = (await apiClient.createReservation(payload)) as MedicineReservation;
        setReservations(prev => [created, ...prev]);
        const rxs = (await apiClient.getPrescriptions()) as Prescription[];
        setPrescriptions(rxs);
        return { reservation: created, queued: false };
      } catch (e) {
        if (e instanceof ApiError && e.isOffline) {
          StorageService.addToSyncQueue('reserve_medicine', payload);
          return { reservation: null, queued: true };
        }
        throw e;
      }
    },
    [isOnline]
  );

  // ─── Patient: Get Pharmacy Matches ──────────────────────────────────────
  const getPharmacyMatches = useCallback(
    (prescriptionId: string): PharmacyMatchResult[] => {
      const rx = prescriptions.find(p => p.id === prescriptionId);
      if (!rx) return [];
      return matchPharmacies(rx.items, pharmacies);
    },
    [prescriptions, pharmacies]
  );

  const getPharmacyMatchesAsync = useCallback(
    async (prescriptionId: string): Promise<PharmacyMatchResult[]> => {
      const rx = prescriptions.find(p => p.id === prescriptionId);
      if (!rx) return [];
      if (!isOnline) {
        return matchPharmacies(rx.items, pharmacies);
      }
      try {
        const res = await apiClient.matchPharmacies({ prescriptionId });
        if (res && Array.isArray(res.matches)) {
          return res.matches;
        }
        return matchPharmacies(rx.items, pharmacies);
      } catch {
        return matchPharmacies(rx.items, pharmacies);
      }
    },
    [prescriptions, pharmacies, isOnline]
  );

  // ─── Emergency SOS ─────────────────────────────────────────────────────
  const triggerSos = useCallback(async () => {
    if (!patient) return;
    if (!isOnline) {
      StorageService.addToSyncQueue('request_emergency', {
        patientId: patient.id,
        patientName: patient.name,
        location: `${patient.village}, ${patient.district}`,
        type: 'medical',
      });
      return;
    }
    try {
      await apiClient.requestAmbulance({
        patientName: patient.name,
        pickup: `${patient.village}, ${patient.district}`,
      });
    } catch {
      StorageService.addToSyncQueue('request_emergency', {
        patientId: patient.id,
        patientName: patient.name,
        location: `${patient.village}, ${patient.district}`,
        type: 'medical',
      });
    }
  }, [isOnline, patient]);

  // ─── Sync ──────────────────────────────────────────────────────────────
  const pendingSyncCount = StorageService.getPendingCount();
  const flushSync = useCallback(() => StorageService.flushSyncQueue(), []);

  if (!patient) {
    return (
      <View style={styles.gate}>
        {loadError ? (
          <>
            <Text style={styles.gateTitle}>Could not load your records</Text>
            <Text style={styles.gateBody}>{loadError}</Text>
            <Button label="Try again" onPress={refresh} style={styles.gateAction} />
          </>
        ) : (
          <LoadingOverlay visible label="Loading your records…" />
        )}
      </View>
    );
  }

  const value: CarePlatformState = {
    isOnline,
    toggleOnline,
    patient,
    doctors,
    pharmacies,
    hospitals,
    appointments,
    prescriptions,
    referrals,
    reservations,
    lastSyncedAt,
    refresh,
    updatePatientProfile,
    bookAppointment,
    cancelAppointment,
    reserveMedicines,
    getPharmacyMatches,
    getPharmacyMatchesAsync,
    triggerSos,
    pendingSyncCount,
    flushSync,
  };

  return (
    <CarePlatformContext.Provider value={value}>
      {children}
    </CarePlatformContext.Provider>
  );
};

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  gateTitle: { ...Typography.h2, color: Colors.onSurface, textAlign: 'center' },
  gateBody: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  gateAction: { marginTop: Spacing.md },
});
