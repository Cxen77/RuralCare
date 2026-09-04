import React, { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { DOCTOR } from '../data/mock';
import { Avatar, Badge, IconButton } from './ui';
import { LocationPicker, ConfirmedLocation } from './maps/LocationPicker';

interface HeaderProps {
  onBellPress: () => void;
  onProfilePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onBellPress, onProfilePress }) => {
  const [clinicLocation, setClinicLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  }>({
    latitude: 25.9856,
    longitude: 85.2281,
    address: 'Main Road, Ramnagar, Vaishali, Bihar',
  });
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleLocationConfirmed = (loc: ConfirmedLocation) => {
    setClinicLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
    });
    setPickerVisible(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={onProfilePress}
            activeOpacity={0.7}
            accessibilityLabel="View Doctor Profile"
          >
            <Avatar
              name={DOCTOR.name}
              icon="medical-services"
              size={42}
              online
            />
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
              <View style={styles.nameRow}>
                <Text style={styles.appName}>{DOCTOR.name}</Text>
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlinePillText}>Online</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="Change Clinic Location"
            >
              <View style={styles.locationRow}>
                <MaterialIcons name="local-hospital" size={13} color={Colors.primary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {DOCTOR.facility} • {clinicLocation.address.split(',')[0]}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={14} color={Colors.onSurfaceVariant} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rightActions}>
          <IconButton
            icon="notifications-none"
            size="md"
            variant="primarySoft"
            onPress={onBellPress}
          />
          <View style={styles.bellBadge}>
            <Badge dot tone="danger" />
          </View>
        </View>
      </View>

      <LocationPicker
        visible={pickerVisible}
        title="Update Clinic Location"
        initialLocation={clinicLocation}
        onClose={() => setPickerVisible(false)}
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
  },
  titleWrapper: {
    justifyContent: 'center',
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
    letterSpacing: -0.2,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  onlinePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },
  rightActions: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
