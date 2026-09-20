import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Patient, Referral, Urgency } from '../types';
import { Avatar, BottomSheet, Button, CheckboxGroup, Chip, Divider, IconButton, Input } from './ui';

interface ReferralSheetProps {
  visible: boolean;
  onClose: () => void;
  patient: Patient | null;
  onCreate: (referral: Referral) => void;
}

const SPECIALTIES = ['Cardiology', 'Orthopedics', 'Pediatrics', 'Gynecology', 'General Surgery'];
const BEDS = ['General (2 days)', 'ICU', 'Emergency Observation', 'Day Care'];
const DIAGNOSTICS = ['X-ray', 'Ultrasound', 'ECG', 'Echo', 'CT', 'MRI', 'CBC'];

export const ReferralSheet: React.FC<ReferralSheetProps> = ({
  visible,
  onClose,
  patient,
  onCreate,
}) => {
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [beds, setBeds] = useState(BEDS[0]);
  const [diagnostics, setDiagnostics] = useState<string[]>(['X-ray']);
  const [urgency, setUrgency] = useState<Urgency>('routine');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const handleCreate = () => {
    if (!patient || sending) return;
    setSending(true);
    onCreate({
      id: `r${Date.now()}`,
      patientName: patient.name,
      specialty,
      beds,
      diagnostics,
      urgency,
      status: 'pending',
      createdAt: 'Just now',
    });
    onClose();
    setTimeout(() => {
      setSending(false);
      setNotes('');
      Alert.alert(
        'Referral Sent',
        `Referral created for ${patient.name} to ${specialty}. Priority: ${urgency.toUpperCase()}.`,
        [{ text: 'OK', onPress: onClose }]
      );
    }, 300);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={['92%']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Create Referral</Text>
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

      <Text style={styles.sectionLabel}>Specialty Required</Text>
      <View style={styles.chipWrap}>
        {SPECIALTIES.map(s => (
          <Chip key={s} label={s} selected={specialty === s} onPress={() => setSpecialty(s)} size="sm" />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Bed / Facility Need</Text>
      <View style={styles.chipWrap}>
        {BEDS.map(b => (
          <Chip key={b} label={b} selected={beds === b} onPress={() => setBeds(b)} size="sm" icon="bed" />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Diagnostics Required</Text>
      <CheckboxGroup
        options={DIAGNOSTICS.map(d => ({ value: d, label: d }))}
        values={diagnostics}
        onChange={setDiagnostics}
      />

      <Text style={styles.sectionLabel}>Urgency Level</Text>
      <View style={styles.urgencyRow}>
        <TouchableOpacity
          style={[styles.urgencyBtn, urgency === 'routine' && styles.urgencyBtnRoutine]}
          onPress={() => setUrgency('routine')}
          activeOpacity={0.8}
        >
          <Text style={[styles.urgencyText, urgency === 'routine' && styles.urgencyTextActive]}>
            Routine
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.urgencyBtn, urgency === 'priority' && styles.urgencyBtnPriority]}
          onPress={() => setUrgency('priority')}
          activeOpacity={0.8}
        >
          <Text style={[styles.urgencyText, urgency === 'priority' && styles.urgencyTextActive]}>
            Priority
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.urgencyBtn, urgency === 'emergency' && styles.urgencyBtnEmergency]}
          onPress={() => setUrgency('emergency')}
          activeOpacity={0.8}
        >
          <Text style={[styles.urgencyText, urgency === 'emergency' && styles.urgencyTextActive]}>
            Emergency
          </Text>
        </TouchableOpacity>
      </View>

      <Input
        value={notes}
        onChangeText={setNotes}
        placeholder="Clinical summary for receiving hospital (optional)"
        multiline
        style={{ marginTop: 8 }}
      />

      <Divider style={{ marginVertical: 14 }} />

      <Button
        label={sending ? 'Broadcasting to Hospitals…' : 'Send Referral to Hospital Network'}
        icon="travel-explore"
        block
        onPress={handleCreate}
        disabled={!diagnostics.length || sending}
        loading={sending}
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
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  urgencyBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  urgencyBtnRoutine: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  urgencyBtnPriority: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  urgencyBtnEmergency: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  urgencyTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
});
