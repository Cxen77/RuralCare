/**
 * Patient Map Screen
 * Full interactive OpenStreetMap view:
 *  - Patient's saved location + all doctors with real coordinates
 *  - Marker press -> doctor card with distance, directions, booking
 *  - GPS recenter, route preview (OSRM), graceful offline / permission states
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import * as ExpoLocation from 'expo-location';
import { MapView, MapMarker, MapRoute } from '../../components/maps/MapView';
import { LocationPicker, ConfirmedLocation } from '../../components/maps/LocationPicker';
import { Button } from '../../components/ui';
import {
  calculateDistanceKm,
  openDirections,
  fetchDrivingRoute,
  fetchRouteGeometry,
  resolveDistanceLabel,
  isValidCoordinate,
} from '../../services/location/locationUtils';
import {
  buildDoctorMarkers,
  buildPatientMarker,
  buildPharmacyMarkers,
  buildHospitalMarkers,
} from '../../services/location/mapData';

interface Props {
  focusDoctorId?: string | null;
  onOpenBooking: (
    doctorId: string,
    name: string,
    specialty: string,
    clinic: string,
    aiTriageSummary?: string,
    aiSymptoms?: string[]
  ) => void;
}

export const PatientMapScreen: React.FC<Props> = ({ focusDoctorId, onOpenBooking }) => {
  const { doctors, pharmacies, hospitals, patient, updatePatientProfile } = useCarePlatform();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const hasSavedPatientCoords = isValidCoordinate(patient?.latitude, patient?.longitude);
  const initialCenter = hasSavedPatientCoords
    ? { lat: patient!.latitude as number, lng: patient!.longitude as number }
    : { lat: 25.9856, lng: 85.2281 };

  const [center, setCenter] = useState(initialCenter);
  const [zoom, setZoom] = useState(hasSavedPatientCoords ? 14 : 13);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const [driving, setDriving] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [drivingLoading, setDrivingLoading] = useState(false);
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);

  const patientMarker = useMemo(() => buildPatientMarker(patient), [patient]);
  const doctorMarkers = useMemo(() => buildDoctorMarkers(doctors), [doctors]);
  const pharmacyMarkers = useMemo(() => buildPharmacyMarkers(pharmacies), [pharmacies]);
  const hospitalMarkers = useMemo(() => buildHospitalMarkers(hospitals), [hospitals]);
  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [];
    if (patientMarker) list.push(patientMarker);
    list.push(...doctorMarkers);
    list.push(...pharmacyMarkers);
    list.push(...hospitalMarkers);
    return list;
  }, [patientMarker, doctorMarkers, pharmacyMarkers, hospitalMarkers]);

  const doctorsWithoutCoords = doctors.filter(
    d => !isValidCoordinate(d.latitude, d.longitude)
  ).length;

  const selectedDoctor = useMemo(
    () => doctors.find(d => d.id === selectedDoctorId) || null,
    [doctors, selectedDoctorId]
  );

  const selectedPharmacy = useMemo(
    () => pharmacies.find(p => p.id === selectedPharmacyId) || null,
    [pharmacies, selectedPharmacyId]
  );

  const selectedHospital = useMemo(
    () => hospitals.find(h => h.id === selectedHospitalId) || null,
    [hospitals, selectedHospitalId]
  );

  const distanceLabel = useMemo(
    () =>
      resolveDistanceLabel(
        patient ? { latitude: patient.latitude, longitude: patient.longitude } : null,
        selectedDoctor
      ),
    [patient, selectedDoctor]
  );

  const pharmacyDistanceLabel = useMemo(
    () =>
      resolveDistanceLabel(
        patient ? { latitude: patient.latitude, longitude: patient.longitude } : null,
        selectedPharmacy
      ),
    [patient, selectedPharmacy]
  );

  const hospitalDistanceLabel = useMemo(
    () =>
      resolveDistanceLabel(
        patient ? { latitude: patient.latitude, longitude: patient.longitude } : null,
        selectedHospital
      ),
    [patient, selectedHospital]
  );

  // Focus a specific doctor when navigated from Doctors list / chat
  useEffect(() => {
    if (focusDoctorId) {
      const doc = doctors.find(d => d.id === focusDoctorId);
      if (doc && isValidCoordinate(doc.latitude, doc.longitude)) {
        setSelectedPharmacyId(null);
        setSelectedDoctorId(doc.id);
        setCenter({ lat: doc.latitude as number, lng: doc.longitude as number });
        setZoom(15);
        setFitNonce(n => n + 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDoctorId]);

  const hasCenteredOnPatientRef = useRef(false);

  // Refresh saved-patient center when the patient profile location changes
  useEffect(() => {
    if (isValidCoordinate(patient?.latitude, patient?.longitude)) {
      setCenter({ lat: patient!.latitude as number, lng: patient!.longitude as number });
      if (!hasCenteredOnPatientRef.current) {
        hasCenteredOnPatientRef.current = true;
        setZoom(14);
        setFocusNonce(n => n + 1);
      }
    } else {
      // Try to get live location if profile genuinely has no saved location
      (async () => {
        try {
          const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await ExpoLocation.getLastKnownPositionAsync();
            if (loc?.coords && isValidCoordinate(loc.coords.latitude, loc.coords.longitude)) {
              setCenter({ lat: loc.coords.latitude, lng: loc.coords.longitude });
              if (!hasCenteredOnPatientRef.current) {
                hasCenteredOnPatientRef.current = true;
                setZoom(14);
                setFocusNonce(n => n + 1);
              }
            }
          }
        } catch (e) {
          // ignore error, stick with default
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.latitude, patient?.longitude]);

  // Resolve driving distance for the selected doctor (cached, on-demand)
  useEffect(() => {
    setDriving(null);
    setRoute(null);
    setRouteError(false);
    if (!selectedDoctor || !patient) return;
    if (
      !isValidCoordinate(patient.latitude, patient.longitude) ||
      !isValidCoordinate(selectedDoctor.latitude, selectedDoctor.longitude)
    ) {
      return;
    }
    let alive = true;
    setDrivingLoading(true);
    fetchDrivingRoute(
      patient.latitude as number,
      patient.longitude as number,
      selectedDoctor.latitude as number,
      selectedDoctor.longitude as number
    )
      .then(res => {
        if (alive) setDriving(res);
      })
      .finally(() => {
        if (alive) setDrivingLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedDoctorId, patient?.latitude, patient?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkerPress = useCallback(
    (id: string) => {
      if (id.startsWith('hospital-')) {
        const hospId = id.replace('hospital-', '');
        const hosp = hospitals.find(h => h.id === hospId);
        if (!hosp) return;
        setSelectedDoctorId(null);
        setSelectedPharmacyId(null);
        setSelectedHospitalId(hosp.id);
        if (isValidCoordinate(hosp.latitude, hosp.longitude)) {
          setCenter({ lat: hosp.latitude as number, lng: hosp.longitude as number });
          setZoom(15);
          setFocusNonce(n => n + 1);
        }
        return;
      }
      if (id.startsWith('pharmacy-')) {
        const phId = id.replace('pharmacy-', '');
        const ph = pharmacies.find(p => p.id === phId);
        if (!ph) return;
        setSelectedDoctorId(null);
        setSelectedHospitalId(null);
        setSelectedPharmacyId(ph.id);
        if (isValidCoordinate(ph.latitude, ph.longitude)) {
          setCenter({ lat: ph.latitude as number, lng: ph.longitude as number });
          setZoom(15);
          setFocusNonce(n => n + 1);
        }
        return;
      }
      const doc = doctors.find(d => d.id === id);
      if (!doc) return; // patient marker press — ignore
      setSelectedPharmacyId(null);
      setSelectedHospitalId(null);
      setSelectedDoctorId(id);
      if (isValidCoordinate(doc.latitude, doc.longitude)) {
        setCenter({ lat: doc.latitude as number, lng: doc.longitude as number });
        setZoom(15);
        setFocusNonce(n => n + 1);
      }
    },
    [doctors, pharmacies, hospitals]
  );

  const handleRecenterGps = async () => {
    setGpsLoading(true);
    setGpsNotice(null);
    try {
      let { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status === 'undetermined') {
        ({ status } = await ExpoLocation.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        setGpsNotice('Location permission is off. Enable it in Settings, or set your location manually.');
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      if (isValidCoordinate(latitude, longitude)) {
        setCenter({ lat: latitude, lng: longitude });
        setZoom(15);
        setFocusNonce(n => n + 1);
      }
    } catch (e) {
      setGpsNotice('Could not get your current position. Try again or set your location manually.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleShowRoute = async () => {
    if (!selectedDoctor || !patient) return;
    if (route) {
      setRoute(null);
      return;
    }
    if (
      !isValidCoordinate(patient.latitude, patient.longitude) ||
      !isValidCoordinate(selectedDoctor.latitude, selectedDoctor.longitude)
    ) {
      setRouteError(true);
      return;
    }
    setRouteLoading(true);
    setRouteError(false);
    const coords = await fetchRouteGeometry(
      patient.latitude as number,
      patient.longitude as number,
      selectedDoctor.latitude as number,
      selectedDoctor.longitude as number
    );
    setRouteLoading(false);
    if (coords) {
      setRoute({ coordinates: coords, distanceKm: driving?.distanceKm, durationMin: driving?.durationMin });
    } else {
      setRouteError(true);
    }
  };

  const handleLocationConfirmed = (loc: ConfirmedLocation) => {
    updatePatientProfile({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      locationUpdatedAt: loc.updatedAt,
    });
    setLocationPickerVisible(false);
    setCenter({ lat: loc.latitude, lng: loc.longitude });
    setZoom(14);
    setFocusNonce(n => n + 1);
  };

  const hasPatientCoords = patient && isValidCoordinate(patient.latitude, patient.longitude);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Care Map</Text>
          <Text style={styles.subheading}>
            {doctorMarkers.length} doctors • {pharmacyMarkers.length} pharmacies mapped • OpenStreetMap
          </Text>
        </View>
        <TouchableOpacity
          style={styles.fitBtn}
          onPress={() => setFitNonce(n => n + 1)}
          activeOpacity={0.8}
          accessibilityLabel="Fit all doctors on screen"
        >
          <MaterialIcons name="filter-none" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Patient without coordinates -> actionable CTA */}
      {!hasPatientCoords && (
        <TouchableOpacity
          style={styles.locCta}
          onPress={() => setLocationPickerVisible(true)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add-location-alt" size={18} color={Colors.primaryDark} />
          <Text style={styles.locCtaText} numberOfLines={1}>
            Set your location for accurate distances
          </Text>
          <MaterialIcons name="chevron-right" size={18} color={Colors.primaryDark} />
        </TouchableOpacity>
      )}

      {gpsNotice && (
        <View style={styles.noticeBanner}>
          <MaterialIcons name="info-outline" size={15} color="#92400E" />
          <Text style={styles.noticeText} numberOfLines={2}>
            {gpsNotice}
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings().catch(() => {})}
            accessibilityLabel="Open app settings"
          >
            <Text style={styles.noticeAction}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mapWrap}>
        <MapView
          latitude={center.lat}
          longitude={center.lng}
          zoom={zoom}
          markers={markers}
          focusNonce={focusNonce}
          fitNonce={fitNonce}
          route={route}
          onMarkerPress={handleMarkerPress}
          height="100%"
          borderRadius={0}
        />

        {/* GPS FAB */}
        <TouchableOpacity
          style={[styles.fab, gpsLoading && styles.fabBusy]}
          onPress={handleRecenterGps}
          disabled={gpsLoading}
          activeOpacity={0.85}
          accessibilityLabel="Center map on my current GPS location"
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialIcons name="my-location" size={22} color={Colors.primary} />
          )}
        </TouchableOpacity>

        {/* Selected doctor card */}
        {selectedDoctor && (
          <View style={styles.doctorCard}>
            <View style={styles.cardHead}>
              <View style={styles.docAvatar}>
                <MaterialIcons name="medical-services" size={20} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName}>{selectedDoctor.name}</Text>
                <Text style={styles.docMeta}>
                  {selectedDoctor.specialty} • {selectedDoctor.clinicName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedDoctorId(null)}
                accessibilityLabel="Close doctor details"
              >
                <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.addressText} numberOfLines={2}>
                {selectedDoctor.clinicAddress || 'Address not available'}
              </Text>
            </View>

            <View style={styles.distanceRow}>
              <MaterialIcons name="near-me" size={14} color={Colors.secondary} />
              {drivingLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : driving ? (
                <Text style={styles.distanceText}>
                  {driving.distanceKm} km driving (~{driving.durationMin} min)
                </Text>
              ) : (
                <Text style={styles.distanceText}>{distanceLabel.text}</Text>
              )}
              {!driving && !drivingLoading && !distanceLabel.isEstimate && (
                <Text style={styles.distanceHint}>(straight line)</Text>
              )}
            </View>

            {routeError && (
              <Text style={styles.routeErrorText}>
                Route service unavailable — showing straight-line distance instead.
              </Text>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleShowRoute}
                disabled={routeLoading}
                activeOpacity={0.8}
                accessibilityLabel="Toggle route preview"
              >
                {routeLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <MaterialIcons name="route" size={16} color={Colors.primary} />
                )}
                <Text style={styles.secondaryBtnText}>{route ? 'Hide route' : 'Show route'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  if (isValidCoordinate(selectedDoctor.latitude, selectedDoctor.longitude)) {
                    openDirections(
                      selectedDoctor.latitude as number,
                      selectedDoctor.longitude as number,
                      `${selectedDoctor.clinicName} - ${selectedDoctor.name}`
                    );
                  } else {
                    Alert.alert('No map coordinates', 'This doctor has no saved map location yet.');
                  }
                }}
                activeOpacity={0.8}
                accessibilityLabel="Get directions to the clinic"
              >
                <MaterialIcons name="directions" size={16} color={Colors.primary} />
                <Text style={styles.secondaryBtnText}>Directions</Text>
              </TouchableOpacity>

              {selectedDoctor.isAvailable && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() =>
                    onOpenBooking(
                      selectedDoctor.id,
                      selectedDoctor.name,
                      selectedDoctor.specialty,
                      selectedDoctor.clinicName
                    )
                  }
                  activeOpacity={0.85}
                  accessibilityLabel={`Book appointment with ${selectedDoctor.name}`}
                >
                  <MaterialIcons name="event-available" size={16} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Book</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Selected pharmacy card */}
        {selectedPharmacy && (
          <View style={styles.doctorCard}>
            <View style={styles.cardHead}>
              <View style={[styles.docAvatar, { backgroundColor: '#059669' }]}>
                <MaterialIcons name="local-pharmacy" size={20} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName}>{selectedPharmacy.name}</Text>
                <Text style={styles.docMeta}>
                  {selectedPharmacy.isJanAushadhi ? 'Jan Aushadhi Kendra' : 'Verified Pharmacy'} • {selectedPharmacy.operatingHours || 'Open'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedPharmacyId(null)}
                accessibilityLabel="Close pharmacy details"
              >
                <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.addressText} numberOfLines={2}>
                {selectedPharmacy.address || 'Address not available'}
              </Text>
            </View>

            <View style={styles.distanceRow}>
              <MaterialIcons name="near-me" size={14} color="#059669" />
              <Text style={styles.distanceText}>{pharmacyDistanceLabel.text}</Text>
              {!pharmacyDistanceLabel.isEstimate && (
                <Text style={styles.distanceHint}>(straight line)</Text>
              )}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#059669' }]}
                onPress={() => {
                  if (isValidCoordinate(selectedPharmacy.latitude, selectedPharmacy.longitude)) {
                    openDirections(
                      selectedPharmacy.latitude as number,
                      selectedPharmacy.longitude as number,
                      selectedPharmacy.name
                    );
                  } else {
                    Alert.alert('No map coordinates', 'This pharmacy has no saved map location yet.');
                  }
                }}
                activeOpacity={0.85}
                accessibilityLabel="Get directions to the pharmacy"
              >
                <MaterialIcons name="directions" size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Directions to Pharmacy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Selected hospital card */}
        {selectedHospital && (
          <View style={styles.doctorCard}>
            <View style={styles.cardHead}>
              <View style={[styles.docAvatar, { backgroundColor: '#00685f' }]}>
                <MaterialIcons name="local-hospital" size={20} color={Colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.docName}>{selectedHospital.name}</Text>
                  <View style={{ backgroundColor: (selectedHospital as any).acceptingEmergency !== false ? '#dcfce7' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: (selectedHospital as any).acceptingEmergency !== false ? '#15803d' : '#b91c1c' }}>
                      {(selectedHospital as any).acceptingEmergency !== false ? '24×7 Emergency' : 'Divert'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.docMeta}>
                  {selectedHospital.type || 'Hospital'} • Emergency: {(selectedHospital as any).beds?.emergency ?? (selectedHospital.capabilities?.emergency ?? 0)} Beds • ICU: {(selectedHospital as any).beds?.icu ?? (selectedHospital.capabilities?.icuBeds ?? 0)} Beds
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedHospitalId(null)}
                accessibilityLabel="Close hospital details"
              >
                <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={14} color={Colors.onSurfaceVariant} />
              <Text style={styles.addressText} numberOfLines={2}>
                {selectedHospital.address || 'Address not available'}
              </Text>
            </View>

            <View style={styles.distanceRow}>
              <MaterialIcons name="near-me" size={14} color="#00685f" />
              <Text style={styles.distanceText}>{hospitalDistanceLabel.text}</Text>
              {!hospitalDistanceLabel.isEstimate && (
                <Text style={styles.distanceHint}>(straight line)</Text>
              )}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, backgroundColor: '#00685f' }]}
                onPress={() => {
                  if (isValidCoordinate(selectedHospital.latitude, selectedHospital.longitude)) {
                    openDirections(
                      selectedHospital.latitude as number,
                      selectedHospital.longitude as number,
                      selectedHospital.name
                    );
                  } else {
                    Alert.alert('No map coordinates', 'This hospital has no saved map location yet.');
                  }
                }}
                activeOpacity={0.85}
                accessibilityLabel="Get directions to the hospital"
              >
                <MaterialIcons name="directions" size={16} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Directions</Text>
              </TouchableOpacity>

              {(selectedHospital.phone || (selectedHospital as any).emergencyHelpline) && (
                <TouchableOpacity
                  style={[styles.bookingBtn, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}
                  onPress={() => {
                    const tel = (selectedHospital as any).emergencyHelpline || selectedHospital.phone || '108';
                    Linking.openURL(`tel:${tel}`);
                  }}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="phone" size={16} color={Colors.primary} />
                  <Text style={styles.bookingBtnText}>Call Hospital</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Empty state: compact chip — does not obscure the map */}
        {doctorMarkers.length === 0 && pharmacyMarkers.length === 0 && (
          <View style={styles.emptyChipWrap} pointerEvents="box-none">
            <View style={styles.emptyChip}>
              <MaterialIcons name="location-off" size={16} color={Colors.outline} />
              <Text style={styles.emptyChipText}>
                No facilities mapped nearby • Check the Doctors tab
              </Text>
            </View>
          </View>
        )}
      </View>

      <LocationPicker
        visible={locationPickerVisible}
        title="Your Location"
        initialLocation={{
          latitude: patient?.latitude,
          longitude: patient?.longitude,
          address: patient?.address,
        }}
        onClose={() => setLocationPickerVisible(false)}
        onLocationConfirmed={handleLocationConfirmed}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  subheading: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  fitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  locCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radii.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  locCtaText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: Colors.primaryDark },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  noticeText: { flex: 1, fontSize: 11.5, fontWeight: '500', color: '#92400E' },
  noticeAction: { fontSize: 12, fontWeight: '800', color: Colors.primaryDark },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  fab: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
    zIndex: 20,
  },
  fabBusy: { opacity: 0.8 },
  doctorCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 66,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    padding: 12,
    gap: 8,
    ...Shadows.lg,
    zIndex: 20,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 14.5, fontWeight: '800', color: Colors.secondary },
  docMeta: { fontSize: 11.5, color: Colors.onSurfaceVariant, marginTop: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  addressText: { flex: 1, fontSize: 11.5, color: Colors.onSurfaceVariant, lineHeight: 16 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distanceText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  distanceHint: { fontSize: 10.5, color: Colors.onSurfaceVariant },
  routeErrorText: {
    fontSize: 11,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionsRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radii.sm,
  },
  secondaryBtnText: { fontSize: 11.5, fontWeight: '700', color: Colors.primary },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    backgroundColor: Colors.primary,
    borderRadius: Radii.sm,
    ...Shadows.sm,
  },
  primaryBtnText: { fontSize: 11.5, fontWeight: '700', color: Colors.white },
  emptyChipWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    ...Shadows.sm,
  },
  emptyChipText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
});
