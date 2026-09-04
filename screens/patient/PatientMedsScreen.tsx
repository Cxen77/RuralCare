/**
 * Patient Meds Screen
 * Prescriptions, pharmacy matching, QR codes, medicine reservations
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { Card, Button, Chip, SectionHeader } from '../../components/ui';
import type { PharmacyMatchResult } from '../../types/schema';

interface Props {
  onOpenQr: (medName: string, rxCode: string) => void;
}

export const PatientMedsScreen: React.FC<Props> = ({ onOpenQr }) => {
  const { prescriptions, reservations, getPharmacyMatches, getPharmacyMatchesAsync, reserveMedicines, pharmacies } = useCarePlatform();
  const [expandedRxId, setExpandedRxId] = useState<string | null>(null);
  const [pharmacyResults, setPharmacyResults] = useState<{ rxId: string; results: PharmacyMatchResult[] } | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

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
          `You are offline, so this reservation is queued on your device. ${match.pharmacyName} has not held these medicines yet — it is not confirmed.`
        );
        return;
      }
      Alert.alert(
        'Medicines Reserved',
        `Token: ${reservation?.reservationToken}\nPickup at ${match.pharmacyName}\nTotal: ₹${reservation?.totalCost}\nExpires ${new Date(reservation!.expiresAt).toLocaleTimeString()}`
      );
    } catch (e) {
      Alert.alert('Could not reserve', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Prescriptions & Medicines</Text>
      <Text style={styles.subheading}>{prescriptions.length} prescription{prescriptions.length !== 1 ? 's' : ''} on record</Text>

      {prescriptions.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="medication" size={48} color={Colors.outline} />
          <Text style={styles.emptyText}>No prescriptions yet</Text>
          <Text style={styles.emptySubText}>After your doctor consultation, prescriptions will appear here</Text>
        </View>
      )}

      {prescriptions.map(rx => {
        const isExpanded = expandedRxId === rx.id;
        const existingReservation = reservations.find(r => r.prescriptionId === rx.id && r.status === 'reserved');

        return (
          <Card key={rx.id} padding={0} radius={Radii.lg} style={styles.rxCard}>
            {/* Header */}
            <TouchableOpacity style={styles.rxHeader} onPress={() => setExpandedRxId(isExpanded ? null : rx.id)} activeOpacity={0.7}>
              <View style={[styles.rxStatusIcon, rx.dispensingStatus === 'dispensed' ? styles.rxIconDone : rx.dispensingStatus === 'partial' ? styles.rxIconPartial : styles.rxIconPending]}>
                <MaterialIcons
                  name={rx.dispensingStatus === 'dispensed' ? 'check-circle' : rx.dispensingStatus === 'partial' ? 'timelapse' : 'pending'}
                  size={20}
                  color={rx.dispensingStatus === 'dispensed' ? Colors.tertiary : Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rxTitle}>{rx.diagnosis}</Text>
                <Text style={styles.rxSub}>By {rx.doctorName} • {rx.items.length} medicine{rx.items.length > 1 ? 's' : ''}</Text>
                <Text style={styles.rxDate}>Issued {new Date(rx.issuedAt).toLocaleDateString()}</Text>
              </View>
              <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={24} color={Colors.outline} />
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
              <View style={styles.rxBody}>
                {/* Medicine List */}
                {rx.items.map(item => (
                  <View key={item.id} style={styles.medRow}>
                    <View style={styles.medIcon}><MaterialIcons name="medication" size={16} color={Colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medName}>{item.drugName}</Text>
                      <Text style={styles.medDosage}>{item.form} • {item.frequency} • {item.duration}</Text>
                      <Text style={styles.medInstr}>{item.instructions}</Text>
                    </View>
                    <Text style={styles.medQty}>×{item.quantity}</Text>
                  </View>
                ))}

                {/* QR Code */}
                <TouchableOpacity style={styles.qrRow} onPress={() => onOpenQr(rx.items[0]?.drugName || 'Prescription', rx.qrCode)} activeOpacity={0.7}>
                  <MaterialIcons name="qr-code-2" size={24} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qrTitle}>Digital Prescription QR</Text>
                    <Text style={styles.qrCode}>{rx.qrCode}</Text>
                  </View>
                  <MaterialIcons name="open-in-new" size={18} color={Colors.primary} />
                </TouchableOpacity>

                {/* Existing Reservation */}
                {existingReservation && (
                  <View style={styles.reservationBanner}>
                    <MaterialIcons name="check-circle" size={18} color={Colors.tertiary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reservationTitle}>Reserved at {pharmacies.find(p => p.id === existingReservation.pharmacyId)?.name}</Text>
                      <Text style={styles.reservationSub}>Token: {existingReservation.reservationToken} • ₹{existingReservation.totalCost}</Text>
                    </View>
                  </View>
                )}

                {/* Find Pharmacy Button */}
                {!existingReservation && rx.dispensingStatus !== 'dispensed' && (
                  <Button
                    label={matchingLoading ? "Matching live inventories…" : "Smart Pharmacy Matcher"}
                    icon="local-pharmacy"
                    block
                    variant="outline"
                    loading={matchingLoading}
                    disabled={matchingLoading}
                    onPress={() => handleFindPharmacy(rx.id)}
                    style={{ marginTop: 4 }}
                  />
                )}

                {/* Pharmacy Match Results */}
                {pharmacyResults?.rxId === rx.id && (
                  <View style={styles.matchResults}>
                    <Text style={styles.matchHeading}>Pharmacy Options (best match first)</Text>
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
                            <Text style={styles.matchStatLabel}>Total Cost</Text>
                            <Text style={styles.matchStatValue}>₹{match.totalCost}</Text>
                          </View>
                          <View style={styles.matchStat}>
                            <Text style={styles.matchStatLabel}>Completeness</Text>
                            <Text style={[styles.matchStatValue, { color: match.completeness === 1 ? Colors.tertiary : '#D97706' }]}>
                              {Math.round(match.completeness * 100)}%
                            </Text>
                          </View>
                        </View>
                        {match.missingItems.length > 0 && (
                          <Text style={styles.missingText}>Missing: {match.missingItems.join(', ')}</Text>
                        )}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 12, paddingBottom: 24 },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  subheading: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: -8 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.onSurfaceVariant },
  emptySubText: { fontSize: 12, color: Colors.outline, textAlign: 'center' },
  rxCard: { overflow: 'hidden' },
  rxHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rxStatusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rxIconPending: { backgroundColor: Colors.primaryLight },
  rxIconPartial: { backgroundColor: Colors.surfaceContainerLow },
  rxIconDone: { backgroundColor: Colors.tertiaryContainer },
  rxTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  rxSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  rxDate: { fontSize: 10, color: Colors.outline, marginTop: 2 },
  rxBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: Colors.outlineLight, paddingTop: 10 },
  medRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.surfaceContainerLow, padding: 10, borderRadius: Radii.md },
  medIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  medName: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  medDosage: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 1 },
  medInstr: { fontSize: 10, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  medQty: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primaryLight, padding: 10, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.primaryFixedDim },
  qrTitle: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark },
  qrCode: { fontSize: 10, color: Colors.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  reservationBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.tertiaryContainer, padding: 12, borderRadius: Radii.md },
  reservationTitle: { fontSize: 12, fontWeight: '700', color: Colors.onTertiaryContainer },
  reservationSub: { fontSize: 10, color: Colors.tertiary },
  matchResults: { gap: 8, marginTop: 4 },
  matchHeading: { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5 },
  matchCard: { backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight, borderRadius: Radii.md, padding: 12, gap: 8 },
  matchCardBest: { borderColor: Colors.primary, borderWidth: 1.5 },
  matchHeader: { flexDirection: 'row', alignItems: 'center' },
  matchName: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  bestBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.full },
  bestBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  matchMeta: { fontSize: 10, color: Colors.onSurfaceVariant, marginTop: 2 },
  matchStats: { flexDirection: 'row', gap: 12 },
  matchStat: { flex: 1, alignItems: 'center' },
  matchStatLabel: { fontSize: 9, color: Colors.outline, textTransform: 'uppercase', fontWeight: '600' },
  matchStatValue: { fontSize: 14, fontWeight: '800', color: Colors.onSurface, marginTop: 2 },
  missingText: { fontSize: 10, color: Colors.onSurfaceVariant, fontWeight: '600' },
});
