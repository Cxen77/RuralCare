import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Appointment, Patient } from '../types';
import { Avatar, Badge, Button, Card, Divider, IconButton, Input } from '../components/ui';
import { AppointmentChatModal } from '../components/communication/AppointmentChatModal';
import { CallModal } from '../components/communication/CallModal';
import { CallType } from '../services/communication/WebRTCCallingEngine';
import { api } from '../services/api';

interface ConsultScreenProps {
  patient: Patient;
  appointment: Appointment | undefined;
  onOpenPrescription: () => void;
  onOpenReferral: () => void;
  onComplete: () => void;
}

export const ConsultScreen: React.FC<ConsultScreenProps> = ({
  patient,
  appointment,
  onOpenPrescription,
  onOpenReferral,
  onComplete,
}) => {
  const [bp, setBp] = useState('');
  const [temp, setTemp] = useState('');
  const [pulse, setPulse] = useState('');
  const [spo2, setSpo2] = useState('');
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Communication modal states
  const [chatVisible, setChatVisible] = useState(false);
  const [callVisible, setCallVisible] = useState(false);
  const [callType, setCallType] = useState<CallType>('video');

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      {/* Patient Banner */}
      <Card radius={Radii.lg}>
        <View style={styles.bannerRow}>
          <Avatar uri={patient.avatar} name={patient.name} size={52} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <Badge label={appointment?.mode === 'video' ? 'Video Visit' : 'In Clinic'} tone="navy" />
            </View>
            <Text style={styles.patientMeta}>
              {patient.age ? `${patient.age}Y` : ''}{patient.gender ? ` • ${patient.gender}` : ''}{patient.bloodGroup ? ` • Blood Group ${patient.bloodGroup}` : ''}
            </Text>
            <Text style={styles.patientMeta}>ABHA ID: {patient.abhaId || 'Pending'}</Text>
          </View>
        </View>

        {Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
          <View style={[styles.allergyBox, styles.dangerBox]}>
            <MaterialIcons name="warning-amber" size={16} color={Colors.errorDark} />
            <Text style={styles.allergyText}>Allergies: {patient.allergies.join(', ')}</Text>
          </View>
        )}

        {/* Real-time Consultation Communication Row */}
        {appointment?.id && (
          <View style={styles.commActionRow}>
            <TouchableOpacity
              style={styles.commChatBtn}
              onPress={() => setChatVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="chat" size={16} color={Colors.primary} />
              <Text style={styles.commChatText}>Chat with Patient</Text>
            </TouchableOpacity>

            {appointment.mode === 'video' ? (
              <>
                <TouchableOpacity
                  style={styles.commVoiceBtn}
                  onPress={() => {
                    setCallType('voice');
                    setCallVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="call" size={16} color={Colors.primary} />
                  <Text style={styles.commVoiceText}>Voice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commVideoBtn}
                  onPress={() => {
                    setCallType('video');
                    setCallVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="videocam" size={16} color={Colors.white} />
                  <Text style={styles.commVideoText}>Video</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}
      </Card>

      {/* AI Triage Summary */}
      <Card radius={Radii.lg} style={{ borderWidth: 1.5, borderColor: '#D4EBED' }}>
        <View style={styles.sectionRow}>
          <IconButton icon="smart-toy" size="sm" variant="primarySoft" />
          <Text style={styles.sectionTitle}>AI Intake Summary</Text>
          <Text style={styles.syncLabel}>Synced just now</Text>
        </View>
        <Text style={styles.triageText}>
          {appointment?.triage ?? 'No AI intake recorded for this visit.'}
        </Text>
        <Text style={styles.triageReason}>Reported: {appointment?.reason ?? '—'}</Text>
      </Card>

      {/* Vitals */}
      <Card radius={Radii.lg} style={{ gap: 10 }}>
        <Text style={styles.sectionTitlePlain}>Vitals</Text>
        <View style={styles.vitalsGrid}>
          <Input value={bp} onChangeText={setBp} placeholder="BP (120/80)" keyboardType="numeric" />
          <Input value={temp} onChangeText={setTemp} placeholder="Temp (°F)" keyboardType="numeric" />
          <Input value={pulse} onChangeText={setPulse} placeholder="Pulse" keyboardType="numeric" />
          <Input value={spo2} onChangeText={setSpo2} placeholder="SpO₂ (%)" keyboardType="numeric" />
        </View>
      </Card>

      {/* Clinical Assessment */}
      <Card radius={Radii.lg} style={{ gap: 10 }}>
        <Text style={styles.sectionTitlePlain}>Clinical Assessment</Text>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="Examination notes..."
          multiline
        />
        <Input
          value={diagnosis}
          onChangeText={setDiagnosis}
          placeholder="Provisional diagnosis"
          leadingIcon="assignment"
        />
      </Card>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <View style={{ flex: 1 }}>
          <Button label="Write Prescription" icon="receipt-long" block onPress={onOpenPrescription} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Create Referral" icon="send" variant="outline" block onPress={onOpenReferral} />
        </View>
      </View>
      <Button
        label="Complete Consultation"
        icon="task-alt"
        variant="secondary"
        block
        onPress={onComplete}
      />
    </ScrollView>

    {appointment?.id && (
      <>
        <AppointmentChatModal
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          appointmentId={appointment.id}
          participantName={patient.name}
          appointmentDate={appointment.date || ''}
          appointmentTime={appointment.time || ''}
          mode={appointment.mode === 'video' ? 'Teleconsultation' : 'In-Person'}
          api={api}
        />
        <CallModal
          visible={callVisible}
          onClose={() => setCallVisible(false)}
          peerName={patient.name}
          appointmentId={appointment.id}
          callType={callType}
        />
      </>
    )}
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
    gap: 12,
    paddingBottom: 24,
  },
  bannerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondary,
  },
  patientMeta: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  dangerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Radii.md,
    padding: 10,
    marginTop: 10,
  },
  allergyBox: {},
  allergyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.errorDark,
    flex: 1,
  },
  commActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  commChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  commChatText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  commVideoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.primary,
  },
  commVideoText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  commVoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: Radii.md,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  commVoiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
  },
  sectionTitlePlain: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  syncLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  triageText: {
    fontSize: 12,
    color: Colors.onSurface,
    lineHeight: 17,
  },
  triageReason: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
