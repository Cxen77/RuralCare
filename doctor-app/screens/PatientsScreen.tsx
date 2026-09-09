/**
 * Doctor App - PatientsScreen
 * Collapsible patient registry matching TodayScreen's rich clinical cards.
 * Displays compact single-row patient cards with chevron toggle that expand
 * into the complete workbench view (complaints, AI triage, allergies, communication, consult).
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
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
  onStartConsult: (patientId: string) => void;
}

const FILTERS = [
  { id: 'all', label: 'All Patients' },
  { id: 'queue', label: 'In Queue' },
  { id: 'done', label: 'Consulted' },
];

export const PatientsScreen: React.FC<PatientsScreenProps> = ({
  patients,
  statusById,
  appointments = [],
  onStartConsult,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
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

  const filtered = patients.filter(p => {
    const nameMatch = (p.name || '').toLowerCase().includes(query.toLowerCase());
    const villageMatch = (p.village || '').toLowerCase().includes(query.toLowerCase());
    const abhaMatch = (p.abhaId || '').toLowerCase().includes(query.toLowerCase());
    const matchesQuery = nameMatch || villageMatch || abhaMatch;
    const status = statusById[p.id];
    const matchesFilter =
      filter === 'all' ||
      (filter === 'queue' && (!!status && status !== 'done')) ||
      (filter === 'done' && status === 'done');
    return matchesQuery && matchesFilter;
  });

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
          <View style={styles.chipRow}>
            {FILTERS.map(f => (
              <Chip
                key={f.id}
                label={f.label}
                size="sm"
                selected={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </View>
        </View>

        {/* Patient Cards List */}
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map(patient => {
            const isExpanded = !!expandedIds[patient.id];
            const appt = appointments.find(a => a.patientId === patient.id);
            const status = statusById[patient.id] || (appt?.status === 'in-consult' ? 'in-consult' : appt?.status === 'done' ? 'done' : 'waiting');
            const isWaiting = status === 'waiting';
            const isInConsult = status === 'in-consult';
            const isDone = status === 'done';

            const reason = appt?.reason || (patient as any).chiefComplaint || 'General Consultation & Health Assessment';
            const triage = appt?.triage || (patient as any).triage;
            const mode = appt?.mode === 'video' ? 'video' : 'clinic';
            const dateStr = appt?.date ? `${appt.date} • ${appt.time}` : appt?.time || 'Today';

            return (
              <Card
                key={patient.id}
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
                  onPress={() => toggleExpand(patient.id)}
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
                          name={mode === 'video' ? 'videocam' : 'location-on'}
                          size={11}
                          color={mode === 'video' ? Colors.primary : Colors.secondary}
                        />
                        <Text style={styles.modeTimeText}>
                          {isDone ? 'Consulted' : isInConsult ? 'In Consult' : dateStr}
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

                {/* Fully Expanded Details - Identical to TodayScreen Component */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {/* Chief Complaint Box */}
                    <View style={styles.complaintContainer}>
                      <Text style={styles.complaintLabel}>Reason for Visit</Text>
                      <Text style={styles.complaintText}>{reason}</Text>
                    </View>

                    {/* AI Triage Findings Strip */}
                    {!!triage && (
                      <View style={styles.aiTriageStrip}>
                        <View style={styles.aiTriageHead}>
                          <MaterialIcons name="smart-toy" size={14} color={Colors.primary} />
                          <Text style={styles.aiTriageHeadText}>AI Triage Intake</Text>
                        </View>
                        <Text style={styles.aiTriageSummaryText}>{triage}</Text>
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
                            setChatApptId(appt?.id || `appt-${patient.id}`);
                            setChatParticipant(patient.name);
                            setChatApptDate(appt?.date || '');
                            setChatApptTime(appt?.time || '');
                            setChatApptMode(mode === 'video' ? 'Teleconsultation' : 'In-Person');
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
                            setVideoApptId(appt?.id || `appt-${patient.id}`);
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
                            setVideoApptId(appt?.id || `appt-${patient.id}`);
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
                        onPress={() => onStartConsult(patient.id)}
                        style={{ marginTop: 2 }}
                      />
                    ) : (
                      <View style={styles.consultedBadge}>
                        <MaterialIcons name="check-circle" size={14} color={Colors.tertiary} />
                        <Text style={styles.consultedBadgeText}>Consultation Concluded • Rx Issued</Text>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            );
          })}

          {patients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="groups" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No patients registered yet</Text>
              <Text style={styles.emptySub}>
                Patients who book appointments from the RuralCare Patient App will appear here in real time.
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No matching patients</Text>
              <Text style={styles.emptySub}>
                No patients found matching your search term or active filter.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

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
