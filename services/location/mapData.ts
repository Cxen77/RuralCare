/**
 * RuralCare - Map data helpers
 * Pure functions that turn application data (doctors, patient profile) into
 * map markers. Kept separate from UI so they are unit-testable and reusable
 * by the full map screen, doctor cards and chat map cards.
 *
 * Coordinates ALWAYS come from application data (doctor records / patient
 * profile) — never from AI/LLM output.
 */

import type { Doctor, Pharmacy, Hospital } from '../../types/schema';
import { isValidCoordinate } from './locationUtils';
import type { MapMarker } from '../../components/maps/MapView';

export interface DoctorWithCoords extends Doctor {
  latitude?: number;
  longitude?: number;
}

/**
 * Builds the doctor marker list for a map.
 * Doctors without valid coordinates are excluded (their text address is
 * still shown in lists/cards) — we never plot fake/default coordinates.
 */
export function buildDoctorMarkers(doctors: DoctorWithCoords[]): MapMarker[] {
  if (!Array.isArray(doctors)) return [];
  return doctors
    .filter(d => isValidCoordinate(d.latitude, d.longitude))
    .map(d => ({
      id: d.id,
      latitude: d.latitude as number,
      longitude: d.longitude as number,
      title: d.name,
      subtitle: `${d.specialty} • ${d.clinicName}`,
      type: 'doctor' as const,
    }));
}

/**
 * Builds the patient "You are here" marker from the patient profile.
 * Returns null when the patient has no confirmed coordinates yet.
 */
export function buildPatientMarker(patient?: {
  latitude?: number;
  longitude?: number;
  name?: string;
} | null): MapMarker | null {
  if (!patient || !isValidCoordinate(patient.latitude, patient.longitude)) return null;
  return {
    id: 'patient-location',
    latitude: patient.latitude as number,
    longitude: patient.longitude as number,
    title: patient.name ? `${patient.name} (You)` : 'You',
    subtitle: 'Your saved location',
    type: 'patient',
  };
}

/**
 * Builds pharmacy markers for the map.
 * Pharmacies without valid coordinates are excluded.
 */
export function buildPharmacyMarkers(pharmacies: Pharmacy[]): MapMarker[] {
  if (!Array.isArray(pharmacies)) return [];
  return pharmacies
    .filter(p => isValidCoordinate(p.latitude, p.longitude))
    .map(p => ({
      id: `pharmacy-${p.id}`,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      title: p.name,
      subtitle: p.isJanAushadhi ? 'Jan Aushadhi Kendra' : 'Pharmacy',
      type: 'pharmacy' as const,
    }));
}

/**
 * Builds hospital markers for the map.
 * Hospitals without valid coordinates are excluded.
 */
export function buildHospitalMarkers(hospitals: Hospital[]): MapMarker[] {
  if (!Array.isArray(hospitals)) return [];
  return hospitals
    .filter(h => isValidCoordinate(h.latitude, h.longitude))
    .map(h => ({
      id: `hospital-${h.id}`,
      latitude: h.latitude as number,
      longitude: h.longitude as number,
      title: h.name,
      subtitle: `${h.type} • ${h.capabilities?.availableBeds ?? (h as any).beds?.general ?? 0} beds available`,
      type: 'hospital' as const,
    }));
}

