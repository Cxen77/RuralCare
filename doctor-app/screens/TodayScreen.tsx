/**
 * Doctor App - TodayScreen (Redesigned with Stitch Design System)
 * High-utility clinical dashboard with OPD queue, triage indicators, and bento metrics
 */

import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Appointment, Patient, Referral, DOCTOR } from '../data/mock';
import { Avatar, Badge, Button, Card, Chip, SectionHeader } from '../components/ui';

interface TodayScreenProps {
  appointments: Appointment[];
  patientsById: Record<string, Patient>;
  referrals: Referral[];
  onStartConsult: (appointmentId: string) => void;
  onOpenQueue: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  appointments,
  patientsById,
  referrals,
  onStartConsult,
  onOpenQueue,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'waiting' | 'clinic' | 'video' | 'done'>('all');

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

      {/* OPD Shift & Doctor Hero Banner (Stitch Secondary Navy Tone) */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroDocInfo}>
            <Text style={styles.heroFacilityName}>{DOCTOR.facility} • OPD</Text>
            <Text style={styles.heroDocName}>{DOCTOR.name}</Text>
            <Text style={styles.heroDocSub}>{DOCTOR.degrees} • HPR: {DOCTOR.hprId.slice(0, 7)}...</Text>
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

      {/* Bento Clinical Metrics Grid (Stitch 8px rhythm & low-contrast borders) */}
      <View style={styles.bentoGrid}>
        {/* Waiting Card */}
        <TouchableOpacity
          style={[styles.bentoCell, filterMode === 'waiting' && styles.bentoCellActive]}
          onPress={() => setFilterMode(filterMode === 'waiting' ? 'all' : 'waiting')}
          activeOpacity={0.75}
        >
          <View style={styles.bentoCellHead}>
            <View style={[styles.bentoIconBox, { backgroundColor: '#EFFDFF' }]}>
              <MaterialIcons name="hourglass-empty" size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.bentoValue, { color: Colors.primary }]}>{waitingCount}</Text>
          </View>
          <Text style={styles.bentoLabel}>Waiting in OPD</Text>
          <Text style={styles.bentoSub}>Avg wait ~12 min</Text>
        </TouchableOpacity>

        {/* In Consult Card */}
        <View style={[styles.bentoCell, inConsultCount > 0 && { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }]}>
          <View style={styles.bentoCellHead}>
            <View style={[styles.bentoIconBox, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="medical-services" size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.bentoValue, { color: Colors.primary }]}>{inConsultCount}</Text>
          </View>
          <Text style={styles.bentoLabel}>In Consultation</Text>
          <Text style={styles.bentoSub}>{inConsultCount > 0 ? 'Active room' : 'Desk free'}</Text>
        </View>

        {/* Completed Card */}
        <TouchableOpacity
          style={[styles.bentoCell, filterMode === 'done' && styles.bentoCellActive]}
          onPress={() => setFilterMode(filterMode === 'done' ? 'all' : 'done')}
          activeOpacity={0.75}
        >
          <View style={styles.bentoCellHead}>
            <View style={[styles.bentoIconBox, { backgroundColor: Colors.tertiaryContainer }]}>
              <MaterialIcons name="check-circle-outline" size={18} color={Colors.tertiary} />
            </View>
            <Text style={[styles.bentoValue, { color: Colors.tertiary }]}>{doneCount}</Text>
          </View>
          <Text style={styles.bentoLabel}>Completed</Text>
          <Text style={styles.bentoSub}>Charts signed</Text>
        </TouchableOpacity>

        {/* Referrals & Bed Capacity Card */}
        <TouchableOpacity
          style={styles.bentoCell}
          onPress={() => Alert.alert('Referral & CHC Capacity', 'Ramnagar CHC: 8 general beds & 2 ICU beds available. 1 ambulance dispatched.')}
          activeOpacity={0.75}
        >
          <View style={styles.bentoCellHead}>
            <View style={[styles.bentoIconBox, { backgroundColor: Colors.surfaceContainerLow }]}>
              <MaterialIcons name="local-hospital" size={18} color={Colors.secondary} />
            </View>
            <Text style={[styles.bentoValue, { color: Colors.secondary }]}>{pendingReferrals}</Text>
          </View>
          <Text style={styles.bentoLabel}>Hospital Referral</Text>
          <Text style={styles.bentoSub}>{pendingReferrals > 0 ? 'Awaiting CHC response' : 'All responded'}</Text>
        </TouchableOpacity>
      </View>

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
        <Card radius={Radii.lg} style={styles.spotlightCard}>
          <View style={styles.spotlightHead}>
            <View style={styles.livePulseDot} />
            <Text style={styles.spotlightTag}>Active Consultation Spotlight</Text>
          </View>
          <View style={styles.spotlightBody}>
            <Avatar
              uri={patientsById[activeConsultation.patientId]?.avatar}
              name={patientsById[activeConsultation.patientId]?.name}
              size={44}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.spotlightName}>{patientsById[activeConsultation.patientId]?.name}</Text>
              <Text style={styles.spotlightReason}>{activeConsultation.reason}</Text>
              <Text style={styles.spotlightMeta}>
                {patientsById[activeConsultation.patientId]?.age}y • {patientsById[activeConsultation.patientId]?.gender} • Blood: {patientsById[activeConsultation.patientId]?.bloodGroup}
              </Text>
            </View>
          </View>
          <Button
            label="Resume Consultation Workbench"
            icon="assignment"
            block
            onPress={() => onStartConsult(activeConsultation.id)}
            style={{ marginTop: 8 }}
          />
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

      {/* Patient Cards List */}
      <View style={styles.queueList}>
        {filteredAppointments.map(appt => {
          const patient = patientsById[appt.patientId];
          if (!patient) return null;

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
                      <Text style={styles.modeTimeText}>{appt.time}</Text>
                    </View>
                  </View>
                  <Text style={styles.patientDemographics}>
                    {patient.age}y / {patient.gender} • {patient.village} • ABHA: {patient.abhaId.slice(0, 7)}...
                  </Text>
                </View>
              </View>

              {/* Chief Complaint Box */}
              <View style={styles.complaintContainer}>
                <Text style={styles.complaintLabel}>Reason for Visit</Text>
                <Text style={styles.complaintText}>{appt.reason}</Text>
              </View>

              {/* AI Triage Findings Strip (Stitch High-Legibility Banner) */}
              {appt.triage && (
                <View style={styles.aiTriageStrip}>
                  <View style={styles.aiTriageHead}>
                    <MaterialIcons name="smart-toy" size={14} color={Colors.primary} />
                    <Text style={styles.aiTriageHeadText}>AI Triage Intake</Text>
                  </View>
                  <Text style={styles.aiTriageSummaryText}>{appt.triage}</Text>
                </View>
              )}

              {/* Patient Allergies Alert if present */}
              {patient.allergies.length > 0 && (
                <View style={styles.allergyAlertBox}>
                  <MaterialIcons name="warning" size={13} color={Colors.error} />
                  <Text style={styles.allergyAlertText}>Allergies: {patient.allergies.join(', ')}</Text>
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

        {filteredAppointments.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <MaterialIcons name="event-available" size={44} color={Colors.outline} />
            <Text style={styles.emptyStateTitle}>No patients in this view</Text>
            <Text style={styles.emptyStateSub}>All appointments for this filter have been attended</Text>
          </View>
        )}
      </View>

      {/* Clinical Tool Shortcuts Bar */}
      <SectionHeader title="Quick Actions & Network Tools" />
      <View style={styles.networkToolsRow}>
        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => onOpenQueue()}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: Colors.primaryLight }]}>
            <MaterialIcons name="people" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.toolTitle}>Patient Registry</Text>
          <Text style={styles.toolSub}>Browse 4 records</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => Alert.alert('108 Emergency Direct', 'Direct priority ambulance hotline: 108\nRamnagar PHC Driver: +91-9431-XXXXXX')}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: Colors.surfaceContainerLow }]}>
            <MaterialIcons name="emergency" size={20} color={Colors.secondary} />
          </View>
          <Text style={styles.toolTitle}>Ambulance 108</Text>
          <Text style={styles.toolSub}>Emergency dispatch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => Alert.alert('PHC Formulary', 'Jan Aushadhi Kendra Ramnagar: 100% vital antibiotics & fever meds in stock.')}
          activeOpacity={0.8}
        >
          <View style={[styles.toolIconWrap, { backgroundColor: Colors.tertiaryContainer }]}>
            <MaterialIcons name="medication" size={20} color={Colors.tertiary} />
          </View>
          <Text style={styles.toolTitle}>Pharmacy Stock</Text>
          <Text style={styles.toolSub}>Jan Aushadhi Live</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
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

  /* Bento Grid */
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bentoCell: {
    width: '48.3%',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    gap: 2,
    ...Shadows.sm,
  },
  bentoCellActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: Colors.primaryLight,
  },
  bentoCellHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bentoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  bentoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  bentoSub: {
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },

  /* Spotlight Card */
  spotlightCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    padding: 14,
    gap: 8,
  },
  spotlightHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  spotlightTag: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  spotlightBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spotlightName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
  },
  spotlightReason: {
    fontSize: 12,
    color: Colors.onSurface,
    fontWeight: '500',
    marginTop: 1,
  },
  spotlightMeta: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
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

  /* Network Tools */
  networkToolsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toolCard: {
    flex: 1,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  toolTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.secondary,
    textAlign: 'center',
  },
  toolSub: {
    fontSize: 9.5,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
});
