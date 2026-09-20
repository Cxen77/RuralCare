/**
 * Health Passport Modal Component
 * RuralCare Longitudinal Medical Record System
 *
 * Implements a continuous healthcare record for patients & authorized doctors:
 * - Health Overview (Blood Group, Allergies, Chronic Conditions, Current Medications)
 * - Longitudinal Medical History Timeline (Consultation -> Notes -> Prescriptions -> Follow-up)
 * - Prescriptions History
 * - Diagnostic Reports & Investigations
 * - Hospital Visits & Admissions
 * - Emergency Contacts & Critical Medical Notes
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
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { apiClient } from '../services/apiClient';
import { Button } from './ui';
import type { Patient } from '../types/schema';

interface Props {
  visible: boolean;
  patientId: string;
  patientData?: Partial<Patient>;
  onClose: () => void;
  onEditHealthInfo?: () => void;
}

interface HealthPassportData {
  patient: any;
  overview: {
    bloodGroup?: string | null;
    allergies: string[];
    chronicConditions: string[];
    currentMedications: string[];
    previousConditions: string[];
    emergencyContact?: { name?: string; phone?: string; relation?: string } | null;
    importantNotes?: string | null;
  };
  timeline: Array<{
    id: string;
    type: string;
    date: string;
    title: string;
    doctor: { id?: string; name: string; specialty: string; clinic?: string };
    diagnosis: string;
    clinicalNotes: string;
    vitals?: {
      bloodPressure?: string;
      heartRate?: number;
      temperature?: number;
      spO2?: number;
      weight?: number;
    } | null;
    followUp?: { date: string; notes?: string } | null;
    status: string;
    prescription?: {
      id: string;
      medicinesCount: number;
      items: any[];
      status: string;
    } | null;
    referral?: {
      id: string;
      hospitalName?: string;
      reason?: string;
      urgency?: string;
      status?: string;
      assignedBed?: string;
    } | null;
  }>;
  consultations: any[];
  prescriptions: Array<{
    id: string;
    consultationId?: string;
    date: string;
    doctor: { id?: string; name: string; specialty: string };
    diagnosis: string;
    items: Array<{
      drugName?: string;
      dosage?: string;
      frequency?: string;
      instructions?: string;
      quantity?: number;
    }>;
    dispensingStatus: string;
    pharmacyName?: string;
  }>;
  diagnosticReports: Array<{
    id: string;
    testName: string;
    orderedDate: string;
    hospitalName: string;
    doctorName: string;
    urgency: string;
    status: string;
    notes?: string;
  }>;
  hospitalVisits: Array<{
    id: string;
    hospitalName: string;
    department: string;
    assignedBed?: string;
    reason: string;
    urgency: string;
    status: string;
    admittedDate: string;
    doctorName: string;
  }>;
}

const { height: screenHeight } = Dimensions.get('window');

export const HealthPassportModal: React.FC<Props> = ({
  visible,
  patientId,
  patientData,
  onClose,
  onEditHealthInfo,
}) => {
  const [loading, setLoading] = useState(true);
  const [passportData, setPassportData] = useState<HealthPassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'timeline' | 'prescriptions' | 'reports'>('all');

  const fetchPassport = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getHealthPassport(patientId);
      if (res) {
        setPassportData(res);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load Health Passport. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (visible && patientId) {
      fetchPassport();
    }
  }, [visible, patientId, fetchPassport]);

  if (!visible) return null;

  const patient = passportData?.patient || patientData || {};
  const overview = passportData?.overview || {
    bloodGroup: patient.bloodGroup,
    allergies: patient.allergies || [],
    chronicConditions: patient.chronicConditions || [],
    currentMedications: patient.currentMedications || [],
    previousConditions: patient.previousConditions || [],
    emergencyContact: patient.emergencyContact,
    importantNotes: patient.importantNotes,
  };

  const timeline = passportData?.timeline || [];
  const prescriptions = passportData?.prescriptions || [];
  const diagnosticReports = passportData?.diagnosticReports || [];
  const hospitalVisits = passportData?.hospitalVisits || [];

  const handleCallEmergency = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Number', 'No emergency contact phone registered.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', `Cannot dial ${phone} on this device.`);
    });
  };

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
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleArea}>
              <View style={styles.passportBadge}>
                <MaterialIcons name="verified-user" size={14} color={Colors.primary} />
                <Text style={styles.passportBadgeText}>OFFICIAL HEALTH PASSPORT</Text>
              </View>
              <Text style={styles.patientName}>{patient.name || 'Patient Record'}</Text>
              <Text style={styles.abhaNumber}>
                ABHA ID: {patient.abhaId || '91-XXXX-XXXX-XXXX'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={fetchPassport} activeOpacity={0.7}>
                <MaterialIcons name="refresh" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.7}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Demographics Bar */}
          <View style={styles.demographicsBar}>
            <View style={styles.demoItem}>
              <Text style={styles.demoLabel}>Age / Gender</Text>
              <Text style={styles.demoVal}>{patient.age || '—'} Y / {patient.gender || '—'}</Text>
            </View>
            <View style={styles.demoDivider} />
            <View style={styles.demoItem}>
              <Text style={styles.demoLabel}>Blood Group</Text>
              <Text style={[styles.demoVal, { color: Colors.secondary, fontWeight: '800' }]}>
                {overview.bloodGroup || 'Not added'}
              </Text>
            </View>
            <View style={styles.demoDivider} />
            <View style={styles.demoItem}>
              <Text style={styles.demoLabel}>Location</Text>
              <Text style={styles.demoVal} numberOfLines={1}>
                {patient.village || 'Ramnagar'}, {patient.district || 'Vaishali'}
              </Text>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'timeline' && styles.tabBtnActive]}
              onPress={() => setActiveTab('timeline')}
            >
              <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>
                Timeline ({timeline.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'prescriptions' && styles.tabBtnActive]}
              onPress={() => setActiveTab('prescriptions')}
            >
              <Text style={[styles.tabText, activeTab === 'prescriptions' && styles.tabTextActive]}>
                Prescriptions ({prescriptions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'reports' && styles.tabBtnActive]}
              onPress={() => setActiveTab('reports')}
            >
              <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
                Visits & Tests ({hospitalVisits.length + diagnosticReports.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Accessing longitudinal health record...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={44} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Button label="Retry Loading" variant="outline" onPress={fetchPassport} />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* ── SECTION 1: HEALTH OVERVIEW ─────────────────────── */}
              {(activeTab === 'all' || activeTab === 'timeline') && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWrap}>
                      <MaterialIcons name="health-and-safety" size={20} color={Colors.primary} />
                      <Text style={styles.sectionTitle}>Health Overview</Text>
                    </View>
                    {onEditHealthInfo && (
                      <TouchableOpacity
                        style={styles.editActionBtn}
                        onPress={onEditHealthInfo}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="edit" size={14} color={Colors.primary} />
                        <Text style={styles.editActionText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Blood Group */}
                  <View style={styles.overviewRow}>
                    <Text style={styles.overviewKey}>Blood Group:</Text>
                    <View style={styles.bloodBadge}>
                      <MaterialIcons name="water-drop" size={14} color={Colors.secondary} />
                      <Text style={styles.bloodBadgeText}>
                        {overview.bloodGroup || 'Not added yet'}
                      </Text>
                    </View>
                  </View>

                  {/* Allergies */}
                  <View style={styles.overviewBlock}>
                    <View style={styles.blockLabelRow}>
                      <MaterialIcons name="warning" size={14} color={Colors.error} />
                      <Text style={[styles.overviewKey, { color: Colors.error }]}>
                        Allergies & Adverse Reactions:
                      </Text>
                    </View>
                    {overview.allergies && overview.allergies.length > 0 ? (
                      <View style={styles.pillsWrap}>
                        {overview.allergies.map((allergy, i) => (
                          <View key={i} style={styles.allergyPill}>
                            <Text style={styles.allergyPillText}>{allergy}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyStateSub}>No allergies added</Text>
                    )}
                  </View>

                  {/* Chronic Conditions */}
                  <View style={styles.overviewBlock}>
                    <View style={styles.blockLabelRow}>
                      <MaterialIcons name="healing" size={14} color={Colors.primary} />
                      <Text style={styles.overviewKey}>Chronic Conditions:</Text>
                    </View>
                    {overview.chronicConditions && overview.chronicConditions.length > 0 ? (
                      <View style={styles.pillsWrap}>
                        {overview.chronicConditions.map((cond, i) => (
                          <View key={i} style={styles.conditionPill}>
                            <Text style={styles.conditionPillText}>{cond}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyStateSub}>No chronic conditions added</Text>
                    )}
                  </View>

                  {/* Current Medications */}
                  <View style={styles.overviewBlock}>
                    <View style={styles.blockLabelRow}>
                      <MaterialIcons name="medication" size={14} color={Colors.secondary} />
                      <Text style={[styles.overviewKey, { color: Colors.secondary }]}>
                        Current Medications:
                      </Text>
                    </View>
                    {overview.currentMedications && overview.currentMedications.length > 0 ? (
                      <View style={styles.pillsWrap}>
                        {overview.currentMedications.map((med, i) => (
                          <View key={i} style={styles.medicationPill}>
                            <Text style={styles.medicationPillText}>{med}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyStateSub}>No current medications added</Text>
                    )}
                  </View>

                  {/* Previous Medical Conditions */}
                  <View style={styles.overviewBlock}>
                    <View style={styles.blockLabelRow}>
                      <MaterialIcons name="history" size={14} color={Colors.onSurfaceVariant} />
                      <Text style={styles.overviewKey}>Previous Medical Conditions:</Text>
                    </View>
                    {overview.previousConditions && overview.previousConditions.length > 0 ? (
                      <View style={styles.pillsWrap}>
                        {overview.previousConditions.map((prev, i) => (
                          <View key={i} style={styles.prevPill}>
                            <Text style={styles.prevPillText}>{prev}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyStateSub}>No previous conditions recorded</Text>
                    )}
                  </View>
                </View>
              )}

              {/* ── SECTION 2: LONGITUDINAL MEDICAL HISTORY TIMELINE ─── */}
              {(activeTab === 'all' || activeTab === 'timeline') && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionTitleWrap}>
                    <MaterialIcons name="timeline" size={20} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Longitudinal Care Timeline</Text>
                  </View>
                  <Text style={styles.timelineCaption}>
                    Chronological consultation history, assessments, vitals & doctor notes
                  </Text>

                  {timeline.length > 0 ? (
                    <View style={styles.timelineList}>
                      {timeline.map((event, idx) => (
                        <View key={event.id || idx} style={styles.timelineItem}>
                          {/* Timeline node line */}
                          <View style={styles.timelineLineCol}>
                            <View style={styles.timelineDot}>
                              <MaterialIcons name="medical-services" size={12} color={Colors.white} />
                            </View>
                            {idx < timeline.length - 1 && <View style={styles.timelineConnector} />}
                          </View>

                          {/* Timeline content */}
                          <View style={styles.timelineCard}>
                            <View style={styles.timelineHeader}>
                              <Text style={styles.timelineDate}>{formatDate(event.date)}</Text>
                              <View style={styles.statusChip}>
                                <Text style={styles.statusChipText}>{event.status}</Text>
                              </View>
                            </View>

                            {/* Doctor & Facility */}
                            <Text style={styles.timelineDoctor}>
                              Dr. {event.doctor?.name} ({event.doctor?.specialty})
                            </Text>
                            {event.doctor?.clinic ? (
                              <Text style={styles.timelineFacility}>
                                <MaterialIcons name="location-on" size={12} color={Colors.outline} />{' '}
                                {event.doctor.clinic}
                              </Text>
                            ) : null}

                            {/* Diagnosis */}
                            {event.diagnosis ? (
                              <View style={styles.diagnosisRow}>
                                <Text style={styles.diagnosisLabel}>Diagnosis:</Text>
                                <Text style={styles.diagnosisValue}>{event.diagnosis}</Text>
                              </View>
                            ) : null}

                            {/* Doctor Notes */}
                            {event.clinicalNotes ? (
                              <View style={styles.notesBox}>
                                <Text style={styles.notesTitle}>Doctor's Clinical Notes:</Text>
                                <Text style={styles.notesContent}>{event.clinicalNotes}</Text>
                              </View>
                            ) : null}

                            {/* Vitals Recorded */}
                            {event.vitals && Object.values(event.vitals).some((v) => v != null) && (
                              <View style={styles.vitalsWrap}>
                                {event.vitals.bloodPressure ? (
                                  <View style={styles.vitalBadge}>
                                    <Text style={styles.vitalLabel}>BP</Text>
                                    <Text style={styles.vitalVal}>{event.vitals.bloodPressure}</Text>
                                  </View>
                                ) : null}
                                {event.vitals.heartRate ? (
                                  <View style={styles.vitalBadge}>
                                    <Text style={styles.vitalLabel}>HR</Text>
                                    <Text style={styles.vitalVal}>{event.vitals.heartRate} bpm</Text>
                                  </View>
                                ) : null}
                                {event.vitals.temperature ? (
                                  <View style={styles.vitalBadge}>
                                    <Text style={styles.vitalLabel}>Temp</Text>
                                    <Text style={styles.vitalVal}>{event.vitals.temperature} °F</Text>
                                  </View>
                                ) : null}
                                {event.vitals.spO2 ? (
                                  <View style={styles.vitalBadge}>
                                    <Text style={styles.vitalLabel}>SpO2</Text>
                                    <Text style={styles.vitalVal}>{event.vitals.spO2}%</Text>
                                  </View>
                                ) : null}
                              </View>
                            )}

                            {/* Attached Prescription Preview */}
                            {event.prescription ? (
                              <View style={styles.attachedRxBox}>
                                <MaterialIcons name="receipt" size={14} color={Colors.primary} />
                                <Text style={styles.attachedRxText}>
                                  Prescription issued: {event.prescription.medicinesCount} medicine(s) (Status: {event.prescription.status})
                                </Text>
                              </View>
                            ) : null}

                            {/* Follow-up Note */}
                            {event.followUp?.date ? (
                              <View style={styles.followUpRow}>
                                <MaterialIcons name="event" size={14} color={Colors.primary} />
                                <Text style={styles.followUpText}>
                                  Follow-up: {formatDate(event.followUp.date)}
                                  {event.followUp.notes ? ` — ${event.followUp.notes}` : ''}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyBlock}>
                      <MaterialIcons name="event-busy" size={32} color={Colors.outline} />
                      <Text style={styles.emptyTitle}>No consultations recorded</Text>
                      <Text style={styles.emptySubtitle}>
                        Once you attend a consultation with a RuralCare doctor, your clinical notes and assessment will appear here.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── SECTION 3: PRESCRIPTIONS HISTORY ─────────────────── */}
              {(activeTab === 'all' || activeTab === 'prescriptions') && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionTitleWrap}>
                    <MaterialIcons name="receipt-long" size={20} color={Colors.secondary} />
                    <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
                      Prescriptions History
                    </Text>
                  </View>

                  {prescriptions.length > 0 ? (
                    <View style={{ gap: 10, marginTop: 10 }}>
                      {prescriptions.map((rx, idx) => (
                        <View key={rx.id || idx} style={styles.rxCard}>
                          <View style={styles.rxHeader}>
                            <View>
                              <Text style={styles.rxDoctor}>{rx.doctor?.name || 'Doctor'}</Text>
                              <Text style={styles.rxDate}>{formatDate(rx.date)}</Text>
                            </View>
                            <View style={styles.rxStatusBadge}>
                              <Text style={styles.rxStatusText}>
                                {rx.dispensingStatus ? rx.dispensingStatus.replace(/_/g, ' ') : 'issued'}
                              </Text>
                            </View>
                          </View>

                          {rx.diagnosis ? (
                            <Text style={styles.rxDiag}>Diagnosis: {rx.diagnosis}</Text>
                          ) : null}

                          <View style={styles.medsList}>
                            {rx.items && rx.items.length > 0 ? (
                              rx.items.map((item, mIdx) => (
                                <View key={mIdx} style={styles.medItemRow}>
                                  <MaterialIcons name="circle" size={6} color={Colors.secondary} />
                                  <Text style={styles.medItemName}>
                                    {item.drugName} {item.dosage ? `(${item.dosage})` : ''}
                                  </Text>
                                  {item.frequency ? (
                                    <Text style={styles.medItemFreq}>{item.frequency}</Text>
                                  ) : null}
                                </View>
                              ))
                            ) : (
                              <Text style={styles.emptyStateSub}>No medicine details available</Text>
                            )}
                          </View>

                          {rx.pharmacyName ? (
                            <View style={styles.pharmacyRow}>
                              <MaterialIcons name="local-pharmacy" size={13} color={Colors.primary} />
                              <Text style={styles.pharmacyText}>Pharmacy: {rx.pharmacyName}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyBlock}>
                      <MaterialIcons name="content-paste" size={32} color={Colors.outline} />
                      <Text style={styles.emptyTitle}>No prescriptions available</Text>
                      <Text style={styles.emptySubtitle}>
                        Prescriptions generated by attending doctors will be stored and tracked here.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── SECTION 4: DIAGNOSTIC TESTS & HOSPITAL VISITS ───── */}
              {(activeTab === 'all' || activeTab === 'reports') && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionTitleWrap}>
                    <MaterialIcons name="biotech" size={20} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Diagnostic Tests & Reports</Text>
                  </View>

                  {diagnosticReports.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {diagnosticReports.map((diag) => (
                        <View key={diag.id} style={styles.reportRow}>
                          <View style={styles.reportIconWrap}>
                            <MaterialIcons name="science" size={18} color={Colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.reportName}>{diag.testName}</Text>
                            <Text style={styles.reportHospital}>{diag.hospitalName}</Text>
                            <Text style={styles.reportDate}>Ordered: {formatDate(diag.orderedDate)}</Text>
                          </View>
                          <View style={styles.reportStatusBadge}>
                            <Text style={styles.reportStatusText}>{diag.status}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyBlock}>
                      <MaterialIcons name="analytics" size={32} color={Colors.outline} />
                      <Text style={styles.emptyTitle}>No diagnostic reports available</Text>
                      <Text style={styles.emptySubtitle}>
                        Lab tests, blood panels, and radiology requests will be summarized here.
                      </Text>
                    </View>
                  )}

                  {/* Hospital Visits & Bed Admissions */}
                  <View style={[styles.sectionTitleWrap, { marginTop: 18 }]}>
                    <MaterialIcons name="local-hospital" size={20} color={Colors.error} />
                    <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
                      Hospital Referrals & Admissions
                    </Text>
                  </View>

                  {hospitalVisits.length > 0 ? (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {hospitalVisits.map((visit) => (
                        <View key={visit.id} style={styles.visitCard}>
                          <View style={styles.visitHeader}>
                            <Text style={styles.visitHospital}>{visit.hospitalName}</Text>
                            <View style={styles.urgencyBadge}>
                              <Text style={styles.urgencyText}>{visit.urgency.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={styles.visitReason}>Reason: {visit.reason}</Text>
                          {visit.assignedBed ? (
                            <Text style={styles.visitBed}>
                              Department: {visit.department} • Bed: {visit.assignedBed}
                            </Text>
                          ) : null}
                          <Text style={styles.visitDate}>Date: {formatDate(visit.admittedDate)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyBlock}>
                      <MaterialIcons name="hotel" size={32} color={Colors.outline} />
                      <Text style={styles.emptyTitle}>No hospital visits or admissions</Text>
                      <Text style={styles.emptySubtitle}>
                        Emergency transfers, bed reservations, and hospital referrals will appear here.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── SECTION 5: EMERGENCY & IMPORTANT NOTES ──────────── */}
              {(activeTab === 'all') && (
                <View style={[styles.sectionCard, { borderColor: '#FECACA' }]}>
                  <View style={styles.sectionTitleWrap}>
                    <MaterialIcons name="emergency" size={20} color={Colors.error} />
                    <Text style={[styles.sectionTitle, { color: Colors.error }]}>
                      Emergency & Critical Information
                    </Text>
                  </View>

                  {overview.emergencyContact?.name || overview.emergencyContact?.phone ? (
                    <View style={styles.emergencyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.emergencyName}>
                          {overview.emergencyContact.name}{' '}
                          {overview.emergencyContact.relation ? `(${overview.emergencyContact.relation})` : ''}
                        </Text>
                        <Text style={styles.emergencyPhone}>{overview.emergencyContact.phone}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.callEmergencyBtn}
                        onPress={() => handleCallEmergency(overview.emergencyContact?.phone)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="call" size={16} color={Colors.white} />
                        <Text style={styles.callEmergencyText}>Call</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.emptyRow}>
                      <Text style={styles.emptyStateSub}>No emergency contact registered</Text>
                      {onEditHealthInfo && (
                        <TouchableOpacity onPress={onEditHealthInfo}>
                          <Text style={styles.addLink}>Add Contact</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Important Medical Notes */}
                  {overview.importantNotes ? (
                    <View style={styles.importantNotesBox}>
                      <Text style={styles.importantNotesTitle}>Important Medical Notes:</Text>
                      <Text style={styles.importantNotesText}>{overview.importantNotes}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.emptyStateSub, { marginTop: 6 }]}>
                      No important medical notes added.
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer Close Button */}
          <View style={styles.footer}>
            {onEditHealthInfo && (
              <View style={{ flex: 1 }}>
                <Button
                  label="Edit Health Info"
                  icon="edit"
                  variant="outline"
                  block
                  onPress={onEditHealthInfo}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button label="Close" block onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 28, 36, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    height: Platform.OS === 'web' ? 'auto' : Math.min(screenHeight * 0.92, 820),
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
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  headerTitleArea: {
    flex: 1,
  },
  passportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  passportBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.secondary,
  },
  abhaNumber: {
    fontSize: 11,
    color: Colors.outline,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
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
  demographicsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0F2FE',
  },
  demoItem: {
    flex: 1,
  },
  demoDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#BAE6FD',
    marginHorizontal: 8,
  },
  demoLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  demoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurface,
    marginTop: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
    paddingHorizontal: Spacing.sm,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
  },
  errorContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: 12,
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    ...Shadows.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: '#EFF6FF',
  },
  editActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  overviewKey: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.md,
  },
  bloodBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.secondary,
  },
  overviewBlock: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
    gap: 6,
  },
  blockLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  allergyPill: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  allergyPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.error,
  },
  conditionPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  conditionPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  medicationPill: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  medicationPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
  },
  prevPill: {
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  prevPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  emptyStateSub: {
    fontSize: 12,
    color: Colors.outline,
    fontStyle: 'italic',
  },
  timelineCaption: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginBottom: 12,
    marginTop: 2,
  },
  timelineList: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineLineCol: {
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
  timelineConnector: {
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
    gap: 5,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusChip: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
  },
  timelineDoctor: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  timelineFacility: {
    fontSize: 11,
    color: Colors.outline,
  },
  diagnosisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  diagnosisLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  diagnosisValue: {
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
    marginTop: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  notesContent: {
    fontSize: 11.5,
    color: Colors.onSurface,
    marginTop: 2,
    lineHeight: 16,
  },
  vitalsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  vitalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.outline,
  },
  vitalVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  attachedRxBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    padding: 6,
    borderRadius: Radii.sm,
    marginTop: 4,
  },
  attachedRxText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  followUpText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyBlock: {
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
  emptySubtitle: {
    fontSize: 11,
    color: Colors.outline,
    textAlign: 'center',
    lineHeight: 15,
  },
  rxCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    gap: 6,
  },
  rxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rxDoctor: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  rxDate: {
    fontSize: 10.5,
    color: Colors.outline,
  },
  rxStatusBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  rxStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  rxDiag: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.secondary,
  },
  medsList: {
    gap: 4,
  },
  medItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurface,
    flex: 1,
  },
  medItemFreq: {
    fontSize: 11,
    color: Colors.outline,
  },
  pharmacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pharmacyText: {
    fontSize: 11,
    color: Colors.primary,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
  },
  reportIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  reportHospital: {
    fontSize: 11,
    color: Colors.outline,
  },
  reportDate: {
    fontSize: 10,
    color: Colors.outline,
  },
  reportStatusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  reportStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  visitCard: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radii.md,
    gap: 4,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visitHospital: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  urgencyBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  urgencyText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.error,
  },
  visitReason: {
    fontSize: 11.5,
    color: Colors.onSurface,
  },
  visitBed: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  visitDate: {
    fontSize: 10.5,
    color: Colors.outline,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  emergencyName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  emergencyPhone: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
    marginTop: 2,
  },
  callEmergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.md,
  },
  callEmergencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  addLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  importantNotesBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 8,
    borderRadius: Radii.sm,
    marginTop: 6,
  },
  importantNotesTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
  },
  importantNotesText: {
    fontSize: 11.5,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
    backgroundColor: Colors.surfaceContainerLowest,
  },
});
