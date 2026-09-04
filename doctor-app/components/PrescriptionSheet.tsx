import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Patient, PrescriptionItem } from '../data/mock';
import { Avatar, BottomSheet, Button, Chip, Divider, IconButton, Input } from './ui';

interface PrescriptionSheetProps {
  visible: boolean;
  onClose: () => void;
  patient: Patient | null;
  onIssue: (items: PrescriptionItem[], pharmacy: string) => void;
}

const PHARMACIES = ['Ramnagar PHC Pharmacy', 'Gramin Seva Medicals', 'City Pharmacy'];
const FREQUENCIES = ['Once daily', 'Twice daily', 'TDS', 'SOS'];

export const PrescriptionSheet: React.FC<PrescriptionSheetProps> = ({
  visible,
  onClose,
  patient,
  onIssue,
}) => {
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [medicine, setMedicine] = useState('');
  const [dose, setDose] = useState('1 tablet');
  const [frequency, setFrequency] = useState(FREQUENCIES[1]);
  const [duration, setDuration] = useState('');
  const [pharmacy, setPharmacy] = useState(PHARMACIES[0]);

  const canAdd = medicine.trim().length > 1 && duration.trim().length > 0;

  const addItem = () => {
    if (!canAdd) return;
    setItems(prev => [
      ...prev,
      { medicine: medicine.trim(), dose: dose.trim(), frequency, duration: duration.trim() },
    ]);
    setMedicine('');
    setDuration('');
    setFrequency(FREQUENCIES[1]);
  };

  const handleIssue = () => {
    if (!items.length) {
      Alert.alert('Empty Prescription', 'Add at least one medicine before issuing.');
      return;
    }
    onIssue(items, pharmacy);
    setItems([]);
    setMedicine('');
    setDuration('');
    onClose();
    Alert.alert(
      'Prescription Issued',
      `Rx with ${items.length} item(s) sent to ${pharmacy}. Generated and signed digitally.`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={['92%']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Write Prescription</Text>
          {patient && (
            <View style={styles.patientRow}>
              <Avatar uri={patient.avatar} name={patient.name} size={28} />
              <Text style={styles.patientName}>{patient.name}</Text>
              <Text style={styles.patientMeta}>{patient.age}Y • {patient.bloodGroup}</Text>
            </View>
          )}
        </View>
        <IconButton icon="close" size="sm" variant="neutral" onPress={onClose} />
      </View>

      <Text style={styles.sectionLabel}>Add Medicine</Text>
      <Input
        value={medicine}
        onChangeText={setMedicine}
        placeholder="Medicine name & strength (e.g. Amoxicillin 500mg)"
        leadingIcon="medication"
      />
      <View style={{ height: 8 }} />
      <View style={styles.rowTwo}>
        <Input value={dose} onChangeText={setDose} placeholder="Dose (1 tablet)" />
        <Input value={duration} onChangeText={setDuration} placeholder="Duration (5 days)" />
      </View>
      <View style={{ height: 8 }} />
      <View style={styles.chipWrap}>
        {FREQUENCIES.map(f => (
          <Chip key={f} label={f} size="sm" selected={frequency === f} onPress={() => setFrequency(f)} />
        ))}
      </View>
      <Button label="Add to Prescription" icon="add" variant="soft" block onPress={addItem} disabled={!canAdd} style={{ marginTop: 10 }} />

      {!!items.length && (
        <>
          <Divider style={{ marginVertical: 14 }} />
          <Text style={styles.sectionLabel}>{items.length} Medicine(s) Added</Text>
          <View style={{ gap: 8 }}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.rxItem}>
                <MaterialIcons name="medication" size={16} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rxMed}>{item.medicine}</Text>
                  <Text style={styles.rxMeta}>{item.dose} • {item.frequency} • {item.duration}</Text>
                </View>
                <IconButton
                  icon="delete-outline"
                  size="xs"
                  variant="dangerSoft"
                  onPress={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                />
              </View>
            ))}
          </View>
        </>
      )}

      <Divider style={{ marginVertical: 14 }} />
      <Text style={styles.sectionLabel}>Send To Pharmacy</Text>
      <View style={styles.chipWrap}>
        {PHARMACIES.map(p => (
          <Chip
            key={p}
            label={p}
            icon="storefront"
            selected={pharmacy === p}
            onPress={() => setPharmacy(p)}
          />
        ))}
      </View>

      <Button
        label={`Issue Prescription (${items.length})`}
        icon="check-circle"
        block
        onPress={handleIssue}
        disabled={!items.length}
        style={{ marginTop: 16 }}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 8,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patientName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  patientMeta: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  rxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    padding: 10,
  },
  rxMed: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  rxMeta: {
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
});
