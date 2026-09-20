import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { useAuth } from '../../context/AuthContext';
import { Card, SectionHeader, Button, Avatar } from '../../components/ui';
import { EditPatientProfileModal } from '../../components/EditPatientProfileModal';
import { EditHealthInfoModal } from '../../components/EditHealthInfoModal';
import { HealthPassportModal } from '../../components/HealthPassportModal';
import { LocationPicker, ConfirmedLocation } from '../../components/maps/LocationPicker';

export const PatientProfileScreen: React.FC = () => {
  const { patient, isOnline, toggleOnline, pendingSyncCount, flushSync, updatePatientProfile, refresh } = useCarePlatform();
  const { user, logout } = useAuth();
  const [selectedLang, setSelectedLang] = useState(patient.language);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editHealthInfoVisible, setEditHealthInfoVisible] = useState(false);
  const [healthPassportVisible, setHealthPassportVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const languages = ['Hindi', 'Bhojpuri', 'Bengali', 'English'] as const;

  const handleLocationConfirmed = (loc: ConfirmedLocation) => {
    updatePatientProfile({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      locationUpdatedAt: loc.updatedAt,
    });
    setLocationPickerVisible(false);
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'You are currently offline. Actions will be synced when connection is restored.');
      return;
    }
    const { flushed, failed } = await flushSync();
    Alert.alert('Sync Complete', `${flushed} items synced. ${failed} failed.`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ABHA Health Card */}
      <View style={styles.abhaCard}>
        <View style={styles.abhaTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar icon="person" size={48} bgColor="#FFFFFF25" borderColor="#FFFFFF50" iconColor="#FFFFFF" />
            <View>
              <Text style={styles.abhaLabel}>ABHA Health ID Card</Text>
              <Text style={styles.abhaName}>{patient.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editCardBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.8}>
            <MaterialIcons name="edit" size={16} color={Colors.white} />
            <Text style={styles.editCardBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.abhaIdRow}>
          <Text style={styles.abhaId}>{patient.abhaId}</Text>
          <TouchableOpacity onPress={() => Alert.alert('QR Code', `ABHA: ${patient.abhaId}`)}>
            <MaterialIcons name="qr-code-2" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.abhaDetails}>
          <View style={styles.abhaDetailItem}>
            <Text style={styles.abhaDetailLabel}>Age / Gender</Text>
            <Text style={styles.abhaDetailValue}>{patient.age} / {patient.gender}</Text>
          </View>
          <View style={styles.abhaDetailItem}>
            <Text style={styles.abhaDetailLabel}>Blood Group</Text>
            <Text style={styles.abhaDetailValue}>{patient.bloodGroup || 'Not added'}</Text>
          </View>
          <View style={styles.abhaDetailItem}>
            <Text style={styles.abhaDetailLabel}>Village & District</Text>
            <Text style={styles.abhaDetailValue}>{patient.village}, {patient.district}</Text>
          </View>
        </View>
        {patient.ayushmanEligible && (
          <View style={styles.ayushmanBanner}>
            <MaterialIcons name="verified" size={16} color="#16A34A" />
            <Text style={styles.ayushmanText}>Ayushman Bharat PM-JAY Eligible — Free treatment up to ₹5 Lakh</Text>
          </View>
        )}
      </View>

      {/* Edit Profile CTA Button */}
      <Button
        label="Edit Profile & Details"
        icon="manage-accounts"
        variant="outline"
        block
        onPress={() => setEditModalVisible(true)}
      />

      {/* Primary PHC & Location */}
      <SectionHeader title="Location & Healthcare Centre" />
      <Card padding={14} radius={Radii.lg} style={{ gap: 12 }}>
        <View style={styles.contactRow}>
          <View style={styles.contactIcon}><MaterialIcons name="place" size={20} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Your Registered Location</Text>
            <Text style={styles.contactSub}>
              {patient.address || 'Ramnagar, Vaishali, Bihar'}
            </Text>
            {patient.latitude && patient.longitude ? (
              <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 }}>
                {patient.latitude.toFixed(4)}° N, {patient.longitude.toFixed(4)}° E
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => setLocationPickerVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Change Location"
          >
            <MaterialIcons name="edit-location" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.contactRow, { borderTopWidth: 1, borderTopColor: Colors.outlineLight, paddingTop: 10 }]}>
          <View style={styles.contactIcon}><MaterialIcons name="local-hospital" size={20} color={Colors.secondary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>{patient.primaryPHC || 'Primary Health Centre'}</Text>
            <Text style={styles.contactSub}>{patient.village || ''}, {patient.district || ''}</Text>
          </View>
        </View>

        <View style={[styles.contactRow, { borderTopWidth: 1, borderTopColor: Colors.outlineLight, paddingTop: 10 }]}>
          <View style={[styles.contactIcon, { backgroundColor: Colors.tertiaryContainer }]}><MaterialIcons name="person" size={20} color={Colors.tertiary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>{patient.ashaWorker?.name || 'Local ASHA Worker'} (ASHA Worker)</Text>
            <Text style={styles.contactSub}>{patient.ashaWorker?.phone || 'Phone not registered'}</Text>
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Alert.alert('Calling', patient.ashaWorker?.phone || 'No phone number registered for ASHA worker.')}
          >
            <MaterialIcons name="call" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Health Info & Health Passport */}
      <SectionHeader title="Health Information & Passport" />
      <Card padding={18} radius={Radii.xl} style={styles.passportCard}>
        <View style={styles.passportHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={styles.passportIconCircle}>
              <MaterialIcons name="health-and-safety" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passportTitle}>Digital Health Passport</Text>
              <Text style={styles.passportSub} numberOfLines={2}>
                Longitudinal record & clinical continuity across consultations
              </Text>
            </View>
          </View>
          <View style={styles.activeTagBadge}>
            <MaterialIcons name="check-circle" size={12} color="#16A34A" />
            <Text style={styles.activeTagBadgeText}>ACTIVE</Text>
          </View>
        </View>

        {/* Health Data Preview Rows */}
        <View style={styles.healthSummaryBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Blood Group</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  fontWeight: '700',
                  color: patient.bloodGroup ? Colors.onSurface : Colors.outline,
                },
              ]}
            >
              {patient.bloodGroup || 'Not added yet'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Allergies</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  color: (patient.allergies || []).length > 0 ? Colors.onSurface : Colors.outline,
                },
              ]}
            >
              {(patient.allergies || []).length > 0
                ? (patient.allergies || []).join(', ')
                : 'No allergies added'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Chronic Conditions</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  color: (patient.chronicConditions || []).length > 0 ? Colors.onSurface : Colors.outline,
                },
              ]}
            >
              {(patient.chronicConditions || []).length > 0
                ? (patient.chronicConditions || []).join(', ')
                : 'No chronic conditions added'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Medications</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  color: (patient.currentMedications || []).length > 0 ? Colors.onSurface : Colors.outline,
                },
              ]}
            >
              {(patient.currentMedications || []).length > 0
                ? (patient.currentMedications || []).join(', ')
                : 'No current medications added'}
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Emergency Contact</Text>
            <Text
              style={[
                styles.infoValue,
                {
                  color: patient.emergencyContact?.name ? Colors.onSurface : Colors.outline,
                },
              ]}
            >
              {patient.emergencyContact?.name
                ? `${patient.emergencyContact.name} (${patient.emergencyContact.relation || 'Contact'})`
                : 'Not added yet'}
            </Text>
          </View>
        </View>

        {/* Action Buttons - Equal Sized */}
        <View style={styles.healthActionRow}>
          <View style={{ flex: 1 }}>
            <Button
              label="View"
              icon="visibility"
              block
              onPress={() => setHealthPassportVisible(true)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Edit"
              icon="edit"
              variant="outline"
              block
              onPress={() => setEditHealthInfoVisible(true)}
            />
          </View>
        </View>
      </Card>

      {/* Connectivity & Sync */}
      <SectionHeader title="Connectivity & Sync" />
      <Card padding={14} radius={Radii.lg} style={{ gap: 10 }}>
        <TouchableOpacity style={styles.toggleRow} onPress={toggleOnline} activeOpacity={0.7}>
          <View style={[styles.toggleIcon, isOnline ? styles.toggleOnline : styles.toggleOffline]}>
            <MaterialIcons name={isOnline ? 'wifi' : 'wifi-off'} size={20} color={isOnline ? Colors.tertiary : '#D97706'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>{isOnline ? 'Connected' : 'Offline Mode'}</Text>
            <Text style={styles.toggleSub}>{isOnline ? 'All services active' : 'Emergency & cached data available'}</Text>
          </View>
          <View style={[styles.toggleSwitch, isOnline && styles.toggleSwitchOn]}>
            <View style={[styles.toggleDot, isOnline && styles.toggleDotOn]} />
          </View>
        </TouchableOpacity>

        {pendingSyncCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} activeOpacity={0.7}>
            <MaterialIcons name="sync" size={18} color={Colors.primary} />
            <Text style={styles.syncText}>{pendingSyncCount} pending action{pendingSyncCount > 1 ? 's' : ''} to sync</Text>
            <MaterialIcons name="chevron-right" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </Card>

      {/* Language */}
      <SectionHeader title="Language Preference" />
      <View style={styles.langRow}>
        {languages.map(lang => (
          <TouchableOpacity
            key={lang}
            style={[styles.langChip, selectedLang === lang && styles.langChipActive]}
            onPress={() => { setSelectedLang(lang); Alert.alert('Language', `Interface set to ${lang}`); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.langText, selectedLang === lang && styles.langTextActive]}>{lang}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Account */}
      <SectionHeader title="Account" />
      <Button
        label={`Sign out${user?.email ? ` (${user.email})` : ''}`}
        variant="outline"
        icon="logout"
        block
        onPress={() =>
          Alert.alert('Sign out', 'Pending offline actions stay queued on this device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => { logout(); } },
          ])
        }
      />

      {/* Edit Profile Modal */}
      <EditPatientProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
      />

      {/* Edit Health Info Modal */}
      <EditHealthInfoModal
        visible={editHealthInfoVisible}
        onClose={() => setEditHealthInfoVisible(false)}
        onSaved={refresh}
      />

      {/* Health Passport Modal */}
      <HealthPassportModal
        visible={healthPassportVisible}
        patientId={patient.id}
        patientData={patient}
        onClose={() => setHealthPassportVisible(false)}
        onEditHealthInfo={() => {
          setHealthPassportVisible(false);
          setEditHealthInfoVisible(true);
        }}
      />

      {/* Location Picker Modal */}
      <LocationPicker
        visible={locationPickerVisible}
        title="Update Registered Location"
        initialLocation={{
          latitude: patient.latitude,
          longitude: patient.longitude,
          address: patient.address || `${patient.village}, ${patient.district}`,
        }}
        onClose={() => setLocationPickerVisible(false)}
        onLocationConfirmed={handleLocationConfirmed}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 12, paddingBottom: 32 },
  abhaCard: { backgroundColor: Colors.secondary, borderRadius: Radii.xl, padding: 18, gap: 12, ...Shadows.lg },
  abhaTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  abhaLabel: { fontSize: 10, fontWeight: '700', color: '#95F1FF', textTransform: 'uppercase', letterSpacing: 1 },
  abhaName: { fontSize: 20, fontWeight: '800', color: Colors.white, marginTop: 4 },
  editCardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.full },
  editCardBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  abhaIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  abhaId: { fontSize: 20, fontWeight: '300', color: Colors.white, letterSpacing: 2, fontFamily: 'monospace' },
  abhaDetails: { flexDirection: 'row', gap: 16 },
  abhaDetailItem: {},
  abhaDetailLabel: { fontSize: 9, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: 0.5 },
  abhaDetailValue: { fontSize: 12, fontWeight: '600', color: Colors.white, marginTop: 1 },
  ayushmanBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255, 255, 255, 0.12)', padding: 8, borderRadius: Radii.md },
  ayushmanText: { fontSize: 10, color: '#9FF4CD', fontWeight: '600', flex: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  contactSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 1 },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  passportCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#0F172A', flex: 1, textAlign: 'right', marginLeft: 12 },
  passportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  passportIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(8, 127, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(8, 127, 140, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  passportSub: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },
  activeTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  healthSummaryBox: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  healthActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  toggleOnline: { backgroundColor: Colors.tertiaryContainer },
  toggleOffline: { backgroundColor: Colors.surfaceContainerLow },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  toggleSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 1 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceContainerHigh, justifyContent: 'center', paddingHorizontal: 2 },
  toggleSwitchOn: { backgroundColor: Colors.tertiary },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white, ...Shadows.sm },
  toggleDotOn: { alignSelf: 'flex-end' },
  syncBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryLight, padding: 10, borderRadius: Radii.md },
  syncText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.primaryDark },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radii.md, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
  langTextActive: { color: Colors.white },
});
