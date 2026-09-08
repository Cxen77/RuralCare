import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { DoctorProfileData } from '../types';
import { Avatar, Badge, IconButton } from './ui';
import { LocationPicker, ConfirmedLocation } from './maps/LocationPicker';
import { api } from '../services/api';

interface HeaderProps {
  doctor?: DoctorProfileData | null;
  doctorId?: string;
  onUpdateDoctor?: (updated: DoctorProfileData) => void;
  onBellPress: () => void;
  onProfilePress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  doctor,
  doctorId,
  onUpdateDoctor,
  onBellPress,
  onProfilePress,
}) => {
  const [clinicLocation, setClinicLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  }>({
    latitude: doctor?.latitude || 25.9856,
    longitude: doctor?.longitude || 85.2281,
    address: doctor?.clinicAddress || 'Main Road, Ramnagar, Vaishali, Bihar',
  });
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (doctor && doctor.latitude != null && doctor.longitude != null) {
      setClinicLocation({
        latitude: doctor.latitude,
        longitude: doctor.longitude,
        address: doctor.clinicAddress || 'Main Road, Ramnagar, Vaishali, Bihar',
      });
    }
  }, [doctor?.clinicAddress, doctor?.latitude, doctor?.longitude]);

  const docName = doctor?.name || 'Dr. RuralCare';
  const facilityName = doctor?.facility || 'RuralCare Clinic';

  const handleLocationConfirmed = async (loc: ConfirmedLocation) => {
    setClinicLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
    });
    setPickerVisible(false);

    const docId = doctorId || doctor?.id;
    if (docId) {
      try {
        await api.patch(`/doctors/${docId}`, {
          clinicAddress: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        if (onUpdateDoctor && doctor) {
          onUpdateDoctor({
            ...doctor,
            clinicAddress: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
        }
      } catch (err) {
        console.error('[Header] Failed to persist clinic location:', err);
      }
    }
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
              name={docName}
              icon="medical-services"
              size={42}
              online
            />
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
              <View style={styles.nameRow}>
                <Text style={styles.appName}>{docName}</Text>
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
                  {facilityName} • {clinicLocation.address.split(',')[0]}
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
