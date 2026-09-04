import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Button, Chip, IconButton, Input, BottomSheet } from './ui';
import { useCarePlatform } from '../context/CarePlatformContext';

interface BookingModalProps {
  visible: boolean;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  clinicName: string;
  aiTriageSummary?: string;
  aiSymptoms?: string[];
  onClose: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  doctorId,
  doctorName,
  doctorSpecialty,
  clinicName,
  aiTriageSummary,
  aiSymptoms,
  onClose,
}) => {
  const { bookAppointment, patient, isOnline } = useCarePlatform();
  const [selectedDate, setSelectedDate] = useState('Today (Aug 25)');
  const [selectedSlot, setSelectedSlot] = useState('02:00 PM');
  const [consultType, setConsultType] = useState<'clinic' | 'video'>('clinic');
  const [reason, setReason] = useState(aiTriageSummary || '');
  const [submitting, setSubmitting] = useState(false);

  // Sync reason if aiTriageSummary changes
  React.useEffect(() => {
    if (aiTriageSummary) {
      setReason(aiTriageSummary);
    }
  }, [aiTriageSummary]);

  const dates = ['Today (Aug 25)', 'Tomorrow (Aug 26)', 'Wed (Aug 27)'];
  const slots = ['10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM', '06:15 PM'];

  const modeLabel = consultType === 'clinic' ? 'In-Person Clinic Visit' : 'Video Consultation';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const result = await bookAppointment({
        doctorId,
        date: selectedDate,
        time: selectedSlot,
        mode: consultType === 'clinic' ? 'in-person' : 'teleconsultation',
        chiefComplaint: reason.trim() || 'General consultation',
        aiTriageSummary: aiTriageSummary || reason.trim(),
        aiSymptoms: aiSymptoms || (reason ? [reason] : []),
      });
      onClose();
      setTimeout(() => {
        if (result.queued) {
          Alert.alert(
            'Saved offline',
            `You are offline, so this request is queued on your device. It will be sent to ${doctorName} automatically once you are back online. It is not confirmed yet.`
          );
        } else {
          Alert.alert(
            'Appointment Requested',
            `Your ${modeLabel.toLowerCase()} with ${doctorName} on ${selectedDate} at ${selectedSlot} is now in the clinic queue with status "${result.appointment?.status}". Covered under Ayushman PM-JAY.`
          );
        }
      }, 350);
    } catch (e) {
      Alert.alert('Could not book', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={['88%']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Book Appointment</Text>
          <Text style={styles.subtitle}>{doctorName} • {doctorSpecialty}</Text>
          <Text style={styles.clinicText}>{clinicName}</Text>
        </View>
        <IconButton icon="close" size="sm" variant="neutral" onPress={onClose} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.md }}>
        <Text style={styles.sectionLabel}>Consultation Mode</Text>
        <View style={styles.modeRow}>
          <Chip
            label="In-Person Clinic Visit"
            icon="local-hospital"
            selected={consultType === 'clinic'}
            onPress={() => setConsultType('clinic')}
            style={{ flex: 1 }}
          />
          <Chip
            label="Teleconsultation"
            icon="videocam"
            selected={consultType === 'video'}
            onPress={() => setConsultType('video')}
            style={{ flex: 1 }}
          />
        </View>

        <Text style={styles.sectionLabel}>Select Date</Text>
        <View style={styles.dateRow}>
          {dates.map(date => (
            <Chip
              key={date}
              label={date}
              size="sm"
              selected={selectedDate === date}
              onPress={() => setSelectedDate(date)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Select Time Slot</Text>
        <View style={styles.slotGrid}>
          {slots.map(slot => (
            <Chip
              key={slot}
              label={slot}
              selected={selectedSlot === slot}
              onPress={() => setSelectedSlot(slot)}
              style={{ width: '31.5%' }}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Reason for Visit</Text>
        {aiTriageSummary ? (
          <View style={styles.aiTriageBadge}>
            <Text style={styles.aiTriageTitle}>🤖 AI Triage Notes Attached for Doctor:</Text>
            <Text style={styles.aiTriageText}>{aiTriageSummary}</Text>
          </View>
        ) : null}
        <Input
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Abdominal discomfort, fever since 2 days"
          multiline
        />

        <View style={styles.ayushmanBox}>
          <IconButton icon="verified" size="xs" variant="plain" color={Colors.tertiary} />
          <Text style={styles.ayushmanText}>
            Consultation covered 100% under Ayushman Bharat PM-JAY (ABHA: {patient.abhaId}).
            {isOnline ? '' : ' You are offline — this request will be queued until you reconnect.'}
          </Text>
        </View>

        <Button
          label={submitting ? 'Requesting…' : 'Confirm Appointment (₹0)'}
          icon="check-circle"
          block
          loading={submitting}
          disabled={submitting || !doctorId}
          onPress={handleConfirm}
          style={styles.confirmBtn}
        />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.secondary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  clinicText: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ayushmanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.tertiaryContainer,
    padding: 10,
    borderRadius: Radii.md,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#9FF4CD',
  },
  ayushmanText: {
    fontSize: 11,
    color: Colors.onTertiaryContainer,
    flex: 1,
    fontWeight: '500',
  },
  confirmBtn: {
    marginTop: 16,
  },
  aiTriageBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: Radii.md,
    padding: 10,
    marginBottom: 8,
  },
  aiTriageTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 2,
  },
  aiTriageText: {
    fontSize: 11.5,
    color: '#1E3A8A',
    lineHeight: 16,
  },
});
