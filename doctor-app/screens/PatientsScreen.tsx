/**
 * Doctor App - PatientsScreen
 * Displays all patient appointment cases with individual records.
 * Even if the same patient books multiple appointments, each appointment is
 * treated as an individual case with its own details and actions.
 * Cards start collapsed in a compact row with chevron toggle, and expand into
 * the full workbench view (complaint, AI triage, allergies, comms, consult & delete).
 */

import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Patient, Appointment } from '../types';
import { Avatar, Badge, Button, Card, Chip, Input } from '../components/ui';
import { AppointmentChatModal } from '../components/communication/AppointmentChatModal';
import { CallModal } from '../components/communication/CallModal';
import { CallType } from '../services/communication/WebRTCCallingEngine';
import { api } from '../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PatientsScreenProps {
  patients: Patient[];
  statusById: Record<string, 'waiting' | 'in-consult' | 'done'>;
  appointments?: Appointment[];
  onStartConsult: (appointmentId: string) => void;
  onDeleteAppointment?: (appointmentId: string) => void;
}

interface CaseItem {
  id: string;
  appointmentId: string;
  patientId: string;
  patient: Patient;
  appointment: Appointment;
  status: 'waiting' | 'in-consult' | 'done';
  dateStr: string;
  mode: 'video' | 'clinic';
  reason: string;
  triage: string;
}

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  patients,
  statusById,
  appointments = [],
  onStartConsult,
  onDeleteAppointment,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'queue' | 'in-consult' | 'done'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Communication modal state
  const [chatApptId, setChatApptId] = useState<string | null>(null);
  const [chatParticipant, setChatParticipant] = useState('');
  const [chatApptDate, setChatApptDate] = useState('');
  const [chatApptTime, setChatApptTime] = useState('');
  const [chatApptMode, setChatApptMode] = useState('');
  const [videoApptId, setVideoApptId] = useState<string | null>(null);
  const [videoParticipant, setVideoParticipant] = useState('');
  const [callType, setCallType] = useState<CallType>('video');

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Convert appointments into individual case items
  const cases = useMemo<CaseItem[]>(() => {
    const list: CaseItem[] = [];
    const patientMap = new Map<string, Patient>();
    patients.forEach(p => patientMap.set(p.id, p));

    appointments.forEach(appt => {
      const patient: Patient =
        appt.patient ||
        patientMap.get(appt.patientId) || {
          id: appt.patientId || 'unknown',
          name: (appt as any).patientName || 'OPD Patient',
          age: (appt as any).patientAge || 32,
          gender: (appt as any).patientGender || 'Patient',
          village: (appt as any).patientVillage || 'RuralCare Clinic',
          phone: (appt as any).patientPhone || '',
          allergies: (appt as any).patientAllergies || [],
          abhaId: (appt as any).patientAbhaId || 'ABHA Active',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
        };

      const dateStr = appt.date
        ? `${appt.date} • ${appt.time}`
        : appt.time || 'Today';

      list.push({
        id: appt.id,
        appointmentId: appt.id,
        patientId: appt.patientId,
        patient,
        appointment: appt,
        status: appt.status,
        dateStr,
        mode: appt.mode === 'video' ? 'video' : 'clinic',
        reason: appt.reason || 'General Consultation & Health Assessment',
        triage: appt.triage || '',
      });
    });

    return list;
  }, [appointments, patients]);

  const waitingCount = cases.filter(c => c.status === 'waiting').length;
  const inConsultCount = cases.filter(c => c.status === 'in-consult').length;
  const doneCount = cases.filter(c => c.status === 'done').length;

  const filters = [
    { id: 'all' as const, label: `All Cases (${cases.length})` },
    { id: 'queue' as const, label: `Waiting (${waitingCount})` },
    { id: 'in-consult' as const, label: `In-Consult (${inConsultCount})` },
    { id: 'done' as const, label: `Consulted (${doneCount})` },
  ];

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter(item => {
      const p = item.patient;
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const villageMatch = (p.village || '').toLowerCase().includes(q);
      const abhaMatch = (p.abhaId || '').toLowerCase().includes(q);
      const reasonMatch = (item.reason || '').toLowerCase().includes(q);
      const idMatch = (item.id || '').toLowerCase().includes(q);
      const matchesQuery = !q || nameMatch || villageMatch || abhaMatch || reasonMatch || idMatch;

      const matchesFilter =
        filter === 'all' ||
        (filter === 'queue' && item.status === 'waiting') ||
        (filter === 'in-consult' && item.status === 'in-consult') ||
        (filter === 'done' && item.status === 'done');

      return matchesQuery && matchesFilter;
    });
  }, [cases, query, filter]);

  const handleDelete = (appointmentId: string, patientName: string) => {
    const confirmMessage = `Are you sure you want to delete this appointment for ${patientName}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        onDeleteAppointment?.(appointmentId);
      }
    } else {
      Alert.alert('Delete Appointment', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteAppointment?.(appointmentId),
        },
      ]);
    }
  };

  return (
    <>
      <View style={styles.container}>
        {/* Search & Filter Header */}
        <View style={styles.topSection}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search patient, village or ABHA..."
            leadingIcon="search"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {filters.map(f => (
              <Chip
                key={f.id}
                label={f.label}
                size="sm"
                selected={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Patient Appointment Cases List */}
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {filteredCases.map(item => {
            const isExpanded = !!expandedIds[item.id];
            const isWaiting = item.status === 'waiting';
            const isInConsult = item.status === 'in-consult';
            const isDone = item.status === 'done';
            const patient = item.patient;

            return (
              <Card
                key={item.id}
                padding={12}
                radius={Radii.lg}
                style={[
                  styles.patientCard,
                  isInConsult && styles.patientCardInConsult,
                  isDone && styles.patientCardDone,
                ]}
              >
                {/* Compact Clickable Header Row */}
                <TouchableOpacity
                  style={styles.patientTopRow}
                  onPress={() => toggleExpand(item.id)}
                  activeOpacity={0.7}
                >
                  <Avatar uri={patient.avatar} name={patient.name} size={44} />

                  <View style={{ flex: 1 }}>
                    <View style={styles.patientNameRow}>
                      <Text style={styles.patientNameText} numberOfLines={1}>
                        {patient.name}
                      </Text>
                      <View style={styles.modeTimePill}>
                        <MaterialIcons
                          name={item.mode === 'video' ? 'videocam' : 'location-on'}
                          size={11}
                          color={item.mode === 'video' ? Colors.primary : Colors.secondary}
                        />
                        <Text style={styles.modeTimeText}>
                          {isDone ? 'Consulted' : isInConsult ? 'In Consult' : item.dateStr}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.patientDemographics} numberOfLines={1}>
                      {patient.age ? `${patient.age}y` : ''}{patient.gender ? ` / ${patient.gender}` : ''}{patient.village ? ` • ${patient.village}` : ''} • ABHA: {(patient.abhaId || 'Active').slice(0, 8)}...
                    </Text>
                  </View>

                  {/* Expand / Collapse Chevron Toggle */}
                  <View style={[styles.expandToggleBtn, isExpanded && styles.expandToggleBtnActive]}>
                    <MaterialIcons
                      name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={22}
                      color={isExpanded ? Colors.primaryDark : Colors.onSurfaceVariant}
                    />
                  </View>
                </TouchableOpacity>

                {/* Fully Expanded Details - Matching TodayScreen Workbench Component */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {/* Chief Complaint Box */}
                    <View style={styles.complaintContainer}>
                      <Text style={styles.complaintLabel}>Reason for Visit</Text>
                      <Text style={styles.complaintText}>{item.reason}</Text>
                    </View>

                    {/* AI Triage Findings Strip */}
                    {!!item.triage && (
                      <View style={styles.aiTriageStrip}>
                        <View style={styles.aiTriageHead}>
                          <MaterialIcons name="smart-toy" size={14} color={Colors.primary} />
                          <Text style={styles.aiTriageHeadText}>AI Triage Intake</Text>
                        </View>
                        <Text style={styles.aiTriageSummaryText}>{item.triage}</Text>
                      </View>
                    )}

                    {/* Patient Allergies Alert */}
                    {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
                      <View style={styles.allergyAlertBox}>
                        <MaterialIcons name="warning" size={13} color={Colors.error} />
                        <Text style={styles.allergyAlertText}>
                          Allergies: {patient.allergies.join(', ')}
                        </Text>
                      </View>
                    )}

                    {/* Communication Actions */}
                    {!isDone && (
                      <View style={styles.commRow}>
                        <TouchableOpacity
                          style={styles.commChatBtn}
                          onPress={() => {
                            setChatApptId(item.appointmentId);
                            setChatParticipant(patient.name);
                            setChatApptDate(item.appointment.date || '');
                            setChatApptTime(item.appointment.time || '');
                            setChatApptMode(item.mode === 'video' ? 'Teleconsultation' : 'In-Person');
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
                            setVideoApptId(item.appointmentId);
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
                            setVideoApptId(item.appointmentId);
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
                        onPress={() => onStartConsult(item.appointmentId)}
                        style={{ marginTop: 2 }}
                      />
                    ) : (
                      <View style={styles.consultedBadge}>
                        <MaterialIcons name="check-circle" size={14} color={Colors.tertiary} />
                        <Text style={styles.consultedBadgeText}>Consultation Concluded • Rx Issued</Text>
                      </View>
                    )}

                    {/* Delete / Cancel Appointment Option */}
                    {onDeleteAppointment && !isDone && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item.appointmentId, patient.name)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="delete-outline" size={15} color={Colors.error} />
                        <Text style={styles.deleteBtnText}>Delete Appointment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Card>
            );
          })}

          {cases.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="event-available" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No appointments booked yet</Text>
              <Text style={styles.emptySub}>
                When patients book consultations through the RuralCare Patient App, each appointment will appear here as an individual case.
              </Text>
            </View>
          ) : filteredCases.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="filter-list" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No cases match your search</Text>
              <Text style={styles.emptySub}>Try adjusting your filter or search query</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      {/* Appointment In-App Chat Modal */}
      <AppointmentChatModal
        visible={!!chatApptId}
        onClose={() => setChatApptId(null)}
        appointmentId={chatApptId || ''}
        participantName={chatParticipant}
        appointmentDate={chatApptDate}
        appointmentTime={chatApptTime}
        mode={chatApptMode}
        api={api}
        currentUserId="doctor"
      />

      {/* Calling Modal */}
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
  topSection: {
    padding: Spacing.md,
    gap: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  list: {
    padding: Spacing.md,
    gap: 8,
    paddingBottom: 28,
  },
  patientCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    ...Shadows.sm,
  },
  patientCardInConsult: {
    borderColor: Colors.secondaryContainer,
    borderWidth: 1.5,
    backgroundColor: '#F8FDFF',
  },
  patientCardDone: {
    opacity: 0.85,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  patientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  patientNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  patientNameText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.secondary,
    flex: 1,
  },
  modeTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  modeTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
  },
  patientDemographics: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  expandToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandToggleBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  expandedSection: {
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
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
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: 2,
  },
  aiTriageStrip: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
    borderRadius: Radii.md,
    padding: 9,
    gap: 3,
  },
  aiTriageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiTriageHeadText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiTriageSummaryText: {
    fontSize: 11,
    color: Colors.primaryDark,
    lineHeight: 15,
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
  commRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  commChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  commChatBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  commVideoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
  },
  commVideoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  commVoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  commVoiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  consultedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceContainerLow,
    marginTop: 4,
  },
  consultedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.tertiary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
    borderRadius: Radii.md,
    backgroundColor: 'transparent',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});
