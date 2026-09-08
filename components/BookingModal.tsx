import React, { useState, useEffect, useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing } from '../constants/theme';
import { Button, Chip, IconButton, Input, BottomSheet, Spinner } from './ui';
import { useCarePlatform } from '../context/CarePlatformContext';
import { apiClient, ApiError } from '../services/apiClient';

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

interface AvailabilityDate {
  date: string;
  label: string;
  availableSlots: string[];
}

const getFallbackDates = (): AvailabilityDate[] => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const list: AvailabilityDate[] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    let label = '';
    if (i === 0) label = `Today (${months[d.getMonth()]} ${d.getDate()})`;
    else if (i === 1) label = `Tomorrow (${months[d.getMonth()]} ${d.getDate()})`;
    else label = `${days[d.getDay()]} (${months[d.getMonth()]} ${d.getDate()})`;

    list.push({
      date: dateStr,
      label,
      availableSlots: ['09:30 AM', '10:15 AM', '11:00 AM', '11:45 AM', '02:00 PM', '02:45 PM', '03:30 PM', '04:15 PM'],
    });
  }
  return list;
};

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
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availableDates, setAvailableDates] = useState<AvailabilityDate[]>(getFallbackDates);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [consultType, setConsultType] = useState<'clinic' | 'video'>('clinic');
  const [consultationFee, setConsultationFee] = useState<number>(0);
  const [teleconsultationAvailable, setTeleconsultationAvailable] = useState(true);
  const [reason, setReason] = useState(aiTriageSummary || '');
  const [submitting, setSubmitting] = useState(false);

  // Sync reason if aiTriageSummary changes
  useEffect(() => {
    if (aiTriageSummary) {
      setReason(aiTriageSummary);
    }
  }, [aiTriageSummary]);

  const loadAvailability = useCallback(async () => {
    if (!doctorId) return;
    setLoadingAvailability(true);
    try {
      const res = await apiClient.getDoctorAvailability(doctorId);
      if (res?.dates && Array.isArray(res.dates) && res.dates.length > 0) {
        setAvailableDates(res.dates);
        setConsultationFee(res.consultationFee ?? 0);
        setTeleconsultationAvailable(!!res.teleconsultation);

        if (!res.teleconsultation && consultType === 'video') {
          setConsultType('clinic');
        }

        // Select the first date that has available slots, or fallback to the first date
        const firstWithSlots = res.dates.find((d: any) => d.availableSlots && d.availableSlots.length > 0) || res.dates[0];
        if (firstWithSlots) {
          setSelectedDate(firstWithSlots.date);
          setSelectedSlot(firstWithSlots.availableSlots?.[0] || '');
        }
      }
    } catch (err) {
      console.log('[BookingModal] using fallback availability:', err);
      const fallback = getFallbackDates();
      setAvailableDates(fallback);
      setSelectedDate(fallback[0].date);
      setSelectedSlot(fallback[0].availableSlots[0]);
    } finally {
      setLoadingAvailability(false);
    }
  }, [doctorId, consultType]);

  useEffect(() => {
    if (visible && doctorId) {
      loadAvailability();
    }
  }, [visible, doctorId, loadAvailability]);

  // Current active date object
  const currentDateObj = availableDates.find(d => d.date === selectedDate) || availableDates[0];
  const activeSlots = currentDateObj?.availableSlots || [];

  // When date changes, update slot if previously selected slot is not in the new date's slots
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const dateObj = availableDates.find(d => d.date === dateStr);
    if (dateObj?.availableSlots && dateObj.availableSlots.length > 0) {
      if (!dateObj.availableSlots.includes(selectedSlot)) {
        setSelectedSlot(dateObj.availableSlots[0]);
      }
    } else {
      setSelectedSlot('');
    }
  };

  const modeLabel = consultType === 'clinic' ? 'In-Person Clinic Visit' : 'Video Consultation';

  const handleConfirm = async () => {
    if (!selectedSlot) {
      Alert.alert('Slot Required', 'Please select an available appointment time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await bookAppointment({
        doctorId,
        date: selectedDate || currentDateObj?.date || new Date().toISOString().split('T')[0],
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
            'Appointment Confirmed',
            `Your ${modeLabel.toLowerCase()} with ${doctorName} on ${currentDateObj?.label || selectedDate} at ${selectedSlot} is confirmed. Status: "${result.appointment?.status}".`
          );
        }
      }, 350);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        Alert.alert(
          'Slot Unavailable',
          'This slot was just booked by another patient. We have refreshed the available times for you.',
          [{ text: 'OK', onPress: () => loadAvailability() }]
        );
        loadAvailability();
      } else {
        Alert.alert('Could not book', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isAyushmanCovered = patient?.ayushmanEligible || consultationFee === 0;
  const feeLabel = isAyushmanCovered ? 'Ayushman PM-JAY: ₹0' : `₹${consultationFee}`;

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
          {teleconsultationAvailable && (
            <Chip
              label="Teleconsultation"
              icon="videocam"
              selected={consultType === 'video'}
              onPress={() => setConsultType('video')}
              style={{ flex: 1 }}
            />
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Select Date</Text>
          {loadingAvailability && <Spinner size="small" />}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {availableDates.map(item => (
            <Chip
              key={item.date}
              label={item.label}
              size="sm"
              selected={selectedDate === item.date}
              onPress={() => handleSelectDate(item.date)}
              style={styles.dateChip}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Select Time Slot</Text>
        {activeSlots.length > 0 ? (
          <View style={styles.slotGrid}>
            {activeSlots.map(slot => (
              <Chip
                key={slot}
                label={slot}
                selected={selectedSlot === slot}
                onPress={() => setSelectedSlot(slot)}
                style={{ width: '31.5%' }}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptySlotsBox}>
            <Text style={styles.emptySlotsText}>
              All slots for this day are fully booked. Please select another date.
            </Text>
          </View>
        )}

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
            {isAyushmanCovered
              ? `Consultation covered 100% under Ayushman Bharat PM-JAY (ABHA: ${patient?.abhaId || 'Verified'}).`
              : `Standard consultation fee: ₹${consultationFee}.`}
            {isOnline ? '' : ' You are offline — this request will be queued until you reconnect.'}
          </Text>
        </View>

        <Button
          label={submitting ? 'Requesting…' : `Confirm Appointment (${feeLabel})`}
          icon="check-circle"
          block
          loading={submitting}
          disabled={submitting || !doctorId || !selectedSlot}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
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
    paddingVertical: 2,
  },
  dateChip: {
    minWidth: 125,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emptySlotsBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  emptySlotsText: {
    fontSize: 12,
    color: '#991B1B',
    textAlign: 'center',
    fontWeight: '500',
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
