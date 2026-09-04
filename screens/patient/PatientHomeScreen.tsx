/**
 * Patient Home Screen
 * Dashboard with live appointments, prescriptions, referrals, emergency SOS
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { Card, Chip, SectionHeader, Button } from '../../components/ui';

interface PatientHomeScreenProps {
  onNavigate: (tab: string) => void;
  onOpenSos: () => void;
}

export const PatientHomeScreen: React.FC<PatientHomeScreenProps> = ({ onNavigate, onOpenSos }) => {
  const { patient, appointments, prescriptions, referrals, isOnline, doctors, pharmacies, hospitals } = useCarePlatform();

  const activeAppointments = appointments.filter(a => ['confirmed', 'in_consultation'].includes(a.status));
  const pendingPrescriptions = prescriptions.filter(p => p.dispensingStatus === 'pending' || p.dispensingStatus === 'partial');
  const activeReferrals = referrals.filter(r => ['pending', 'accepted'].includes(r.status));

  const getDoctorName = (doctorId: string) => doctors.find(d => d.id === doctorId)?.name || 'Doctor';
  const getDoctorClinic = (doctorId: string) => doctors.find(d => d.id === doctorId)?.clinicName || 'Clinic';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Emergency Banner */}
      <View style={styles.emergencyBanner}>
        <View>
          <Text style={styles.emergencyTitle}>Need Urgent Medical Help?</Text>
          <Text style={styles.emergencySub}>Immediate 24/7 priority routing to ambulance & nearest PHC</Text>
        </View>
        <Button label="108 Emergency Assistance" icon="call" variant="danger" block onPress={onOpenSos} />
      </View>

      {/* AI Triage CTA */}
      <Card radius={Radii.lg} elevation="sm" style={{ borderWidth: 1.5, borderColor: '#D4EBED' }}>
        <View style={styles.triageHeader}>
          <View style={styles.triageIcon}>
            <MaterialIcons name="health-and-safety" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.triageTitle}>Tell us what you're feeling</Text>
            <Text style={styles.triageSub}>Clinical AI Voice & Chat Triage</Text>
          </View>
        </View>
        <Text style={styles.triageDesc}>
          Describe symptoms in Hindi, Bhojpuri, or English to get instant triage guidance and find nearby PHC doctors.
        </Text>
        <Button label="Start AI Health Check" icon="mic" block onPress={() => onNavigate('triage')} />
      </Card>

      {/* Nearby Healthcare */}
      <SectionHeader title="Nearby Healthcare" actionLabel="View All" onAction={() => onNavigate('doctors')} />
      <View style={styles.categoryRow}>
        <Card onPress={() => onNavigate('doctors')} padding={0} radius={Radii.md} style={styles.categoryTile}>
          <View style={styles.categoryIconWrap}>
            <MaterialIcons name="person-search" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.categoryTitle}>Doctors</Text>
          <Text style={styles.categoryCount}>{doctors.filter(d => d.isAvailable).length} available</Text>
        </Card>
        <Card onPress={() => onNavigate('meds')} padding={0} radius={Radii.md} style={styles.categoryTile}>
          <View style={styles.categoryIconWrap}>
            <MaterialIcons name="local-pharmacy" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.categoryTitle}>Pharmacies</Text>
          <Text style={styles.categoryCount}>{pharmacies.length} nearby</Text>
        </Card>
        <Card onPress={() => Alert.alert('Hospitals', `${hospitals.length} referral hospitals in the RuralCare network`)} padding={0} radius={Radii.md} style={styles.categoryTile}>
          <View style={styles.categoryIconWrap}>
            <MaterialIcons name="local-hospital" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.categoryTitle}>Hospitals</Text>
          <Text style={styles.categoryCount}>{hospitals.length} in network</Text>
        </Card>
      </View>

      {/* Live Appointments */}
      {activeAppointments.length > 0 && (
        <>
          <SectionHeader title="Upcoming Appointments" actionLabel="View All" onAction={() => onNavigate('doctors')} />
          {activeAppointments.map(appt => (
            <Card key={appt.id} onPress={() => onNavigate('doctors')} padding={12} radius={Radii.md} style={styles.apptCard}>
              <View style={[styles.apptIconWrap, appt.status === 'in_consultation' && { backgroundColor: Colors.primaryLight }]}>
                <MaterialIcons
                  name={appt.status === 'in_consultation' ? 'videocam' : 'event'}
                  size={20}
                  color={appt.status === 'in_consultation' ? Colors.primary : Colors.secondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTitle}>{getDoctorName(appt.doctorId)}</Text>
                <Text style={styles.apptSub}>
                  {appt.status === 'in_consultation' ? 'In Consultation Now' : `${appt.date} at ${appt.time}`}
                </Text>
                <Text style={styles.apptMeta}>{getDoctorClinic(appt.doctorId)} • {appt.mode}</Text>
              </View>
              <View style={[styles.urgencyBadge, appt.urgency === 'high' ? styles.urgencyHigh : appt.urgency === 'medium' ? styles.urgencyMedium : styles.urgencyRoutine]}>
                <Text style={styles.urgencyText}>{appt.urgency}</Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Pending Prescriptions */}
      {pendingPrescriptions.length > 0 && (
        <>
          <SectionHeader title="Prescriptions Ready" actionLabel="View All" onAction={() => onNavigate('meds')} />
          {pendingPrescriptions.map(rx => (
            <Card key={rx.id} onPress={() => onNavigate('meds')} padding={12} radius={Radii.md} style={styles.apptCard}>
              <View style={[styles.apptIconWrap, { backgroundColor: Colors.tertiaryContainer }]}>
                <MaterialIcons name="medication" size={20} color={Colors.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptTitle}>{rx.items.length} medicine{rx.items.length > 1 ? 's' : ''} prescribed</Text>
                <Text style={styles.apptSub}>By {rx.doctorName} • {rx.diagnosis}</Text>
                <Text style={[styles.apptMeta, { color: Colors.tertiary }]}>
                  {rx.dispensingStatus === 'pending' ? 'Ready for pharmacy pickup' : 'Partially dispensed'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.outline} />
            </Card>
          ))}
        </>
      )}

      {/* Active Referrals */}
      {activeReferrals.length > 0 && (
        <>
          <SectionHeader title="Hospital Referrals" />
          {activeReferrals.map(ref => (
            <Card key={ref.id} padding={12} radius={Radii.md} style={[styles.apptCard, { borderLeftWidth: 3, borderLeftColor: ref.status === 'accepted' ? Colors.tertiary : Colors.primary }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="local-hospital" size={18} color={Colors.secondary} />
                  <Text style={styles.apptTitle}>Hospital Referral</Text>
                </View>
                <Text style={styles.apptSub}>{ref.reason}</Text>
                <Text style={[styles.apptMeta, { color: ref.status === 'accepted' ? Colors.tertiary : Colors.primary }]}>
                  {ref.status === 'accepted'
                    ? `Accepted • ${ref.assignedDepartment} • ${ref.assignedBed}`
                    : 'Waiting for hospital response...'}
                </Text>
                {ref.ambulanceDispatched && (
                  <Text style={[styles.apptMeta, { color: Colors.error }]}>
                    Ambulance dispatched • ETA: {ref.ambulanceEta}
                  </Text>
                )}
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Helplines */}
      <Card padding={12} radius={Radii.md} bordered={false} elevation="none" style={{ backgroundColor: Colors.surfaceContainerLow }}>
        <Text style={styles.helplineHeading}>Direct Toll-Free Helplines</Text>
        <View style={styles.helplineRow}>
          <Chip label="108 Ambulance" icon="emergency" size="sm" tone="primary" onPress={onOpenSos} />
          <Chip label="104 Health Info" icon="support-agent" size="sm" tone="primary" />
          <Chip label="14416 MANAS" icon="psychology" size="sm" tone="navy" />
        </View>
      </Card>
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 16, paddingBottom: 24 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeTitle: { fontSize: 21, fontWeight: '800', color: Colors.onSurface, letterSpacing: -0.3 },
  welcomeSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.tertiaryContainer, borderWidth: 1, borderColor: Colors.outlineLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.full },
  statusPillOffline: { backgroundColor: Colors.surfaceContainerLow, borderColor: Colors.outlineLight },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.tertiary },
  statusDotOffline: { backgroundColor: Colors.outline },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.onTertiaryContainer },
  statusTextOffline: { color: Colors.onSurfaceVariant },
  emergencyBanner: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineLight, borderRadius: Radii.lg, padding: Spacing.md, gap: 10, ...Shadows.sm },
  emergencyTitle: { fontSize: 15, fontWeight: '800', color: Colors.secondary },
  emergencySub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2, lineHeight: 16, marginBottom: 8 },
  triageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  triageIcon: { width: 42, height: 42, borderRadius: Radii.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  triageTitle: { fontSize: 16, fontWeight: '700', color: Colors.secondary },
  triageSub: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  triageDesc: { fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 17, marginBottom: 12 },
  apptCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  apptIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  apptTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  apptSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  apptMeta: { fontSize: 11, fontWeight: '600', marginTop: 2, color: Colors.onSurfaceVariant },
  urgencyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full },
  urgencyHigh: { backgroundColor: '#FEE2E2' },
  urgencyMedium: { backgroundColor: Colors.surfaceContainerLow },
  urgencyRoutine: { backgroundColor: Colors.surfaceContainerLow },
  urgencyText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: Colors.onSurfaceVariant },
  categoryRow: { flexDirection: 'row', gap: 12 },
  categoryTile: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 10, minHeight: 125, borderWidth: 1, borderColor: Colors.outlineLight, backgroundColor: Colors.surfaceContainerLowest },
  categoryIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  categoryTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.secondary, letterSpacing: -0.2 },
  categoryCount: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  helplineHeading: { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  helplineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
