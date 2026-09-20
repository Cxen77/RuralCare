/**
 * Doctor App - DoctorHealthPassportModal Component
 * Provides authorized doctors with longitudinal healthcare history:
 * - Previous consultations & diagnoses
 * - Clinical notes & recorded vitals
 * - Allergies, chronic conditions & current medications
 * - Previous prescriptions & dispensing status
 * - Diagnostic reports & hospital admissions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { api } from '../services/api';

interface Props {
  visible: boolean;
  patientId: string;
  patientName?: string;
  onClose: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export const DoctorHealthPassportModal: React.FC<Props> = ({
  visible,
  patientId,
  patientName,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'overview' | 'prescriptions' | 'reports'>('timeline');

  const fetchHealthPassport = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<any>(`/patients/${patientId}/health-passport`);
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Unable to access patient health passport.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (visible && patientId) {
      fetchHealthPassport();
    }
  }, [visible, patientId, fetchHealthPassport]);

  if (!visible) return null;

  const patient = data?.patient || {};
  const overview = data?.overview || {
    bloodGroup: patient.bloodGroup,
    allergies: patient.allergies || [],
    chronicConditions: patient.chronicConditions || [],
    currentMedications: patient.currentMedications || [],
    previousConditions: patient.previousConditions || [],
    emergencyContact: patient.emergencyContact,
    importantNotes: patient.importantNotes,
  };
  const timeline = data?.timeline || [];
  const prescriptions = data?.prescriptions || [];
  const diagnosticReports = data?.diagnosticReports || [];
  const hospitalVisits = data?.hospitalVisits || [];

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <MaterialIcons name="security" size={14} color="#16A34A" />
                <Text style={styles.badgeText}>AUTHORIZED CLINICAL RECORD</Text>
              </View>
              <Text style={styles.title}>{patient.name || patientName || 'Patient Medical Record'}</Text>
              <Text style={styles.subtitle}>
                ABHA: {patient.abhaId || 'Verified'} • {patient.age || '—'}Y • {patient.gender || '—'}
              </Text>
            </View>
            <View style={styles.headerBtns}>
              <TouchableOpacity style={styles.iconBtn} onPress={fetchHealthPassport}>
                <MaterialIcons name="refresh" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Critical Alerts Bar */}
          <View style={styles.criticalBar}>
            <View style={styles.critItem}>
              <Text style={styles.critLabel}>Blood Group</Text>
              <Text style={[styles.critVal, { color: Colors.secondary, fontWeight: '800' }]}>
                {overview.bloodGroup || 'Not added'}
              </Text>
            </View>
            <View style={styles.critDivider} />
            <View style={[styles.critItem, { flex: 2 }]}>
              <Text style={styles.critLabel}>Allergies</Text>
              <Text
                style={[
                  styles.critVal,
                  { color: overview.allergies?.length ? Colors.error : Colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {overview.allergies?.length ? overview.allergies.join(', ') : 'None reported'}
              </Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'timeline' && styles.tabActive]}
              onPress={() => setActiveTab('timeline')}
            >
              <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>
                Timeline ({timeline.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
                Health Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'prescriptions' && styles.tabActive]}
              onPress={() => setActiveTab('prescriptions')}
            >
              <Text style={[styles.tabText, activeTab === 'prescriptions' && styles.tabTextActive]}>
                Rx History ({prescriptions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
              onPress={() => setActiveTab('reports')}
            >
              <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
                Reports & Visits ({diagnosticReports.length + hospitalVisits.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.centerText}>Accessing patient longitudinal record...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <MaterialIcons name="error-outline" size={44} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchHealthPassport}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* ── TIMELINE TAB ── */}
              {activeTab === 'timeline' && (
                <View style={{ gap: 12 }}>
                  <Text style={styles.sectionHeader}>Chronological Care History</Text>
                  {timeline.length > 0 ? (
                    timeline.map((event: any, idx: number) => (
                      <View key={event.id || idx} style={styles.timelineItem}>
                        <View style={styles.timelineDotCol}>
                          <View style={styles.timelineDot}>
                            <MaterialIcons name="stethoscope" size={12} color={Colors.white} />
                          </View>
                          {idx < timeline.length - 1 && <View style={styles.timelineLine} />}
                        </View>

                        <View style={styles.timelineCard}>
                          <View style={styles.timelineCardHeader}>
                            <Text style={styles.timelineDate}>{formatDate(event.date)}</Text>
                            <Text style={styles.timelineDoctor}>Dr. {event.doctor?.name}</Text>
                          </View>

                          {event.diagnosis ? (
                            <View style={styles.diagRow}>
                              <Text style={styles.diagLabel}>Diagnosis:</Text>
                              <Text style={styles.diagVal}>{event.diagnosis}</Text>
                            </View>
                          ) : null}

                          {event.clinicalNotes ? (
                            <View style={styles.notesBox}>
                              <Text style={styles.notesLabel}>Assessment & Notes:</Text>
                              <Text style={styles.notesVal}>{event.clinicalNotes}</Text>
                            </View>
                          ) : null}

                          {/* Recorded Vitals */}
                          {event.vitals && (
                            <View style={styles.vitalsRow}>
                              {event.vitals.bloodPressure ? (
                                <Text style={styles.vitalPill}>BP: {event.vitals.bloodPressure}</Text>
                              ) : null}
                              {event.vitals.heartRate ? (
                                <Text style={styles.vitalPill}>HR: {event.vitals.heartRate} bpm</Text>
                              ) : null}
                              {event.vitals.temperature ? (
                                <Text style={styles.vitalPill}>Temp: {event.vitals.temperature} °F</Text>
                              ) : null}
                              {event.vitals.spO2 ? (
                                <Text style={styles.vitalPill}>SpO2: {event.vitals.spO2}%</Text>
                              ) : null}
                            </View>
                          )}

                          {event.prescription && (
                            <Text style={styles.rxNote}>
                              Prescribed {event.prescription.medicinesCount} medication(s) • Status: {event.prescription.status}
                            </Text>
                          )}

                          {event.followUp?.date && (
                            <Text style={styles.followUpNote}>
                              Follow-up: {formatDate(event.followUp.date)} ({event.followUp.notes || 'Routine check'})
                            </Text>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <MaterialIcons name="event-note" size={36} color={Colors.outline} />
                      <Text style={styles.emptyTitle}>No prior consultations on record</Text>
                      <Text style={styles.emptySub}>
                        Future consultations with diagnoses and notes will be preserved here.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <View style={{ gap: 12 }}>
                  <View style={styles.overviewBox}>
                    <Text style={styles.overviewBoxTitle}>Baseline Medical Conditions</Text>
                    
                    <View style={styles.dataGroup}>
                      <Text style={styles.dataKey}>Chronic Conditions:</Text>
                      {overview.chronicConditions?.length ? (
                        <View style={styles.chipsWrap}>
                          {overview.chronicConditions.map((c: string, i: number) => (
                            <View key={i} style={styles.conditionChip}>
                              <Text style={styles.conditionChipText}>{c}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.emptySub}>No chronic conditions recorded</Text>
                      )}
                    </View>

                    <View style={styles.dataGroup}>
                      <Text style={styles.dataKey}>Current Medications:</Text>
                      {overview.currentMedications?.length ? (
                        <View style={styles.chipsWrap}>
                          {overview.currentMedications.map((m: string, i: number) => (
                            <View key={i} style={styles.medChip}>
                              <Text style={styles.medChipText}>{m}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.emptySub}>No current medications recorded</Text>
                      )}
                    </View>

                    <View style={styles.dataGroup}>
                      <Text style={styles.dataKey}>Previous Medical Conditions:</Text>
                      {overview.previousConditions?.length ? (
                        <View style={styles.chipsWrap}>
                          {overview.previousConditions.map((p: string, i: number) => (
                            <View key={i} style={styles.prevChip}>
                              <Text style={styles.prevChipText}>{p}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.emptySub}>No previous conditions recorded</Text>
                      )}
                    </View>

                    {overview.importantNotes ? (
                      <View style={styles.importantAlert}>
                        <Text style={styles.importantAlertTitle}>Important Medical Notes:</Text>
                        <Text style={styles.importantAlertText}>{overview.importantNotes}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Emergency Information */}
                  <View style={styles.overviewBox}>
                    <Text style={styles.overviewBoxTitle}>Emergency Information</Text>
                    {overview.emergencyContact?.name ? (
                      <View style={{ gap: 2, marginTop: 4 }}>
                        <Text style={styles.dataVal}>
                          Contact: {overview.emergencyContact.name}{' '}
                          {overview.emergencyContact.relation ? `(${overview.emergencyContact.relation})` : ''}
                        </Text>
                        <Text style={[styles.dataVal, { color: Colors.error, fontWeight: '700' }]}>
                          Phone: {overview.emergencyContact.phone || 'Not provided'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.emptySub}>No emergency contact added</Text>
                    )}
                  </View>
                </View>
              )}

              {/* ── PRESCRIPTIONS TAB ── */}
              {activeTab === 'prescriptions' && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.sectionHeader}>Prescriptions History</Text>
                  {prescriptions.length > 0 ? (
                    prescriptions.map((rx: any) => (
                      <View key={rx.id} style={styles.rxCard}>
                        <View style={styles.rxCardHeader}>
                          <View>
                            <Text style={styles.rxDoc}>Dr. {rx.doctor?.name}</Text>
                            <Text style={styles.rxDate}>{formatDate(rx.date)}</Text>
                          </View>
                          <View style={styles.rxStatusBadge}>
                            <Text style={styles.rxStatusText}>
                              {rx.dispensingStatus ? rx.dispensingStatus.replace(/_/g, ' ') : 'Issued'}
                            </Text>
                          </View>
                        </View>

                        {rx.diagnosis ? (
                          <Text style={styles.rxDiag}>Diagnosis: {rx.diagnosis}</Text>
                        ) : null}

                        <View style={{ gap: 4, marginTop: 4 }}>
                          {rx.items?.map((item: any, idx: number) => (
                            <View key={idx} style={styles.rxItemRow}>
                              <MaterialIcons name="medication" size={14} color={Colors.primary} />
                              <Text style={styles.rxItemName}>
                                {item.drugName} {item.dosage ? `(${item.dosage})` : ''}
                              </Text>
                              {item.frequency ? (
                                <Text style={styles.rxItemFreq}>{item.frequency}</Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <MaterialIcons name="receipt" size={36} color={Colors.outline} />
                      <Text style={styles.emptyTitle}>No prescriptions on record</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── REPORTS & VISITS TAB ── */}
              {activeTab === 'reports' && (
                <View style={{ gap: 12 }}>
                  <Text style={styles.sectionHeader}>Diagnostic Tests & Lab Reports</Text>
                  {diagnosticReports.length > 0 ? (
                    diagnosticReports.map((r: any) => (
                      <View key={r.id} style={styles.reportRow}>
                        <MaterialIcons name="science" size={20} color={Colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reportName}>{r.testName}</Text>
                          <Text style={styles.reportFacility}>{r.hospitalName} • {formatDate(r.orderedDate)}</Text>
                        </View>
                        <Text style={styles.reportStatus}>{r.status}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySub}>No diagnostic reports on record</Text>
                  )}

                  <Text style={[styles.sectionHeader, { marginTop: 12 }]}>Hospital Admissions & Referrals</Text>
                  {hospitalVisits.length > 0 ? (
                    hospitalVisits.map((v: any) => (
                      <View key={v.id} style={styles.visitRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.visitHospital}>{v.hospitalName}</Text>
                          <Text style={styles.visitReason}>Reason: {v.reason}</Text>
                          {v.assignedBed ? (
                            <Text style={styles.visitBed}>Department: {v.department} • Bed: {v.assignedBed}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.visitDate}>{formatDate(v.admittedDate)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptySub}>No hospital visits or admissions on record</Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Close button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 28, 36, 0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    height: Platform.OS === 'web' ? 'auto' : Math.min(screenHeight * 0.9, 820),
    maxHeight: Platform.OS === 'web' ? '95%' : undefined,
    width: '100%',
    ...Shadows.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.secondary,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criticalBar: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  critItem: {
    flex: 1,
  },
  critDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#BFDBFE',
    marginHorizontal: 8,
  },
  critLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  critVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.white,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centerText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineDotCol: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    gap: 4,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  timelineDoctor: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  diagLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  diagVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.secondary,
  },
  notesBox: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    marginTop: 2,
  },
  notesLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  notesVal: {
    fontSize: 11.5,
    color: Colors.onSurface,
    marginTop: 2,
    lineHeight: 16,
  },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  vitalPill: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  rxNote: {
    fontSize: 10.5,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  followUpNote: {
    fontSize: 10.5,
    color: '#047857',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  emptySub: {
    fontSize: 11,
    color: Colors.outline,
    fontStyle: 'italic',
  },
  overviewBox: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    gap: 8,
  },
  overviewBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
    paddingBottom: 4,
  },
  dataGroup: {
    gap: 4,
  },
  dataKey: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  dataVal: {
    fontSize: 12,
    color: Colors.onSurface,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  conditionChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  conditionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  medChip: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  medChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  prevChip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  prevChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  importantAlert: {
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  importantAlertTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  importantAlertText: {
    fontSize: 11.5,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  rxCard: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    gap: 4,
  },
  rxCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rxDoc: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  rxDate: {
    fontSize: 10,
    color: Colors.outline,
  },
  rxStatusBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  rxStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  rxDiag: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.secondary,
  },
  rxItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rxItemName: {
    fontSize: 11.5,
    color: Colors.onSurface,
    fontWeight: '600',
    flex: 1,
  },
  rxItemFreq: {
    fontSize: 10.5,
    color: Colors.outline,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.sm,
  },
  reportName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  reportFacility: {
    fontSize: 10.5,
    color: Colors.outline,
  },
  reportStatus: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  visitRow: {
    padding: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.sm,
    gap: 2,
  },
  visitHospital: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  visitReason: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  visitBed: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.primary,
  },
  visitDate: {
    fontSize: 10,
    color: Colors.outline,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
  },
  closeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
});
