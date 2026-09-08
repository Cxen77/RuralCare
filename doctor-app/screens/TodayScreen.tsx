/**
 * Doctor App - TodayScreen (Redesigned with Stitch Design System)
 * High-utility clinical dashboard with OPD queue, triage indicators, and bento metrics
 */

import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Appointment, Patient, Referral, DoctorProfileData } from '../types';
import { Avatar, Badge, Button, Card, Chip, SectionHeader, ClinicalLoadingScreen } from '../components/ui';
import { AppointmentChatModal } from '../components/communication/AppointmentChatModal';
import { CallModal } from '../components/communication/CallModal';
import { CallType } from '../services/communication/WebRTCCallingEngine';
import { api } from '../services/api';

interface TodayScreenProps {
  appointments: Appointment[];
  patientsById: Record<string, Patient>;
  referrals: Referral[];
  doctor?: DoctorProfileData | null;
  isLoading?: boolean;
  isOffline?: boolean;
  onStartConsult: (appointmentId: string) => void;
  onOpenQueue: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  appointments,
  patientsById,
  referrals,
  doctor,
  isLoading,
  isOffline,
  onStartConsult,
  onOpenQueue,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'waiting' | 'clinic' | 'video' | 'done'>('all');

  // Communication modal state
  const [chatApptId, setChatApptId] = useState<string | null>(null);
  const [chatParticipant, setChatParticipant] = useState('');
  const [chatApptDate, setChatApptDate] = useState('');
  const [chatApptTime, setChatApptTime] = useState('');
  const [chatApptMode, setChatApptMode] = useState('');
  const [videoApptId, setVideoApptId] = useState<string | null>(null);
  const [videoParticipant, setVideoParticipant] = useState('');
  const [callType, setCallType] = useState<CallType>('video');

  // Doctor's userId for chat bubble alignment
  const currentUserId = doctor?.id || '';

  const waitingCount = appointments.filter(a => a.status === 'waiting').length;
  const inConsultCount = appointments.filter(a => a.status === 'in-consult').length;
  const doneCount = appointments.filter(a => a.status === 'done').length;
  const activeConsultation = appointments.find(a => a.status === 'in-consult');
  const pendingReferrals = referrals.filter(r => r.status === 'pending').length;

  const filteredAppointments = useMemo(() => {
    switch (filterMode) {
      case 'waiting':
        return appointments.filter(a => a.status === 'waiting');
      case 'clinic':
        return appointments.filter(a => a.mode === 'clinic' && a.status !== 'done');
      case 'video':
        return appointments.filter(a => a.mode === 'video' && a.status !== 'done');
      case 'done':
        return appointments.filter(a => a.status === 'done');
      case 'all':
      default:
        return appointments;
    }
  }, [appointments, filterMode]);

