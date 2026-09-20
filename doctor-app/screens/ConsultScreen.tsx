import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Appointment, Patient } from '../types';
import { Avatar, Badge, Button, Card, Divider, IconButton, Input } from '../components/ui';
import { AppointmentChatModal } from '../components/communication/AppointmentChatModal';
import { CallModal } from '../components/communication/CallModal';
import { DoctorHealthPassportModal } from '../components/DoctorHealthPassportModal';
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
  const [passportVisible, setPassportVisible] = useState(false);

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
              <View style={styles.modeIconBadge}>
                <MaterialIcons
                  name={appointment?.mode === 'video' ? 'videocam' : 'local-hospital'}
                  size={16}
                  color={appointment?.mode === 'video' ? Colors.primary : Colors.secondary}
                />
              </View>
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
              <MaterialIcons name="chat" size={17} color={Colors.primary} />
              <Text style={styles.commChatText}>Chat</Text>
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
                  <MaterialIcons name="call" size={17} color="#334155" />
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
                  <MaterialIcons name="videocam" size={17} color={Colors.white} />
                  <Text style={styles.commVideoText}>Video</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        )}

        {/* Longitudinal Health Passport Quick Access */}
        <TouchableOpacity
          style={styles.passportBtn}
          onPress={() => setPassportVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.passportBtnLeft}>
            <View style={styles.passportIconWrap}>
              <MaterialIcons name="medical-information" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passportBtnText}>Patient Health Passport</Text>
              <Text style={styles.passportBtnSubtext}>Longitudinal clinical records & history</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
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
          <View style={styles.vitalCol}>
            <Input
              value={bp}
              onChangeText={setBp}
              placeholder="BP (120/80)"
              keyboardType="numeric"
              leadingIcon="speed"
            />
          </View>
          <View style={styles.vitalCol}>
            <Input
              value={temp}
              onChangeText={setTemp}
              placeholder="Temp (°F)"
              keyboardType="numeric"
              leadingIcon="thermostat"
            />
          </View>
          <View style={styles.vitalCol}>
            <Input
              value={pulse}
              onChangeText={setPulse}
              placeholder="Pulse (bpm)"
              keyboardType="numeric"
              leadingIcon="favorite"
            />
          </View>
          <View style={styles.vitalCol}>
            <Input
              value={spo2}
              onChangeText={setSpo2}
              placeholder="SpO₂ (%)"
              keyboardType="numeric"
              leadingIcon="air"
            />
          </View>
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
          numberOfLines={3}
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
        <TouchableOpacity
          style={styles.prescriptionActionBtn}
          onPress={onOpenPrescription}
          activeOpacity={0.85}
        >
          <MaterialIcons name="receipt-long" size={18} color={Colors.white} />
          <Text style={styles.prescriptionActionText}>Prescription</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.referralActionBtn}
          onPress={onOpenReferral}
          activeOpacity={0.85}
        >
          <MaterialIcons name="send" size={18} color={Colors.primary} />
          <Text style={styles.referralActionText}>Referral</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.completeBtn}
        onPress={onComplete}
        activeOpacity={0.85}
      >
        <MaterialIcons name="task-alt" size={19} color={Colors.white} />
        <Text style={styles.completeBtnText}>Complete Consultation</Text>
      </TouchableOpacity>
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
    {/* Doctor Health Passport Modal */}
    <DoctorHealthPassportModal
      visible={passportVisible}
      patientId={patient.id}
      patientName={patient.name}
      onClose={() => setPassportVisible(false)}
    />
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
    paddingBottom: 48,
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
  modeIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B5F1F8',
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
    paddingVertical: 4,
    marginTop: 6,
  },
  allergyBox: {},
  allergyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  commActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  commChatBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radii.md,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
  },
  commChatText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  commVideoBtn: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radii.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  commVoiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
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
    justifyContent: 'space-between',
    rowGap: 10,
  },
  vitalCol: {
    width: '48.5%',
    minWidth: 130,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  prescriptionActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  prescriptionActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  referralActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  referralActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  completeBtn: {
    height: 48,
    backgroundColor: '#0F172A',
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  passportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  passportBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  passportIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E6F4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  passportBtnSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
});
