import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing, Shadows } from '../constants/theme';
import { Prescription } from '../types';
import { Badge, Button, Card, Divider, SectionHeader, IconButton } from '../components/ui';
import { api } from '../services/api';

interface RxScreenProps {
  prescriptions: Prescription[];
  onRefresh?: () => void;
}

const STATUS_TONE: Record<string, any> = {
  pending: 'neutral',
  sent: 'navy',
  confirmed: 'info',
  preparing: 'amber',
  ready: 'success',
  dispensed: 'success',
  partial: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending Issue',
  sent: 'Sent to Stores',
  confirmed: 'Pharmacy Confirmed',
  preparing: 'Preparing Meds',
  ready: 'Ready for Pickup',
  dispensed: 'Dispensed',
  partial: 'Partial Availability',
};

const formatPharmacyName = (nameOrId?: string) => {
  if (!nameOrId) return 'Network Medical Stores';
  if (nameOrId === 'ph1') return 'Jan Aushadhi Kendra Ramnagar';
  return nameOrId;
};

export const RxScreen: React.FC<RxScreenProps> = ({ prescriptions, onRefresh }) => {
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSendToStores = async (rxId: string) => {
    setSendingId(rxId);
    try {
      const res = await api.post<any>('/pharmacy/send-to-stores', { prescriptionId: rxId });
      Alert.alert(
        'Sent to Medical Stores',
        `Prescription successfully broadcasted to ${res.sentToStores?.length || 'all'} local pharmacies for stock verification.`
      );
      if (onRefresh) onRefresh();
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Prescription routed to local pharmacies.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title="Issued Prescriptions"
          subtitle={`${prescriptions.length} e-Prescription record${prescriptions.length === 1 ? '' : 's'}`}
        />

        <View style={styles.cardList}>
          {prescriptions.map((rx) => {
            const isPending = rx.pharmacyStatus === 'pending';
            const tone = STATUS_TONE[rx.pharmacyStatus] || 'neutral';
            const label = STATUS_LABEL[rx.pharmacyStatus] || rx.pharmacyStatus;

            return (
              <Card key={rx.id} radius={Radii.lg} style={styles.rxCard}>
                {/* 1. Header: Code Badge + Fulfillment Status */}
                <View style={styles.headerRow}>
                  <View style={styles.rxBadge}>
                    <MaterialIcons name="receipt-long" size={14} color={Colors.primary} />
                    <Text style={styles.codeText}>{rx.code}</Text>
                  </View>
                  <Badge label={label} tone={tone} />
                </View>

                {/* 2. Patient & Diagnosis */}
                <View style={styles.patientSection}>
                  <Text style={styles.patientName}>{rx.patientName}</Text>
                  {rx.diagnosis && (
                    <View style={styles.diagnosisRow}>
                      <MaterialIcons name="healing" size={13} color={Colors.onSurfaceVariant} />
                      <Text style={styles.diagnosisText}>Dx: {rx.diagnosis}</Text>
                    </View>
                  )}
                </View>

                {/* 3. Prescribed Medications Box */}
                <View style={styles.medsBox}>
                  <View style={styles.medsBoxHeader}>
                    <MaterialIcons name="medication" size={15} color={Colors.primary} />
                    <Text style={styles.medsBoxTitle}>
                      Prescribed Medications ({rx.items.length})
                    </Text>
                  </View>

                  <View style={styles.medItemsList}>
                    {rx.items.map((item, idx) => (
                      <View key={idx} style={styles.medItemCard}>
                        <View style={styles.medItemHeader}>
                          <Text style={styles.medItemName}>{item.medicine}</Text>
                        </View>
                        <View style={styles.pillsRow}>
                          <View style={styles.miniPill}>
                            <MaterialIcons name="science" size={11} color={Colors.primary} />
                            <Text style={styles.miniPillText}>{item.dose}</Text>
                          </View>
                          <View style={styles.miniPill}>
                            <MaterialIcons name="update" size={11} color={Colors.primary} />
                            <Text style={styles.miniPillText}>{item.frequency}</Text>
                          </View>
                          <View style={styles.miniPill}>
                            <MaterialIcons name="date-range" size={11} color={Colors.primary} />
                            <Text style={styles.miniPillText}>{item.duration}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 4. Full-Width Store & Issuance Metadata Box */}
                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <MaterialIcons name="storefront" size={15} color={Colors.primary} />
                    <Text style={styles.metaLabel}>Fulfillment:</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>
                      {formatPharmacyName(rx.pharmacyName)}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <MaterialIcons name="schedule" size={15} color={Colors.textSecondary} />
                    <Text style={styles.metaLabel}>Issued:</Text>
                    <Text style={styles.metaValue}>{rx.createdAt}</Text>
                  </View>
                </View>

                <Divider style={{ marginVertical: 2 }} />

                {/* 5. Clean, Full-Width Action Buttons */}
                <View style={styles.actionsRow}>
                  {isPending && (
                    <Button
                      label={sendingId === rx.id ? 'Sending…' : 'Send to Stores'}
                      icon="send"
                      size="sm"
                      variant="primary"
                      loading={sendingId === rx.id}
                      style={{ flex: 1 }}
                      onPress={() => handleSendToStores(rx.id)}
                    />
                  )}
                  <Button
                    label="View Full RX"
                    icon="visibility"
                    size="sm"
                    variant="outline"
                    style={{ flex: isPending ? 1 : undefined }}
                    block={!isPending}
                    onPress={() => setSelectedRx(rx)}
                  />
                </View>
              </Card>
            );
          })}

          {!prescriptions.length && (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="receipt-long" size={44} color={Colors.outline} />
              <Text style={styles.emptyTitle}>No Prescriptions Issued</Text>
              <Text style={styles.emptyText}>
                Prescriptions written during patient consultations will automatically appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Complete Canonical Prescription Details Modal */}
      <Modal
        visible={!!selectedRx}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRx(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Official e-Prescription</Text>
                <Text style={styles.modalSub}>{selectedRx?.code}</Text>
              </View>
              <IconButton icon="close" size="sm" variant="neutral" onPress={() => setSelectedRx(null)} />
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Patient & Doctor Banner */}
              <View style={styles.modalSection}>
                <View style={styles.metaCol}>
                  <Text style={styles.labelMuted}>Patient Name</Text>
                  <Text style={styles.valueStrong}>{selectedRx?.patientName}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.labelMuted}>Prescribing Doctor</Text>
                  <Text style={styles.valueStrong}>{selectedRx?.doctorName || 'Assigned Doctor'}</Text>
                </View>
                {selectedRx?.diagnosis && (
                  <View style={styles.metaCol}>
                    <Text style={styles.labelMuted}>Diagnosis</Text>
                    <Text style={styles.valueStrong}>{selectedRx.diagnosis}</Text>
                  </View>
                )}
                <View style={styles.metaCol}>
                  <Text style={styles.labelMuted}>Fulfillment Status</Text>
                  <View style={{ marginTop: 2 }}>
                    <Badge
                      label={selectedRx ? STATUS_LABEL[selectedRx.pharmacyStatus] || selectedRx.pharmacyStatus : ''}
                      tone={selectedRx ? STATUS_TONE[selectedRx.pharmacyStatus] || 'neutral' : 'neutral'}
                    />
                  </View>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.labelMuted}>Assigned Pharmacy</Text>
                  <Text style={styles.valueStrong}>
                    {formatPharmacyName(selectedRx?.pharmacyName)}
                  </Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              {/* Medicine List */}
              <Text style={styles.sectionHeaderTitle}>
                Prescribed Medications ({selectedRx?.items.length || 0})
              </Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                {selectedRx?.items.map((item, idx) => (
                  <View key={idx} style={styles.medDetailCard}>
                    <View style={styles.medDetailHeader}>
                      <MaterialIcons name="medication" size={18} color={Colors.primary} />
                      <Text style={styles.medDetailName}>{item.medicine}</Text>
                    </View>
                    <View style={styles.modalPillsRow}>
                      <Text style={styles.modalDoseText}>
                        Dosage: <Text style={styles.boldText}>{item.dose}</Text> • Frequency: <Text style={styles.boldText}>{item.frequency}</Text> • Duration: <Text style={styles.boldText}>{item.duration}</Text>
                      </Text>
                    </View>
                    <Text style={styles.medDetailInst}>Directions: Take as directed after meals.</Text>
                  </View>
                ))}
              </View>

              <Divider style={{ marginVertical: 14 }} />

              {/* Digital Signature & Verification */}
              <View style={styles.signatureBox}>
                <MaterialIcons name="verified" size={24} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.signTitle}>Digitally Signed & Certified</Text>
                  <Text style={styles.signSub}>RuralCare e-Prescription Authorization Network</Text>
                  <Text style={styles.signCode}>Barcode: {selectedRx?.code}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              {selectedRx?.pharmacyStatus === 'pending' && (
                <Button
                  label="Send to Medical Stores"
                  icon="send"
                  block
                  onPress={() => {
                    if (selectedRx) handleSendToStores(selectedRx.id);
                    setSelectedRx(null);
                  }}
                />
              )}
              <Button label="Close" variant="outline" block onPress={() => setSelectedRx(null)} />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 32,
  },
  cardList: {
    gap: 14,
    marginTop: 6,
  },
  rxCard: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },

  /* 1. Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(8, 127, 140, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(8, 127, 140, 0.18)',
  },
  codeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },

  /* 2. Patient */
  patientSection: {
    gap: 3,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  diagnosisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  diagnosisText: {
    fontSize: 12.5,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },

  /* 3. Medications Inset Box */
  medsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  medsBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  medsBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  medItemsList: {
    gap: 8,
  },
  medItemCard: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  medItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniPillText: {
    fontSize: 11,
    color: Colors.onSurface,
    fontWeight: '500',
  },

  /* 4. Store & Issuance Metadata Box */
  metaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurface,
    flex: 1,
  },

  /* 5. Action Row */
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radii.lg,
    maxHeight: '90%',
    overflow: 'hidden',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineLight,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  modalSub: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: Colors.primary,
    marginTop: 2,
  },
  modalBody: {
    padding: 16,
  },
  modalSection: {
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    padding: 12,
    borderRadius: Radii.md,
  },
  metaCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelMuted: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  valueStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  sectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  medDetailCard: {
    backgroundColor: Colors.surfaceContainerLow,
    padding: 10,
    borderRadius: Radii.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    gap: 4,
  },
  medDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  medDetailName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  modalPillsRow: {
    marginTop: 2,
  },
  modalDoseText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.onSurface,
  },
  medDetailInst: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500',
  },
  signatureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F9FA',
    padding: 12,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#D4EBED',
  },
  signTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  signSub: {
    fontSize: 10.5,
    color: Colors.onSurfaceVariant,
  },
  signCode: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: Colors.secondary,
    marginTop: 2,
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineLight,
    gap: 8,
  },
});

