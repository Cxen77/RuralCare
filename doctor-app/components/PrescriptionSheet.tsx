import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Patient, PrescriptionItem } from '../types';
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
        <View style={{ flex: 1 }}>
          <Input
            value={dose}
            onChangeText={setDose}
            placeholder="Dose (1 tablet)"
            leadingIcon="fitness-center"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            value={duration}
            onChangeText={setDuration}
            placeholder="Duration (5 days)"
            leadingIcon="schedule"
          />
        </View>
      </View>
      <View style={{ height: 8 }} />
      <View style={styles.freqRow}>
        {FREQUENCIES.map(f => {
          const isSelected = frequency === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.freqBtn, isSelected && styles.freqBtnSelected]}
              onPress={() => setFrequency(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.freqText, isSelected && styles.freqTextSelected]}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.addBtn, canAdd ? styles.addBtnActive : styles.addBtnDisabled]}
        onPress={addItem}
        disabled={!canAdd}
        activeOpacity={0.85}
      >
        <MaterialIcons
          name="add-circle"
          size={18}
          color={canAdd ? Colors.primary : '#94A3B8'}
        />
        <Text style={[styles.addBtnText, canAdd ? styles.addBtnTextActive : styles.addBtnTextDisabled]}>
          Add Medicine to List
        </Text>
      </TouchableOpacity>

      {!!items.length && (
        <>
          <Divider style={{ marginVertical: 14 }} />
          <Text style={styles.sectionLabel}>{items.length} Medicine(s) Added</Text>
          <View style={{ gap: 8 }}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.rxItem}>
                <View style={styles.rxIconBox}>
                  <MaterialIcons name="medication" size={18} color={Colors.primary} />
                </View>
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
      <View style={styles.pharmacyList}>
        {PHARMACIES.map(p => {
          const isSelected = pharmacy === p;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.pharmacyCard, isSelected && styles.pharmacyCardSelected]}
              onPress={() => setPharmacy(p)}
              activeOpacity={0.85}
            >
              <View style={styles.pharmacyCardLeft}>
                <View style={[styles.pharmacyIconWrap, isSelected && styles.pharmacyIconWrapSelected]}>
                  <MaterialIcons
                    name="local-pharmacy"
                    size={18}
                    color={isSelected ? Colors.primary : '#64748B'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pharmacyName, isSelected && styles.pharmacyNameSelected]}>
                    {p}
                  </Text>
                  <Text style={styles.pharmacySub}>
                    {p.includes('PHC') ? 'On-site facility pharmacy • Immediate fulfillment' : 'Partner community pharmacy • Prescription dispatch'}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                size={20}
                color={isSelected ? Colors.primary : '#CBD5E1'}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.issueBtn, items.length > 0 ? styles.issueBtnActive : styles.issueBtnDisabled]}
        onPress={handleIssue}
        disabled={!items.length}
        activeOpacity={0.85}
      >
        <MaterialIcons
          name="check-circle"
          size={19}
          color={items.length > 0 ? Colors.white : '#94A3B8'}
        />
        <Text style={[styles.issueBtnText, items.length > 0 ? styles.issueBtnTextActive : styles.issueBtnTextDisabled]}>
          {items.length > 0
            ? `Issue & Sign Prescription (${items.length})`
            : 'Add a medicine to issue prescription'}
        </Text>
      </TouchableOpacity>
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
    fontSize: 18,
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
  freqRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  freqBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  freqBtnSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  freqText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  freqTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: Radii.md,
    marginTop: 10,
  },
  addBtnActive: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  addBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addBtnTextActive: {
    color: Colors.primary,
  },
  addBtnTextDisabled: {
    color: '#94A3B8',
  },
  rxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  rxIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
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
  pharmacyList: {
    gap: 8,
    marginVertical: 4,
  },
  pharmacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: Radii.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  pharmacyCardSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: Colors.primary,
  },
  pharmacyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pharmacyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pharmacyIconWrapSelected: {
    backgroundColor: '#E6F4F1',
  },
  pharmacyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  pharmacyNameSelected: {
    fontWeight: '700',
    color: Colors.primary,
  },
  pharmacySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  issueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radii.md,
    marginTop: 18,
    marginBottom: 8,
  },
  issueBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  issueBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  issueBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  issueBtnTextActive: {
    color: Colors.white,
  },
  issueBtnTextDisabled: {
    color: '#94A3B8',
  },
});
