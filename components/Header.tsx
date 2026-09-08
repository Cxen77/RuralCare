import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Avatar, IconButton } from './ui';
import { useCarePlatform } from '../context/CarePlatformContext';
import { LocationPicker, ConfirmedLocation } from './maps/LocationPicker';

interface HeaderProps {
  onProfilePress: () => void;
  onSosPress: () => void;
  onViewMap?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onProfilePress, onSosPress, onViewMap }) => {
  const { patient, isOnline, updatePatientProfile } = useCarePlatform();
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const firstName = (patient?.name || 'Patient').split(' ')[0];
  const locationSubtitle = patient?.address
    ? `${patient.address}`
    : patient?.primaryPHC
    ? `${patient.district || 'Vaishali'} • ${patient.primaryPHC}`
    : 'Vaishali • Ramnagar PHC';

  const handleLocationConfirmed = (loc: ConfirmedLocation) => {
    updatePatientProfile({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      locationUpdatedAt: loc.updatedAt,
    });
    setLocationPickerVisible(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={onProfilePress}
            activeOpacity={0.8}
            accessibilityLabel="Open profile"
          >
            <Avatar
              icon="person"
              size={42}
            />
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.8}>
              <Text style={styles.greetingText}>Namaste, {firstName}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locationTouchArea}
              onPress={() => setLocationPickerVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Change current location"
            >
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={13} color={Colors.primary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationSubtitle}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={14} color={Colors.onSurfaceVariant} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rightSection}>
          <IconButton
            icon="emergency"
            size="md"
            variant="dangerSoft"
            onPress={onSosPress}
          />
          <IconButton
            icon="map"
            size="sm"
            variant="plain"
            onPress={onViewMap}
            accessibilityLabel="Open care map"
          />
        </View>
      </View>

      <LocationPicker
        visible={locationPickerVisible}
        title="Your Location"
        initialLocation={{
          latitude: patient?.latitude,
          longitude: patient?.longitude,
          address: patient?.address || locationSubtitle,
        }}
        onClose={() => setLocationPickerVisible(false)}
        onLocationConfirmed={handleLocationConfirmed}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  titleWrapper: {
    justifyContent: 'center',
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.2,
  },
  locationTouchArea: {
    alignSelf: 'flex-start',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.tertiaryContainer,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  statusPillOffline: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.outlineLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tertiary,
  },
  statusDotOffline: {
    backgroundColor: Colors.outline,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.onTertiaryContainer,
  },
  statusTextOffline: {
    color: Colors.onSurfaceVariant,
  },
});

