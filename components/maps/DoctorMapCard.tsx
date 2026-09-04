import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing, Shadows } from '../../constants/theme';
import { Button, Card } from '../ui';
import { MapView, MapMarker } from './MapView';
import { resolveDistanceLabel, openDirections } from '../../services/location/locationUtils';

export interface DoctorMapCardProps {
  doctor: {
    id: string;
    name: string;
    specialty: string;
    clinicName: string;
    clinicAddress?: string;
    latitude?: number;
    longitude?: number;
    distanceKm?: number;
  };
  patientLocation?: {
    latitude?: number;
    longitude?: number;
  };
  onBookPress?: (doctorId: string, name: string, specialty: string, clinic: string) => void;
  onMarkerPress?: (doctorId: string) => void;
}

export const DoctorMapCard: React.FC<DoctorMapCardProps> = ({
  doctor,
  patientLocation,
  onBookPress,
  onMarkerPress,
}) => {
  const docLat = doctor.latitude && doctor.latitude !== 0 ? doctor.latitude : 25.9856;
  const docLng = doctor.longitude && doctor.longitude !== 0 ? doctor.longitude : 85.2281;

  // Distance label using real coords when available, otherwise server estimate
  const distanceInfo = resolveDistanceLabel(
    patientLocation ? { latitude: patientLocation.latitude, longitude: patientLocation.longitude } : null,
    doctor
  );

  // Build markers compatible with MapView's marker system:
  // type 'doctor' → teal teardrop pin; type 'patient' → rose pulsing dot
  const markers: MapMarker[] = [
    {
      id: doctor.id || 'doc-1',
      latitude: docLat,
      longitude: docLng,
      title: doctor.name,
      subtitle: `${doctor.clinicName} • ${doctor.specialty}`,
      type: 'doctor' as const,
    },
  ];

  // If patient location is available, also show patient pin on the same map
  if (
    patientLocation?.latitude &&
    patientLocation?.longitude &&
    patientLocation.latitude !== 0 &&
    patientLocation.longitude !== 0
  ) {
    markers.push({
      id: 'patient-loc',
      latitude: patientLocation.latitude,
      longitude: patientLocation.longitude,
      title: 'Your Location',
      type: 'patient' as const,
    });
  }

  const handleMarkerPress = (markerId: string) => {
    onMarkerPress?.(markerId);
    // Marker press also opens the marker's popup in Leaflet;
    // the popup shows doctor name/clinic. No additional action needed here.
  };

  const handleOpenNav = () => {
    const clinic = doctor.clinicName || 'Ramnagar PHC';
    openDirections(docLat, docLng, `${clinic} - ${doctor.name}`);
  };

  return (
    <Card radius={Radii.lg} style={styles.card}>
      {/* Card Header Badge */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <MaterialIcons name="local-hospital" size={16} color={Colors.primary} />
          <Text style={styles.badgeText}>Doctor & Clinic Location</Text>
        </View>
        <View style={styles.distanceBadge}>
          <MaterialIcons name="near-me" size={12} color={Colors.secondary} />
          <Text style={styles.distanceText}>{distanceInfo.text}</Text>
        </View>
      </View>

      {/* Embedded Map using new interactive MapView */}
      <View style={styles.mapContainer}>
        <MapView
          latitude={docLat}
          longitude={docLng}
          zoom={14}
          markers={markers}
          interactive
          height={170}
          borderRadius={Radii.md}
          onMarkerPress={handleMarkerPress}
        />
      </View>

      {/* Doctor & Facility Info */}
      <View style={styles.detailsContainer}>
        <View style={styles.doctorInfoRow}>
          <View style={styles.doctorAvatar}>
            <MaterialIcons name="person" size={20} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
          </View>
        </View>

        <View style={styles.clinicInfoRow}>
          <MaterialIcons name="location-on" size={16} color={Colors.onSurfaceVariant} />
          <View style={{ flex: 1 }}>
            <Text style={styles.clinicName}>{doctor.clinicName}</Text>
            <Text style={styles.clinicAddress}>
              {doctor.clinicAddress || 'Main Road, Ramnagar, Vaishali, Bihar'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={handleOpenNav}
          activeOpacity={0.8}
          accessibilityLabel="Open Directions in Map"
        >
          <MaterialIcons name="directions" size={16} color={Colors.primary} />
          <Text style={styles.directionsBtnText}>Open Directions</Text>
        </TouchableOpacity>

        {onBookPress && (
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => onBookPress(doctor.id, doctor.name, doctor.specialty, doctor.clinicName)}
            activeOpacity={0.8}
            accessibilityLabel={`Book Slot with ${doctor.name}`}
          >
            <MaterialIcons name="event-available" size={16} color={Colors.white} />
            <Text style={styles.bookBtnText}>Book Slot</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    ...Shadows.sm,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.secondary,
  },
  mapContainer: {
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  detailsContainer: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 10,
    borderRadius: Radii.md,
    gap: 8,
  },
  doctorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doctorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  doctorSpecialty: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  clinicInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
    paddingTop: 6,
  },
  clinicName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  clinicAddress: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  directionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radii.md,
  },
  directionsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    ...Shadows.sm,
  },
  bookBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
});