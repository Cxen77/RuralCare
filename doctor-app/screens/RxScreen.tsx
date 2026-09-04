import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Prescription } from '../data/mock';
import { Badge, Button, Card, Divider, SectionHeader } from '../components/ui';

interface RxScreenProps {
  prescriptions: Prescription[];
}

const STATUS_TONE = {
  sent: 'navy',
  partial: 'danger',
  ready: 'success',
} as const;

const STATUS_LABEL = {
  sent: 'Sent to Pharmacy',
  partial: 'Partial Availability',
  ready: 'Ready for Pickup',
} as const;

export const RxScreen: React.FC<RxScreenProps> = ({ prescriptions }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <SectionHeader title="Issued Prescriptions" />

      <View style={{ gap: 12 }}>
        {prescriptions.map(rx => (
          <Card key={rx.id} radius={Radii.lg} style={{ gap: 8 }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.code}>{rx.code}</Text>
                <Text style={styles.patient}>{rx.patientName}</Text>
              </View>
              <Badge label={STATUS_LABEL[rx.pharmacyStatus]} tone={STATUS_TONE[rx.pharmacyStatus]} />
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
                <Text style={styles.pharmacy}>{rx.pharmacyName}</Text>
                <Text style={styles.time}>Issued {rx.createdAt}</Text>
              </View>
              <Button label="QR" icon="qr-code-2" size="sm" variant="outline" onPress={() => {}} />
            </View>
          </Card>
        ))}
        {!prescriptions.length && (
          <Text style={styles.empty}>No prescriptions issued yet. Start a consultation to write one.</Text>
        )}
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
});