  if (isLoading && appointments.length === 0) {
    return (
      <ClinicalLoadingScreen
        title="RuralCare Clinical Hub"
        subtitle="Loading patient records & active OPD queue…"
      />
    );
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

      {/* OPD Shift & Doctor Hero Banner (Stitch Secondary Navy Tone) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroDocInfo}>
            <Text style={styles.heroFacilityName}>{doctor?.facility || 'RuralCare Clinic'} • OPD</Text>
            <Text style={styles.heroDocName}>{doctor?.name || 'Dr. RuralCare'}</Text>
            <Text style={styles.heroDocSub}>
              {doctor?.degrees || doctor?.specialty || 'General Medicine'} • HPR: {(doctor?.hprId || doctor?.id || 'HPR-DEV-001').slice(0, 10)}...
            </Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>OPD Live</Text>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroFooterRow}>
          <View style={styles.shiftTimeWrap}>
            <MaterialIcons name="schedule" size={15} color="#CBD5E1" />
            <Text style={styles.shiftTimeText}>Shift: 09:00 AM – 05:00 PM • Room 4</Text>
          </View>
          <TouchableOpacity
            style={styles.walkInBtn}
            onPress={() => onOpenQueue()}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={14} color={Colors.white} />
            <Text style={styles.walkInBtnText}>+ Walk-In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Clinical Metrics Carousel (Horizontal Scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsCarousel}
      >
        {/* Waiting Card */}
        <TouchableOpacity
          style={[styles.metricCard, filterMode === 'waiting' && styles.metricCardActive]}
          onPress={() => setFilterMode(filterMode === 'waiting' ? 'all' : 'waiting')}
          activeOpacity={0.75}
        >
          <View style={styles.metricCardHead}>
            <View style={[styles.metricIconBox, { backgroundColor: '#EFFDFF' }]}>
              <MaterialIcons name="hourglass-empty" size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.primary }]}>{waitingCount}</Text>
          </View>
          <Text style={styles.metricLabel}>Waiting in OPD</Text>
          <Text style={styles.metricSub}>Avg wait ~12 min</Text>
        </TouchableOpacity>

        {/* In Consult Card */}
        <TouchableOpacity
          style={[styles.metricCard, inConsultCount > 0 && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }]}
          onPress={() => {
            if (activeConsultation) onStartConsult(activeConsultation.id);
            else onOpenQueue();
          }}
          activeOpacity={0.75}
        >
          <View style={styles.metricCardHead}>
            <View style={[styles.metricIconBox, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="medical-services" size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.primary }]}>{inConsultCount}</Text>
          </View>
          <Text style={styles.metricLabel}>In Consultation</Text>
          <Text style={styles.metricSub}>{inConsultCount > 0 ? 'Active room' : 'Desk free'}</Text>
        </TouchableOpacity>

        {/* Completed Card */}
        <TouchableOpacity
          style={[styles.metricCard, filterMode === 'done' && styles.metricCardActive]}
          onPress={() => setFilterMode(filterMode === 'done' ? 'all' : 'done')}
          activeOpacity={0.75}
        >
          <View style={styles.metricCardHead}>
            <View style={[styles.metricIconBox, { backgroundColor: Colors.tertiaryContainer }]}>
              <MaterialIcons name="check-circle-outline" size={18} color={Colors.tertiary} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.tertiary }]}>{doneCount}</Text>
          </View>
          <Text style={styles.metricLabel}>Completed</Text>
          <Text style={styles.metricSub}>Charts signed</Text>
        </TouchableOpacity>

        {/* Referrals & Bed Capacity Card */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => Alert.alert('Referral & CHC Capacity', 'Ramnagar CHC: 8 general beds & 2 ICU beds available. 1 ambulance dispatched.')}
          activeOpacity={0.75}
        >
          <View style={styles.metricCardHead}>
            <View style={[styles.metricIconBox, { backgroundColor: Colors.surfaceContainerLow }]}>
              <MaterialIcons name="local-hospital" size={18} color={Colors.secondary} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.secondary }]}>{pendingReferrals}</Text>
          </View>
          <Text style={styles.metricLabel}>Hospital Referral</Text>
          <Text style={styles.metricSub}>{pendingReferrals > 0 ? 'Awaiting CHC' : 'All responded'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Live Hospital Referral Responses */}
      {referrals.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionHeader title="Hospital Referrals (Live)" />
          {referrals.map(ref => (
            <Card key={ref.id} padding={12} radius={Radii.md}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.secondary }}>
                    {ref.patientName} • {ref.specialty}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                    {ref.beds}
                    {ref.hospitalName ? ` • ${ref.hospitalName}` : ''} • {ref.createdAt}
                  </Text>
                </View>
                <Badge
                  label={
                    ref.status === 'pending'
                      ? 'Awaiting Response'
                      : ref.status === 'accepted'
                        ? 'Accepted'
                        : 'Rejected'
                  }
                  tone={
                    ref.status === 'pending'
                      ? 'navy'
                      : ref.status === 'accepted'
                        ? 'success'
                        : 'danger'
                  }
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Active Consultation Spotlight Banner */}
      {activeConsultation && patientsById[activeConsultation.patientId] && (
        <Card radius={Radii.lg} padding={12} style={styles.spotlightCard}>
          <Text style={styles.spotlightTag}>Active Consultation</Text>
          <View style={styles.spotlightMainRow}>
            <Avatar
              uri={patientsById[activeConsultation.patientId]?.avatar}
              name={patientsById[activeConsultation.patientId]?.name}
              size={42}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.spotlightName} numberOfLines={1}>
                {patientsById[activeConsultation.patientId]?.name}
              </Text>
              <Text style={styles.spotlightReason} numberOfLines={1}>
                {activeConsultation.reason || 'General Consultation'} • {patientsById[activeConsultation.patientId]?.age}y
              </Text>
            </View>
            <TouchableOpacity
              style={styles.spotlightResumeBtn}
              onPress={() => onStartConsult(activeConsultation.id)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="assignment" size={14} color={Colors.white} />
              <Text style={styles.spotlightResumeText}>Resume</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Queue Filter Tabs Bar */}
      <View style={styles.queueHeaderSection}>
        <SectionHeader
          title={`Patient Queue (${filteredAppointments.length})`}
          actionLabel="View All"
          onAction={onOpenQueue}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
            onPress={() => setFilterMode('all')}
          >
            <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>
              All ({appointments.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'waiting' && styles.filterChipActive]}
            onPress={() => setFilterMode('waiting')}
          >
            <Text style={[styles.filterChipText, filterMode === 'waiting' && styles.filterChipTextActive]}>
              Waiting ({waitingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'clinic' && styles.filterChipActive]}
            onPress={() => setFilterMode('clinic')}
          >
            <Text style={[styles.filterChipText, filterMode === 'clinic' && styles.filterChipTextActive]}>
              In-Person
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'video' && styles.filterChipActive]}
            onPress={() => setFilterMode('video')}
          >
            <Text style={[styles.filterChipText, filterMode === 'video' && styles.filterChipTextActive]}>
              Teleconsult
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filterMode === 'done' && styles.filterChipActive]}
            onPress={() => setFilterMode('done')}
          >
            <Text style={[styles.filterChipText, filterMode === 'done' && styles.filterChipTextActive]}>
              Completed ({doneCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Patient Cards List - Displays 1 recent patient with View All trigger */}
      <View style={styles.queueList}>
        {filteredAppointments.slice(0, 1).map(appt => {
          const patient: Patient = appt.patient || patientsById[appt.patientId] || {
            id: appt.patientId || 'unknown',
            name: (appt as any).patientName || `Patient ${appt.patientId?.slice(-4) || ''}`,
            age: 30,
            gender: 'Other',
            village: 'Local',
            phone: '',
            allergies: [],
            abhaId: 'ABHA-PENDING',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
          };

          const isWaiting = appt.status === 'waiting';
          const isInConsult = appt.status === 'in-consult';
          const isDone = appt.status === 'done';

          return (
            <Card
              key={appt.id}
              padding={14}
              radius={Radii.lg}
              style={[
                styles.patientCard,
                isInConsult && styles.patientCardInConsult,
                isDone && styles.patientCardDone,
              ]}
            >
              {/* Top Row: Avatar + Name + Badges */}
              <View style={styles.patientTopRow}>
                <Avatar uri={patient?.avatar} name={patient?.name} size={48} />
                <View style={{ flex: 1 }}>
                  <View style={styles.patientNameRow}>
                    <Text style={styles.patientNameText}>{patient.name}</Text>
                    <View style={styles.modeTimePill}>
                      <MaterialIcons
                        name={appt.mode === 'video' ? 'videocam' : 'location-on'}
                        size={12}
                        color={appt.mode === 'video' ? Colors.primary : Colors.secondary}
                      />
                      <Text style={styles.modeTimeText}>
                        {appt.date ? `${appt.date} • ${appt.time}` : appt.time}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.patientDemographics}>
                    {patient.age ? `${patient.age}y` : ''} {patient.gender ? `/ ${patient.gender}` : ''} {patient.village ? `• ${patient.village}` : ''} • ABHA: {(patient.abhaId || 'N/A').slice(0, 7)}...
                  </Text>
                </View>
              </View>

              {/* Chief Complaint Box */}
              <View style={styles.complaintContainer}>
                <Text style={styles.complaintLabel}>Reason for Visit</Text>
                <Text style={styles.complaintText}>{appt.reason || 'General Consultation'}</Text>
              </View>

              {/* AI Triage Findings Strip (Stitch High-Legibility Banner) */}
              {!!appt.triage && (
                <View style={styles.aiTriageStrip}>
                  <View style={styles.aiTriageHead}>
                    <MaterialIcons name="smart-toy" size={14} color={Colors.primary} />
                    <Text style={styles.aiTriageHeadText}>AI Triage Intake</Text>
                  </View>
                  <Text style={styles.aiTriageSummaryText}>{appt.triage}</Text>
                </View>
              )}

              {/* Patient Allergies Alert if present */}
              {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
                <View style={styles.allergyAlertBox}>
                  <MaterialIcons name="warning" size={13} color={Colors.error} />
                  <Text style={styles.allergyAlertText}>Allergies: {patient.allergies.join(', ')}</Text>
                </View>
              )}

              {/* Communication Actions */}
              {!isDone && (
                <View style={styles.commRow}>
                  <TouchableOpacity
                    style={styles.commChatBtn}
                    onPress={() => {
                      setChatApptId(appt.id);
                      setChatParticipant(patient.name);
                      setChatApptDate(appt.date || '');
                      setChatApptTime(appt.time || '');
                      setChatApptMode(appt.mode === 'video' ? 'Teleconsultation' : 'In-Person');
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="chat" size={15} color={Colors.primary} />
                    <Text style={styles.commChatBtnText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.commVoiceBtn}
                    onPress={() => {
                      setCallType('voice');
                      setVideoApptId(appt.id);
                      setVideoParticipant(patient.name);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="call" size={15} color={Colors.primary} />
                    <Text style={styles.commVoiceBtnText}>Voice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.commVideoBtn}
                    onPress={() => {
                      setCallType('video');
                      setVideoApptId(appt.id);
                      setVideoParticipant(patient.name);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="videocam" size={15} color={Colors.white} />
                    <Text style={styles.commVideoBtnText}>Video</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Consultation Action Trigger */}
              {!isDone ? (
                <Button
                  label={isWaiting ? 'Start Consultation' : 'Resume Consultation Workbench'}
                  icon="medical-services"
                  block
                  onPress={() => onStartConsult(appt.id)}
                  style={{ marginTop: 4 }}
                />
              ) : (
                <View style={styles.completedStatusRow}>
                  <MaterialIcons name="check-circle" size={16} color={Colors.tertiary} />
                  <Text style={styles.completedStatusText}>Consultation Completed & Digital Rx Issued</Text>
                </View>
              )}
            </Card>
          );
        })}

        {/* View All / More in Queue Button */}
        {filteredAppointments.length > 1 && (
          <TouchableOpacity
            style={styles.viewMoreQueueBtn}
            onPress={() => onOpenQueue()}
            activeOpacity={0.82}
          >
            <View style={styles.viewMoreLeft}>
              <View style={styles.viewMoreIconWrap}>
                <MaterialIcons name="groups" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.viewMoreQueueTitle}>
                  +{filteredAppointments.length - 1} more patient{filteredAppointments.length - 1 > 1 ? 's' : ''} in queue
                </Text>
                <Text style={styles.viewMoreQueueSub}>
                  Tap to view full OPD registry and attend waiting patients
                </Text>
              </View>
            </View>
            <View style={styles.viewMoreRight}>
              <Text style={styles.viewMoreActionText}>View All</Text>
              <MaterialIcons name="arrow-forward" size={16} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {appointments.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <MaterialIcons name="event-available" size={44} color={Colors.outline} />
            <Text style={styles.emptyStateTitle}>No appointments yet</Text>
            <Text style={styles.emptyStateSub}>Your OPD queue is currently empty. Patient bookings from the RuralCare Patient App will appear here in real time.</Text>
          </View>
        ) : filteredAppointments.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <MaterialIcons name="filter-list" size={44} color={Colors.outline} />
            <Text style={styles.emptyStateTitle}>No patients in this view</Text>
            <Text style={styles.emptyStateSub}>All appointments for this filter have been attended</Text>
          </View>
        ) : null}
      </View>

      {/* Clinical Tool Shortcuts Carousel (Horizontal Scroll) */}
      <SectionHeader title="Quick Actions & Clinical Shortcuts" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsCarousel}
      >
        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => onOpenQueue()}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: Colors.primaryLight }]}>
            <MaterialIcons name="groups" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.toolTitle}>Patient Registry</Text>
          <Text style={styles.toolSub}>
            {Object.keys(patientsById).length || appointments.length} Patient Records
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => setFilterMode('video')}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: '#EFFDFF' }]}>
            <MaterialIcons name="videocam" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.toolTitle}>Teleconsult Hub</Text>
          <Text style={styles.toolSub}>
            {appointments.filter(a => a.mode === 'video').length} Video Sessions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => Alert.alert('108 Emergency Direct', 'Direct priority ambulance hotline: 108\nRamnagar PHC Driver: +91-9431-XXXXXX\nResponse time: ~8 minutes')}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <MaterialIcons name="emergency" size={22} color={Colors.error} />
          </View>
          <Text style={styles.toolTitle}>Ambulance 108</Text>
          <Text style={styles.toolSub}>Emergency Dispatch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => Alert.alert('PHC Formulary', 'Jan Aushadhi Kendra Ramnagar: 100% vital antibiotics & fever meds in stock.\nInventory: 142 Essential Medicines.')}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: Colors.tertiaryContainer }]}>
            <MaterialIcons name="medication" size={22} color={Colors.tertiary} />
          </View>
          <Text style={styles.toolTitle}>Pharmacy Stock</Text>
          <Text style={styles.toolSub}>Jan Aushadhi Live</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => Alert.alert('CHC Network Capacity', 'Ramnagar Community Health Center:\n• General Ward: 8 beds free\n• Oxygen Supported: 4 beds free\n• ICU: 2 beds free\n• Blood Bank: O+, A+, B+ in stock')}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: Colors.surfaceContainerLow }]}>
            <MaterialIcons name="hotel" size={22} color={Colors.secondary} />
          </View>
          <Text style={styles.toolTitle}>Bed Capacity</Text>
          <Text style={styles.toolSub}>Ramnagar CHC Live</Text>
        </TouchableOpacity>
      </ScrollView>

    </ScrollView>

    {/* Communication Modals */}
    <AppointmentChatModal
      visible={!!chatApptId}
      onClose={() => setChatApptId(null)}
      appointmentId={chatApptId || ''}
      participantName={chatParticipant}
      appointmentDate={chatApptDate}
      appointmentTime={chatApptTime}
      mode={chatApptMode}
      api={api}
      currentUserId={currentUserId}
    />
    <CallModal
      visible={!!videoApptId}
      onClose={() => setVideoApptId(null)}
      peerName={videoParticipant}
      appointmentId={videoApptId || ''}
      callType={callType}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  contentContainer: {
    padding: Spacing.md,
    gap: 14,
    paddingBottom: 32,
  },

  /* Hero Card */
  heroCard: {
    backgroundColor: Colors.secondary,
    borderRadius: Radii.xl,
    padding: 16,
    gap: 12,
    ...Shadows.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroDocInfo: {
    flex: 1,
  },
  heroFacilityName: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#95F1FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroDocName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 2,
  },
  heroDocSub: {
    fontSize: 11.5,
    color: '#CBD5E1',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shiftTimeText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  walkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  walkInBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.white,
  },

  /* Clinical Metrics Carousel */
  metricsCarousel: {
    gap: 10,
    paddingVertical: 4,
  },
  metricCard: {
    width: 142,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    gap: 2,
    ...Shadows.sm,
  },
  metricCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: Colors.primaryLight,
  },
  metricCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },

  /* Spotlight Card */
  spotlightCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    padding: 12,
    gap: 8,
    ...Shadows.sm,
  },
  spotlightTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotlightMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spotlightName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
  },
  spotlightReason: {
    fontSize: 11.5,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  spotlightResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.full,
  },
  spotlightResumeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },

  /* Queue Header & Filters */
  queueHeaderSection: {
    gap: 8,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  filterChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  /* Patient Queue List */
  queueList: {
    gap: 12,
  },
  patientCard: {
    gap: 10,
  },
  patientCardInConsult: {
    borderColor: Colors.secondaryContainer,
    borderWidth: 1.5,
  },
  patientCardDone: {
    opacity: 0.8,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  patientNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
  },
  modeTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  modeTimeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.secondary,
  },
  patientDemographics: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  complaintContainer: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radii.md,
  },
  complaintLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  complaintText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: 2,
  },
  aiTriageStrip: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
    borderRadius: Radii.md,
    padding: 10,
    gap: 3,
  },
  aiTriageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiTriageHeadText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiTriageSummaryText: {
    fontSize: 11.5,
    color: Colors.primaryDark,
    lineHeight: 16,
  },
  allergyAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  allergyAlertText: {
    fontSize: 11,
    color: Colors.error,
    fontWeight: '600',
  },
  completedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.tertiaryContainer,
    padding: 10,
    borderRadius: Radii.md,
  },
  completedStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onTertiaryContainer,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  emptyStateSub: {
    fontSize: 12,
    color: Colors.outline,
  },

  /* View More Queue Trigger */
  viewMoreQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: Radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    ...Shadows.sm,
  },
  viewMoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  viewMoreIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreQueueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  viewMoreQueueSub: {
    fontSize: 10.5,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  viewMoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.full,
  },
  viewMoreActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* Tools & Shortcuts Carousel */
  toolsCarousel: {
    gap: 10,
    paddingVertical: 4,
  },
  toolCard: {
    width: 138,
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    alignItems: 'center',
    gap: 3,
    ...Shadows.sm,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondary,
    textAlign: 'center',
  },
  toolSub: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  commRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  commChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  commChatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  commVideoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
  },
  commVideoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  commVoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  commVoiceBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
