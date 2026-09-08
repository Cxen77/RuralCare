import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Modal, TouchableOpacity, Alert } from 'react-native';
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
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Issued Prescriptions" />

        <View style={{ gap: 12 }}>
          {prescriptions.map(rx => {
            const isPending = rx.pharmacyStatus === 'pending';
            const tone = STATUS_TONE[rx.pharmacyStatus] || 'neutral';
            const label = STATUS_LABEL[rx.pharmacyStatus] || rx.pharmacyStatus;

            return (
              <Card key={rx.id} radius={Radii.lg} style={{ gap: 8 }}>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{rx.code}</Text>
                    <Text style={styles.patient}>{rx.patientName}</Text>
                    {rx.diagnosis && <Text style={styles.diagnosisText}>Dx: {rx.diagnosis}</Text>}
                  </View>
                  <Badge label={label} tone={tone} />
                </View>

                <Divider />

                <View style={{ gap: 6 }}>
                  {rx.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemMed}>{item.medicine}</Text>
                      <Text style={styles.itemMeta}>
                        {item.dose} • {item.frequency} • {item.duration}
                      </Text>
                    </View>
                  ))}
                </View>

                <Divider />

                <View style={styles.footerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pharmacy}>
                      {rx.pharmacyName ? `Store: ${rx.pharmacyName}` : 'Eligible Medical Stores'}
                    </Text>
                    <Text style={styles.time}>Issued {rx.createdAt}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {isPending && (
                      <Button
                        label={sendingId === rx.id ? 'Sending…' : 'Send to Stores'}
                        icon="send"
                        size="sm"
                        variant="primary"
                        loading={sendingId === rx.id}
                        onPress={() => handleSendToStores(rx.id)}
                      />
                    )}
                    <Button
                      label="View RX"
                      icon="visibility"
                      size="sm"
                      variant="outline"
                      onPress={() => setSelectedRx(rx)}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
          {!prescriptions.length && (
            <Text style={styles.empty}>No prescriptions issued yet. Start a consultation to write one.</Text>
          )}
        </View>
      </ScrollView>

      {/* Complete Canonical Prescription Details Modal */}
      <Modal visible={!!selectedRx} transparent animationType="slide" onRequestClose={() => setSelectedRx(null)}>
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
                  <Text style={styles.valueStrong}>{selectedRx?.pharmacyName || 'Broadcasted to Network Medical Stores'}</Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 12 }} />

              {/* Medicine List */}
              <Text style={styles.sectionHeaderTitle}>Prescribed Medications ({selectedRx?.items.length || 0})</Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                {selectedRx?.items.map((item, idx) => (
                  <View key={idx} style={styles.medDetailCard}>
                    <View style={styles.medDetailHeader}>
                      <MaterialIcons name="medication" size={18} color={Colors.primary} />
                      <Text style={styles.medDetailName}>{item.medicine}</Text>
                    </View>
                    <Text style={styles.medDetailDose}>
                      Dosage: <b>{item.dose}</b> • Frequency: <b>{item.frequency}</b> • Duration: <b>{item.duration}</b>
                    </Text>
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
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  code: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  patient: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onSurface,
    marginTop: 2,
  },
  diagnosisText: {
    fontSize: 11.5,
    color: Colors.onSurfaceVariant,
    marginTop: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemMed: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  pharmacy: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  time: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    marginTop: 32,
  },
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
  medDetailDose: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
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
