/**
 * Patient Meds Screen
 * Canonical Doctor Rx -> Pharmacy Broadcast -> Stock Confirmation -> Pickup Tracker
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { Card, Button, Chip } from '../../components/ui';
import type { PharmacyMatchResult, Prescription } from '../../types/schema';

interface Props {
  onOpenQr: (medName: string, rxCode: string) => void;
}

export const PatientMedsScreen: React.FC<Props> = ({ onOpenQr }) => {
  const {
    prescriptions,
    reservations,
    getPharmacyMatches,
    getPharmacyMatchesAsync,
    reserveMedicines,
    pharmacies,
    refresh,
  } = useCarePlatform();

  const [expandedRxId, setExpandedRxId] = useState<string | null>(null);
  const [pharmacyResults, setPharmacyResults] = useState<{ rxId: string; results: PharmacyMatchResult[] } | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRxForModal, setSelectedRxForModal] = useState<Prescription | null>(null);

  // Auto-expand the most recent prescription by default
  useEffect(() => {
    if (prescriptions.length > 0 && !expandedRxId) {
      setExpandedRxId(prescriptions[0].id);
    }
  }, [prescriptions]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const handleFindPharmacy = async (rxId: string) => {
    setMatchingLoading(true);
    try {
      const results = await getPharmacyMatchesAsync(rxId);
      setPharmacyResults({ rxId, results });
    } catch {
      const results = getPharmacyMatches(rxId);
      setPharmacyResults({ rxId, results });
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleReserve = async (rxId: string, match: PharmacyMatchResult) => {
    try {
      const { reservation, queued } = await reserveMedicines(rxId, match.pharmacyId, match);
      setPharmacyResults(null);
      if (queued) {
        Alert.alert(
          'Saved offline',
          `You are offline, so this reservation is queued on your device. ${match.pharmacyName} has not held these medicines yet.`
        );
        return;
      }
      Alert.alert(
        'Medicines Reserved',
        `Token: ${reservation?.reservationToken}\nPickup at ${match.pharmacyName}\nTotal: ₹${reservation?.totalCost}\nExpires ${new Date(reservation!.expiresAt).toLocaleTimeString()}`
      );
      await refresh();
    } catch (e) {
      Alert.alert('Could not reserve', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  // Helper to get active tracker stage (1 to 5)
  const getFulfillmentStep = (status: string): { step: number; label: string; color: string; desc: string } => {
    switch (status) {
      case 'dispensed':
        return { step: 5, label: 'Picked Up / Dispensed', color: '#16A34A', desc: 'Prescription fully dispensed. Thank you!' };
      case 'ready_for_pickup':
        return { step: 4, label: 'Ready for Pickup', color: '#059669', desc: 'Medicines packed and ready at pharmacy counter!' };
      case 'preparing':
        return { step: 3, label: 'Preparing Medicines', color: '#0284C7', desc: 'Pharmacist is assembling and packing your items.' };
      case 'confirmed':
        return { step: 2, label: 'Stock Confirmed', color: '#2563EB', desc: 'Pharmacy confirmed inventory & reserved medicines.' };
      case 'sent_to_pharmacy':
        return { step: 1, label: 'Sent to Medical Stores', color: '#D97706', desc: 'Broadcasted to network stores awaiting confirmation.' };
      default:
        return { step: 0, label: 'Doctor Issued', color: '#475569', desc: 'Prescription issued by doctor.' };
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Prescriptions & Meds</Text>
          <Text style={styles.subheading}>{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on record</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
          <MaterialIcons name="refresh" size={20} color={Colors.primary} />
          <Text style={styles.refreshBtnText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {prescriptions.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="medication" size={54} color={Colors.outline} />
          <Text style={styles.emptyText}>No prescriptions yet</Text>
          <Text style={styles.emptySubText}>After your doctor consultation, issued prescriptions and live pharmacy tracking will appear here.</Text>
        </View>
      )}

      {prescriptions.map(rx => {
        const isExpanded = expandedRxId === rx.id;
        const existingReservation = reservations.find(r => r.prescriptionId === rx.id && r.status === 'reserved');
        const token = rx.reservationToken || existingReservation?.reservationToken;
        const stage = getFulfillmentStep(rx.dispensingStatus);
        
        // Match pharmacy details
        const assignedPharma = pharmacies.find(p => p.id === rx.pharmacyId || p.id === existingReservation?.pharmacyId);
        const pharmacyName = rx.pharmacyName || assignedPharma?.name || 'Local RuralCare Pharmacy';
        const pharmacyAddress = assignedPharma?.address || 'Community Health Center Block, Main Road';
        const pharmacyPhone = assignedPharma?.phone || '+91 98765 43210';

        const isReadyOrDone = rx.dispensingStatus === 'ready_for_pickup' || rx.dispensingStatus === 'dispensed';

        return (
          <Card key={rx.id} padding={0} radius={Radii.lg} style={styles.rxCard}>
            {/* Header */}
            <TouchableOpacity
              style={styles.rxHeader}
              onPress={() => setExpandedRxId(isExpanded ? null : rx.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.rxStatusIcon, { backgroundColor: stage.color + '15' }]}>
                <MaterialIcons
                  name={
                    stage.step >= 4 ? 'verified' :
                    stage.step >= 2 ? 'local-pharmacy' :
                    stage.step === 1 ? 'outgoing-mail' : 'description'
                  }
                  size={22}
                  color={stage.color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.rxTitle}>{rx.diagnosis || 'Prescription Order'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: stage.color + '18' }]}>
                    <Text style={[styles.statusBadgeText, { color: stage.color }]}>{stage.label}</Text>
                  </View>
                </View>
                <Text style={styles.rxSub}>Dr. {rx.doctorName} • {rx.items.length} medication{rx.items.length !== 1 ? 's' : ''}</Text>
                <Text style={styles.rxDate}>Issued {new Date(rx.issuedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </View>
              <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={24} color={Colors.outline} />
            </TouchableOpacity>

            {/* FULFILLMENT TRACKER (Always visible or in card) */}
            <View style={styles.trackerContainer}>
              <View style={styles.trackerSteps}>
                {[
                  { label: 'Doctor Issued', step: 0 },
                  { label: 'Sent to Stores', step: 1 },
                  { label: 'Stock Confirmed', step: 2 },
                  { label: 'Preparing', step: 3 },
                  { label: 'Ready for Pickup', step: 4 },
                ].map((s, idx) => {
                  const isComplete = stage.step > s.step || (s.step === 4 && stage.step === 5);
                  const isCurrent = stage.step === s.step;
                  return (
                    <View key={s.step} style={styles.stepItem}>
                      <View style={styles.stepConnectorRow}>
                        {idx > 0 && (
                          <View
                            style={[
                              styles.connectorLine,
                              { backgroundColor: stage.step >= s.step ? Colors.primary : '#E2E8F0' },
                            ]}
                          />
                        )}
                        <View
                          style={[
                            styles.stepCircle,
                            isComplete
                              ? styles.stepCircleDone
                              : isCurrent
                              ? styles.stepCircleCurrent
                              : styles.stepCircleUpcoming,
                          ]}
                        >
                          <MaterialIcons
                            name={isComplete ? 'check' : isCurrent ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={12}
                            color={isComplete || isCurrent ? '#FFFFFF' : '#94A3B8'}
                          />
                        </View>
                        {idx < 4 && (
                          <View
                            style={[
                              styles.connectorLine,
                              { backgroundColor: stage.step > s.step ? Colors.primary : '#E2E8F0' },
                            ]}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepLabel,
                          isCurrent && styles.stepLabelCurrent,
                          isComplete && styles.stepLabelDone,
                        ]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.trackerDesc}>{stage.desc}</Text>
            </View>

            {/* PICKUP BANNER IF READY OR CONFIRMED */}
            {(stage.step >= 2 || token) && (
              <View style={[styles.pickupBanner, isReadyOrDone && styles.pickupBannerReady]}>
                <View style={styles.pickupBannerHeader}>
                  <MaterialIcons
                    name={isReadyOrDone ? 'check-circle' : 'inventory-2'}
                    size={22}
                    color={isReadyOrDone ? '#047857' : '#1D4ED8'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickupBannerTitle, isReadyOrDone && { color: '#065F46' }]}>
                      {isReadyOrDone ? 'MEDICINE READY FOR PICKUP' : 'CONFIRMED PHARMACY RESERVATION'}
                    </Text>
                    <Text style={styles.pickupBannerSubtitle}>
                      {isReadyOrDone
                        ? 'Present this pickup token at the pharmacy counter to collect medicines.'
                        : 'Pharmacy confirmed inventory. Pickup token generated below.'}
                    </Text>
                  </View>
                </View>

                {token && (
                  <View style={styles.tokenCard}>
                    <View>
                      <Text style={styles.tokenCardLabel}>VERIFICATION PICKUP TOKEN</Text>
                      <Text style={styles.tokenCardValue}>{token}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.qrBadgeBtn}
                      onPress={() => onOpenQr(rx.items[0]?.drugName || 'Prescription', token)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="qr-code" size={18} color={Colors.primary} />
                      <Text style={styles.qrBadgeBtnText}>Show QR</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Assigned Pharmacy Details */}
                <View style={styles.pharmacyDetailsBox}>
                  <View style={styles.pharmaDetailRow}>
                    <MaterialIcons name="storefront" size={16} color={Colors.onSurfaceVariant} />
                    <Text style={styles.pharmaDetailName}>{pharmacyName}</Text>
                  </View>
                  <View style={styles.pharmaDetailRow}>
                    <MaterialIcons name="place" size={16} color={Colors.outline} />
                    <Text style={styles.pharmaDetailSub}>{pharmacyAddress}</Text>
                  </View>
                  {pharmacyPhone && (
                    <View style={styles.pharmaDetailRow}>
                      <MaterialIcons name="phone" size={16} color={Colors.outline} />
                      <Text style={styles.pharmaDetailSub}>{pharmacyPhone}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Expanded Body */}
            {isExpanded && (
              <View style={styles.rxBody}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Prescribed Medications ({rx.items.length})</Text>
                  <TouchableOpacity
                    style={styles.viewRxBtn}
                    onPress={() => setSelectedRxForModal(rx)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="visibility" size={14} color={Colors.primary} />
                    <Text style={styles.viewRxBtnText}>Full Digital Rx</Text>
                  </TouchableOpacity>
                </View>

                {/* Medicine Items */}
                {rx.items.map((item, i) => (
                  <View key={item.id || i} style={styles.medRow}>
                    <View style={styles.medIcon}>
                      <MaterialIcons name="medication" size={18} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Text style={styles.medName}>{item.drugName}</Text>
                        <Text style={styles.medQty}>Qty: {item.quantity}</Text>
                      </View>
                      {item.genericName ? <Text style={styles.medGeneric}>({item.genericName})</Text> : null}
                      <Text style={styles.medDosage}>{item.dosage} • {item.form} • {item.frequency} • {item.duration}</Text>
                      {item.instructions ? (
                        <Text style={styles.medInstr}>Instructions: {item.instructions}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}

                {/* Digital Barcode / Verification Row */}
                <TouchableOpacity
                  style={styles.qrRow}
                  onPress={() => onOpenQr(rx.items[0]?.drugName || 'Prescription', rx.qrCode || token || rx.id)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="qr-code-2" size={24} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qrTitle}>Official Prescription QR Verification</Text>
                    <Text style={styles.qrCode}>{rx.qrCode || rx.id}</Text>
                  </View>
                  <MaterialIcons name="open-in-new" size={18} color={Colors.primary} />
                </TouchableOpacity>

                {/* Smart Pharmacy Matcher if not yet routed or reserved */}
                {rx.dispensingStatus === 'pending' && !existingReservation && (
                  <View style={{ marginTop: 8 }}>
                    <Button
                      label={matchingLoading ? 'Matching live inventories…' : 'Find Nearby Medical Stores'}
                      icon="local-pharmacy"
                      block
                      variant="outline"
                      loading={matchingLoading}
                      disabled={matchingLoading}
                      onPress={() => handleFindPharmacy(rx.id)}
                    />
                  </View>
                )}

                {/* Pharmacy Match Results */}
                {pharmacyResults?.rxId === rx.id && (
                  <View style={styles.matchResults}>
                    <Text style={styles.matchHeading}>Pharmacy Matches</Text>
                    {pharmacyResults.results.map((match, idx) => (
                      <View key={match.pharmacyId} style={[styles.matchCard, idx === 0 && styles.matchCardBest]}>
                        <View style={styles.matchHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.matchName}>{match.pharmacyName}</Text>
                              {idx === 0 && <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>Best Match</Text></View>}
                            </View>
                            <Text style={styles.matchMeta}>{match.distanceKm} km away • {match.isJanAushadhi ? 'Jan Aushadhi' : 'Private'}</Text>
                          </View>
                        </View>
                        <View style={styles.matchStats}>
                          <View style={styles.matchStat}>
                            <Text style={styles.matchStatLabel}>Available</Text>
                            <Text style={styles.matchStatValue}>{match.availableItems.length}/{rx.items.length}</Text>
                          </View>
                          <View style={styles.matchStat}>
                            <Text style={styles.matchStatLabel}>Est. Total</Text>
                            <Text style={styles.matchStatValue}>₹{match.totalCost}</Text>
                          </View>
                          <View style={styles.matchStat}>
                            <Text style={styles.matchStatLabel}>Stock</Text>
                            <Text style={[styles.matchStatValue, { color: match.completeness === 1 ? Colors.tertiary : '#D97706' }]}>
                              {Math.round(match.completeness * 100)}%
                            </Text>
                          </View>
                        </View>
                        {match.availableItems.length > 0 && (
                          <Button
                            label={`Reserve at ${(match.pharmacyName || 'Pharmacy').split(' ')[0]}`}
                            icon="bookmark"
                            size="sm"
                            block
                            onPress={() => handleReserve(rx.id, match)}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Card>
        );
      })}

      {/* FULL PRESCRIPTION MODAL */}
      {selectedRxForModal && (
        <Modal
          visible={!!selectedRxForModal}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedRxForModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="receipt-long" size={24} color={Colors.primary} />
                  <Text style={styles.modalTitle}>Official Digital Prescription</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedRxForModal(null)}>
                  <MaterialIcons name="close" size={24} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Clinic / RuralCare branding */}
                <View style={styles.rxSheetHeader}>
                  <Text style={styles.rxSheetClinic}>RURALCARE TELEMEDICINE NETWORK</Text>
                  <Text style={styles.rxSheetSub}>Digital Healthcare & Verification Standard</Text>
                </View>

                {/* Doctor & Patient Info */}
                <View style={styles.rxInfoGrid}>
                  <View style={styles.rxInfoCol}>
                    <Text style={styles.rxInfoLabel}>DOCTOR</Text>
                    <Text style={styles.rxInfoVal}>Dr. {selectedRxForModal.doctorName}</Text>
                    <Text style={styles.rxInfoSub}>Reg ID: {selectedRxForModal.doctorId}</Text>
                  </View>
                  <View style={styles.rxInfoCol}>
                    <Text style={styles.rxInfoLabel}>PATIENT</Text>
                    <Text style={styles.rxInfoVal}>{selectedRxForModal.patientName}</Text>
                    <Text style={styles.rxInfoSub}>ID: {selectedRxForModal.patientId}</Text>
                  </View>
                </View>

                <View style={styles.rxMetaRow}>
                  <Text style={styles.rxMetaItem}>Date: {new Date(selectedRxForModal.issuedAt).toLocaleDateString()}</Text>
                  <Text style={styles.rxMetaItem}>Rx ID: {selectedRxForModal.id}</Text>
                </View>

                <View style={styles.diagnosisBox}>
                  <Text style={styles.diagnosisLabel}>DIAGNOSIS / CLINICAL INDICATION</Text>
                  <Text style={styles.diagnosisVal}>{selectedRxForModal.diagnosis || 'General Consultation'}</Text>
                </View>

                {/* Items */}
                <Text style={styles.rxSheetTableHeading}>PRESCRIBED MEDICINES</Text>
                {selectedRxForModal.items.map((item, idx) => (
                  <View key={item.id || idx} style={styles.modalItemRow}>
                    <View style={styles.itemNumBadge}><Text style={styles.itemNumText}>{idx + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemName}>{item.drugName}</Text>
                      {item.genericName ? <Text style={styles.modalItemGeneric}>Generic: {item.genericName}</Text> : null}
                      <Text style={styles.modalItemDose}>{item.dosage} • {item.form} • {item.frequency} • {item.duration}</Text>
                      {item.instructions ? <Text style={styles.modalItemInstr}>Note: {item.instructions}</Text> : null}
                    </View>
                    <Text style={styles.modalItemQty}>×{item.quantity}</Text>
                  </View>
                ))}

                {/* QR Code Barcode Representation */}
                <View style={styles.barcodeBox}>
                  <MaterialIcons name="qr-code-2" size={48} color={Colors.primary} />
                  <Text style={styles.barcodeText}>CODE: {selectedRxForModal.qrCode || selectedRxForModal.id}</Text>
                  <Text style={styles.barcodeSub}>Tamper-evident verifiable digital prescription</Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  label="Done"
                  block
                  onPress={() => setSelectedRxForModal(null)}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 12, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  subheading: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryLight,
  },
  refreshBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.onSurfaceVariant },
  emptySubText: { fontSize: 12, color: Colors.outline, textAlign: 'center', paddingHorizontal: 24 },
  rxCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  rxHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#FFFFFF' },
  rxStatusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rxTitle: { fontSize: 15, fontWeight: '700', color: Colors.onSurface, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.full },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  rxSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  rxDate: { fontSize: 10, color: Colors.outline, marginTop: 2 },

  // TRACKER
  trackerContainer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  trackerSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { flex: 1, alignItems: 'center' },
  stepConnectorRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  connectorLine: { flex: 1, height: 2 },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: Colors.primary },
  stepCircleCurrent: { backgroundColor: '#2563EB' },
  stepCircleUpcoming: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  stepLabel: { fontSize: 9, color: '#94A3B8', marginTop: 4, textAlign: 'center', fontWeight: '500' },
  stepLabelCurrent: { color: '#1E293B', fontWeight: '800' },
  stepLabelDone: { color: Colors.primary, fontWeight: '600' },
  trackerDesc: { fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 8, fontWeight: '500' },

  // PICKUP BANNER
  pickupBanner: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    padding: 12,
    gap: 10,
  },
  pickupBannerReady: {
    backgroundColor: '#ECFDF5',
    borderBottomColor: '#A7F3D0',
  },
  pickupBannerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pickupBannerTitle: { fontSize: 12, fontWeight: '800', color: '#1E40AF', letterSpacing: 0.5 },
  pickupBannerSubtitle: { fontSize: 11, color: '#334155', marginTop: 2 },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...Shadows.sm,
  },
  tokenCardLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  tokenCardValue: { fontSize: 18, fontWeight: '900', color: Colors.primary, letterSpacing: 1.5, marginTop: 2 },
  qrBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radii.sm,
  },
  qrBadgeBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  pharmacyDetailsBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  pharmaDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pharmaDetailName: { fontSize: 12, fontWeight: '700', color: Colors.onSurface },
  pharmaDetailSub: { fontSize: 11, color: Colors.onSurfaceVariant, flex: 1 },

  // BODY
  rxBody: { padding: 14, gap: 10, backgroundColor: '#FFFFFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.5 },
  viewRxBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewRxBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radii.md,
  },
  medIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  medName: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  medGeneric: { fontSize: 10, color: Colors.outline, fontStyle: 'italic', marginTop: 1 },
  medDosage: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  medInstr: { fontSize: 10, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  medQty: { fontSize: 12, fontWeight: '800', color: Colors.secondary },
  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    padding: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
  },
  qrTitle: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark },
  qrCode: { fontSize: 10, color: Colors.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // MATCH RESULTS
  matchResults: { gap: 8, marginTop: 6 },
  matchHeading: { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  matchCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    borderRadius: Radii.md,
    padding: 12,
    gap: 8,
  },
  matchCardBest: { borderColor: Colors.primary, borderWidth: 1.5 },
  matchHeader: { flexDirection: 'row', alignItems: 'center' },
  matchName: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  bestBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.full },
  bestBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  matchMeta: { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 2 },
  matchStats: { flexDirection: 'row', gap: 12 },
  matchStat: { flex: 1, alignItems: 'center' },
  matchStatLabel: { fontSize: 9, color: Colors.outline, textTransform: 'uppercase', fontWeight: '600' },
  matchStatValue: { fontSize: 13, fontWeight: '800', color: Colors.onSurface, marginTop: 2 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  modalContainer: { backgroundColor: '#FFFFFF', borderRadius: Radii.lg, maxHeight: '88%', overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: Colors.onSurface },
  modalScroll: { padding: 16 },
  rxSheetHeader: { alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rxSheetClinic: { fontSize: 14, fontWeight: '900', color: Colors.primary, letterSpacing: 1 },
  rxSheetSub: { fontSize: 10, color: Colors.outline, marginTop: 2 },
  rxInfoGrid: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rxInfoCol: { flex: 1 },
  rxInfoLabel: { fontSize: 9, fontWeight: '800', color: Colors.outline, letterSpacing: 0.5 },
  rxInfoVal: { fontSize: 13, fontWeight: '800', color: Colors.onSurface, marginTop: 2 },
  rxInfoSub: { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 1 },
  rxMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rxMetaItem: { fontSize: 11, color: Colors.onSurfaceVariant, fontWeight: '600' },
  diagnosisBox: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  diagnosisLabel: { fontSize: 9, fontWeight: '800', color: Colors.outline, letterSpacing: 0.5 },
  diagnosisVal: { fontSize: 13, fontWeight: '700', color: Colors.onSurface, marginTop: 2 },
  rxSheetTableHeading: { fontSize: 11, fontWeight: '800', color: Colors.outline, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemNumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemNumText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  modalItemName: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  modalItemGeneric: { fontSize: 10, color: Colors.outline, fontStyle: 'italic' },
  modalItemDose: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 2 },
  modalItemInstr: { fontSize: 10, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  modalItemQty: { fontSize: 12, fontWeight: '800', color: Colors.secondary },
  barcodeBox: {
    alignItems: 'center',
    padding: 16,
    marginVertical: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  barcodeText: { fontSize: 12, fontWeight: '800', color: Colors.onSurface, letterSpacing: 1, marginTop: 4 },
  barcodeSub: { fontSize: 9, color: Colors.outline, marginTop: 2 },
  modalFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
});
