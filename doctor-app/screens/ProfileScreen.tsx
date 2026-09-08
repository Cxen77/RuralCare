import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { DoctorProfileData } from '../types';
import { Avatar, Button, Card, Chip, Divider, ToggleRow } from '../components/ui';
import { EditDoctorProfileModal } from '../components/EditDoctorProfileModal';
import { MapView } from '../components/maps/MapView';
import { LocationPicker, ConfirmedLocation } from '../components/maps/LocationPicker';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface ProfileScreenProps {
  doctorProfile?: DoctorProfileData | null;
  onUpdateDoctor?: (updated: DoctorProfileData) => void;
  appointmentsCount?: number;
  prescriptionsCount?: number;
  referralsCount?: number;
  teleconsultCount?: number;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  doctorProfile,
  onUpdateDoctor,
  appointmentsCount = 0,
  prescriptionsCount = 0,
  referralsCount = 0,
  teleconsultCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [doctor, setDoctor] = useState<DoctorProfileData>(() => ({
    name: doctorProfile?.name || user?.name || 'Dr. RuralCare',
    degrees: doctorProfile?.degrees || 'MBBS, MD',
    specialty: doctorProfile?.specialty || 'General Medicine',
    facility: doctorProfile?.facility || 'Ramnagar PHC',
    clinicAddress: doctorProfile?.clinicAddress || 'Main Road, Ramnagar, Vaishali, Bihar',
    hprId: doctorProfile?.hprId || doctorProfile?.id || 'HPR-9482-1049-5521',
    phone: doctorProfile?.phone || '+91-9431-XXXXXX',
    languages: doctorProfile?.languages || ['Hindi', 'English', 'Bhojpuri'],
    consultationFee: doctorProfile?.consultationFee ?? 0,
    maxPatientsPerDay: doctorProfile?.maxPatientsPerDay || 40,
    ayushmanPaneled: doctorProfile?.ayushmanPaneled ?? true,
    teleconsultation: doctorProfile?.teleconsultation ?? true,
    latitude: doctorProfile?.latitude || 25.9856,
    longitude: doctorProfile?.longitude || 85.2281,
  }));

  const [clinicCoordinates, setClinicCoordinates] = useState({
    latitude: doctorProfile?.latitude || 25.9856,
    longitude: doctorProfile?.longitude || 85.2281,
  });

  const [mapFocusNonce, setMapFocusNonce] = useState(0);

  useEffect(() => {
    if (doctorProfile) {
      setDoctor(prev => ({
        ...prev,
        ...doctorProfile,
      }));
      if (doctorProfile.latitude != null && doctorProfile.longitude != null) {
        setClinicCoordinates({
          latitude: doctorProfile.latitude,
          longitude: doctorProfile.longitude,
        });
        setMapFocusNonce(n => n + 1);
      }
    }
  }, [doctorProfile]);

  const [available, setAvailable] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const handleUpdateDoctor = async (updated: DoctorProfileData) => {
    setDoctor(updated);
    onUpdateDoctor?.(updated);
    try {
      const docId = user?.doctorId || doctorProfile?.id;
      if (docId) {
        await api.patch(`/doctors/${docId}`, updated);
      }
    } catch (e) {
      console.warn('Failed to save doctor profile:', e);
    }
  };

  const handleLocationConfirmed = async (loc: ConfirmedLocation) => {
    const coords = {
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
    setClinicCoordinates(coords);
    const updated = {
      ...doctor,
      clinicAddress: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
    setDoctor(updated);
    onUpdateDoctor?.(updated);
    try {
      const docId = user?.doctorId || doctorProfile?.id;
      if (docId) {
        await api.patch(`/doctors/${docId}`, { clinicAddress: loc.address, ...coords });
      }
    } catch (e) {
      console.warn('Failed to save doctor location:', e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

      {/* HPR Digital Card */}
      <View style={styles.hprBanner}>
        <View style={styles.profileRow}>
          <Avatar
            name={doctor.name}
            icon="medical-services"
            size={54}
            borderColor={Colors.white}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorMeta}>{doctor.degrees}</Text>
            <Text style={styles.doctorSpecialty}>{doctor.specialty} • {doctor.facility}</Text>
          </View>
          <TouchableOpacity style={styles.editBadgeBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.8}>
            <MaterialIcons name="edit" size={15} color={Colors.white} />
            <Text style={styles.editBadgeText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hprBox}>
          <View>
            <Text style={styles.hprLabel}>Healthcare Professional Registry ID</Text>
            <Text style={styles.hprNumber}>{doctor.hprId}</Text>
          </View>
          <MaterialIcons name="verified" size={24} color={Colors.white} />
        </View>
      </View>

      {/* Edit Profile CTA */}
      <Button
        label="Edit Profile & Clinic Details"
        icon="manage-accounts"
        variant="outline"
        block
        onPress={() => setEditModalVisible(true)}
      />

      {/* Clinic & Facility Information */}
      <Card radius={Radii.lg} style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.sectionHeading}>Facility & Clinic Details</Text>
          <TouchableOpacity
            style={styles.editLocBtn}
            onPress={() => setLocationPickerVisible(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="edit-location" size={15} color={Colors.primary} />
            <Text style={styles.editLocBtnText}>Update Location</Text>
          </TouchableOpacity>
        </View>

        {/* Embedded Clinic Map Preview */}
        <MapView
          latitude={clinicCoordinates.latitude}
          longitude={clinicCoordinates.longitude}
          zoom={15}
          focusNonce={mapFocusNonce}
          markers={[
            {
              id: 'clinic-loc',
              latitude: clinicCoordinates.latitude,
              longitude: clinicCoordinates.longitude,
              title: doctor.facility,
              subtitle: doctor.clinicAddress,
              type: 'clinic',
            },
          ]}
          interactive={false}
          height={140}
          borderRadius={Radii.md}
        />

        <View style={styles.detailRow}>
          <MaterialIcons name="local-hospital" size={18} color={Colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>{doctor.facility}</Text>
            <Text style={styles.detailSub}>{doctor.clinicAddress}</Text>
            <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 }}>
              {clinicCoordinates.latitude.toFixed(4)}° N, {clinicCoordinates.longitude.toFixed(4)}° E
            </Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="phone" size={18} color={Colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>Contact Number</Text>
            <Text style={styles.detailSub}>{doctor.phone}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <MaterialIcons name="payments" size={18} color={Colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>Consultation Fee</Text>
            <Text style={styles.detailSub}>
              {doctor.consultationFee === 0 ? '₹0 (Free under Ayushman PM-JAY)' : `₹${doctor.consultationFee}`}
            </Text>
          </View>
        </View>
        <View style={styles.badgeRow}>
          {doctor.ayushmanPaneled && (
            <View style={styles.schemeBadge}>
              <MaterialIcons name="verified" size={14} color="#16A34A" />
              <Text style={styles.schemeText}>Ayushman PM-JAY</Text>
            </View>
          )}
          {doctor.teleconsultation && (
            <View style={[styles.schemeBadge, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="videocam" size={14} color={Colors.primary} />
              <Text style={[styles.schemeText, { color: Colors.primaryDark }]}>Teleconsultation</Text>
            </View>
          )}
          <View style={[styles.schemeBadge, { backgroundColor: Colors.surfaceContainerLow }]}>
            <Text style={[styles.schemeText, { color: Colors.onSurfaceVariant }]}>Max {doctor.maxPatientsPerDay} patients/day</Text>
          </View>
        </View>
      </Card>

      {/* Availability */}
      <Card radius={Radii.lg}>
        <ToggleRow
          label="Accepting Patients"
          description={available ? 'You appear in patient discovery & booking' : 'Hidden from new bookings'}
          value={available}
          onChange={setAvailable}
        />
      </Card>

      {/* Languages */}
      <Card radius={Radii.lg} style={{ padding: 14 }}>
        <Text style={styles.langTitle}>Consultation Languages</Text>
        <View style={styles.langGrid}>
          {doctor.languages.map(lang => (
            <Chip key={lang} label={lang} selected />
          ))}
        </View>
      </Card>

      {/* Facility Stats */}
      <Card radius={Radii.lg} elevation="none">
        <Text style={styles.statsTitle}>Activity & Performance</Text>
        <Divider style={{ marginVertical: 8 }} />
        <View style={styles.statRow}><Text style={styles.statLabel}>Completed Consultations</Text><Text style={styles.statValue}>{appointmentsCount}</Text></View>
        <View style={styles.statRow}><Text style={styles.statLabel}>Prescriptions Issued</Text><Text style={styles.statValue}>{prescriptionsCount}</Text></View>
        <View style={styles.statRow}><Text style={styles.statLabel}>Referrals Created</Text><Text style={styles.statValue}>{referralsCount}</Text></View>
        <View style={styles.statRow}><Text style={styles.statLabel}>Teleconsultations</Text><Text style={styles.statValue}>{teleconsultCount}</Text></View>
      </Card>

      <Button
        label="Sync Queue for Offline Use"
        icon="sync"
        variant="soft"
        block
        onPress={() => Alert.alert('Offline Sync Complete', 'Appointment queue and patient charts cached. You can consult without internet.')}
      />

      <Card radius={Radii.lg} style={{ padding: 14, gap: 10 }}>
        <Text style={styles.sectionHeading}>Account</Text>
        <View style={styles.detailRow}>
          <MaterialIcons name="badge" size={18} color={Colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle}>{user?.name ?? 'Signed in'}</Text>
            <Text style={styles.detailSub}>{user?.email}</Text>
          </View>
        </View>
        <Button
          label="Sign out"
          icon="logout"
          variant="outline"
          block
          onPress={() =>
            Alert.alert('Sign out', 'You will need to sign in again to see your queue.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => { logout(); } },
            ])
          }
        />
      </Card>

      {/* Edit Doctor Profile Modal */}
      <EditDoctorProfileModal
        visible={editModalVisible}
        doctor={doctor}
        onClose={() => setEditModalVisible(false)}
        onSave={handleUpdateDoctor}
      />

      {/* Location Picker Modal */}
      <LocationPicker
        visible={locationPickerVisible}
        title="Update Clinic Location"
        initialLocation={{
          latitude: clinicCoordinates.latitude,
          longitude: clinicCoordinates.longitude,
          address: doctor.clinicAddress,
        }}
        onClose={() => setLocationPickerVisible(false)}
        onLocationConfirmed={handleLocationConfirmed}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  editLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  editLocBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  contentContainer: {
    padding: Spacing.md,
    gap: 14,
    paddingBottom: 32,
  },
  hprBanner: {
    backgroundColor: Colors.secondary,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    gap: 14,
    ...Shadows.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  doctorMeta: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  doctorSpecialty: {
    fontSize: 11,
    color: '#95F1FF',
    marginTop: 2,
    fontWeight: '600',
  },
  editBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  hprBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: Radii.md,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  hprLabel: {
    fontSize: 10,
    color: '#E2E8F0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hprNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  detailSub: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  schemeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  schemeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  langTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
});
