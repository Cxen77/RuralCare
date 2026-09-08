/**
 * Patient Doctors Screen
 * Doctor discovery, specialty filtering, live booking via context
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';
import { useCarePlatform } from '../../context/CarePlatformContext';
import { Button, Chip, Card } from '../../components/ui';
import { AppointmentChatModal } from '../../components/communication/AppointmentChatModal';
import { CallModal } from '../../components/communication/CallModal';
import { CallType } from '../../services/communication/WebRTCCallingEngine';
import { apiClient } from '../../services/apiClient';

interface Props {
  onOpenBooking: (doctorId: string, name: string, specialty: string, clinic: string) => void;
  onOpenDoctorMap?: (doctorId: string, name: string) => void;
}

export const PatientDoctorsScreen: React.FC<Props> = ({ onOpenBooking, onOpenDoctorMap }) => {
  const { doctors, appointments, patient } = useCarePlatform();
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [showAyushmanOnly, setShowAyushmanOnly] = useState(false);

  // Communication modal state
  const [chatApptId, setChatApptId] = useState<string | null>(null);
  const [chatParticipant, setChatParticipant] = useState('');
  const [chatApptDate, setChatApptDate] = useState('');
  const [chatApptTime, setChatApptTime] = useState('');
  const [chatApptMode, setChatApptMode] = useState('');
  const [callApptId, setCallApptId] = useState<string | null>(null);
  const [callPeerName, setCallPeerName] = useState('');
  const [callType, setCallType] = useState<CallType>('video');

  const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean; lastSeen?: string; doctorName?: string }>>({});

  // Poll real-time doctor presence from backend
  React.useEffect(() => {
    let mounted = true;
    const fetchPresence = async () => {
      try {
        const data = await apiClient.get<Record<string, { isOnline: boolean; lastSeen?: string; doctorName?: string }>>('/presence/doctors');
        if (mounted && data) {
          setPresenceMap(data);
        }
      } catch {}
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const specialties = useMemo(() => {
    const set = new Set(doctors.map(d => d.specialty));
    return ['All', ...Array.from(set)];
  }, [doctors]);

  const filtered = useMemo(() => {
    let list = [...doctors];
    if (selectedSpecialty !== 'All') list = list.filter(d => d.specialty === selectedSpecialty);
    if (showAyushmanOnly) list = list.filter(d => d.ayushmanPaneled);
    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [doctors, selectedSpecialty, showAyushmanOnly]);

  const getActiveAppt = (docId: string) => appointments.find(a => a.doctorId === docId && ['confirmed', 'in_consultation'].includes(a.status));

  const currentUserId = patient?.id || '';

  const openChat = (appt: any, doctorName: string) => {
    setChatApptId(appt.id);
    setChatParticipant(doctorName);
    setChatApptDate(appt.date || '');
    setChatApptTime(appt.time || '');
    setChatApptMode(appt.mode === 'teleconsultation' ? 'Teleconsultation' : 'In-Person');
  };

  const startCall = (appt: any, doctorName: string, type: CallType) => {
    const presence = presenceMap[appt.doctorId];
    const isOnline = presence?.isOnline;

    if (!isOnline) {
      Alert.alert(
        `${doctorName} is Offline`,
        `${doctorName} is currently offline. Would you like to send a message via Chat, or attempt to call anyway?`,
        [
          { text: 'Chat Now', onPress: () => openChat(appt, doctorName) },
          {
            text: 'Call Anyway',
            onPress: () => {
              setCallApptId(appt.id);
              setCallPeerName(doctorName);
              setCallType(type);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setCallApptId(appt.id);
    setCallPeerName(doctorName);
    setCallType(type);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.viewOnMapBtn} onPress={() => onOpenDoctorMap?.(filtered[0]?.id, filtered[0]?.name || '')}>
        <MaterialIcons name="map" size={16} color={Colors.primary} />
        <Text style={styles.viewOnMapText}>View on Map</Text>
      </TouchableOpacity>
      <Text style={styles.heading}>Find Nearby Doctors</Text>
      <Text style={styles.subheading}>{filtered.length} doctors found • Sorted by distance</Text>

      {/* Specialty Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {specialties.map(sp => (
          <TouchableOpacity
            key={sp}
            style={[styles.filterChip, selectedSpecialty === sp && styles.filterChipActive]}
            onPress={() => setSelectedSpecialty(sp)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, selectedSpecialty === sp && styles.filterChipTextActive]}>{sp}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ayushman Toggle */}
      <TouchableOpacity style={styles.ayushmanToggle} onPress={() => setShowAyushmanOnly(!showAyushmanOnly)} activeOpacity={0.7}>
        <MaterialIcons name={showAyushmanOnly ? 'check-box' : 'check-box-outline-blank'} size={20} color={Colors.primary} />
        <Text style={styles.ayushmanText}>Ayushman PM-JAY (₹0 consultation) only</Text>
      </TouchableOpacity>

      {/* Doctor Cards */}
      {filtered.map(doc => {
        const activeAppt = getActiveAppt(doc.id);
        const presence = presenceMap[doc.id];
        const isOnline = presence?.isOnline;

        return (
          <Card key={doc.id} padding={14} radius={Radii.lg} style={styles.docCard}>
            <View style={styles.docHeader}>
              <View style={styles.docAvatar}>
                <MaterialIcons name="person" size={26} color={Colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  {isOnline ? (
                    <View style={styles.onlineBadge}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineBadgeText}>Online</Text>
                    </View>
                  ) : (
                    <View style={styles.offlineBadge}>
                      <View style={styles.offlineDot} />
                      <Text style={styles.offlineBadgeText}>Offline</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.docSpecialty}>{doc.specialty} • {doc.qualification}</Text>
                <Text style={styles.docClinic}>{doc.clinicName} ({doc.distanceKm} km)</Text>
              </View>
            </View>

            <View style={styles.docStats}>
              <View style={styles.statBadge}>
                <MaterialIcons name="star" size={14} color="#D97706" />
                <Text style={styles.statText}>{doc.rating}</Text>
                <Text style={styles.statSub}>({doc.reviewCount})</Text>
              </View>
              {doc.ayushmanPaneled && (
                <View style={[styles.statBadge, { backgroundColor: Colors.tertiaryContainer }]}>
                  <Text style={[styles.statText, { color: Colors.tertiary }]}>Ayushman ₹0</Text>
                </View>
              )}
              {doc.teleconsultation && (
                <View style={[styles.statBadge, { backgroundColor: Colors.primaryLight }]}>
                  <MaterialIcons name="videocam" size={12} color={Colors.primary} />
                  <Text style={[styles.statText, { color: Colors.primary }]}>Teleconsult</Text>
                </View>
              )}
              {!doc.isAvailable && (
                <View style={[styles.statBadge, { backgroundColor: Colors.surfaceContainerHigh }]}>
                  <Text style={[styles.statText, { color: Colors.onSurfaceVariant }]}>Unavailable</Text>
                </View>
              )}
            </View>

            {activeAppt ? (
              <>
                <View style={styles.activeApptBanner}>
                  <MaterialIcons name="event-available" size={16} color={Colors.tertiary} />
                  <Text style={styles.activeApptText}>
                    Appointment {activeAppt.status === 'in_consultation' ? 'in progress' : `at ${activeAppt.time}`}
                    {activeAppt.mode === 'teleconsultation' ? ' • Teleconsultation' : ' • In-Person'}
                  </Text>
                </View>
                {/* Communication Buttons */}
                <View style={styles.commRow}>
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => openChat(activeAppt, doc.name)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="chat" size={16} color={Colors.primary} />
                    <Text style={styles.chatBtnText}>Chat</Text>
                  </TouchableOpacity>
                  {activeAppt.mode === 'teleconsultation' ? (
                    <>
                      <TouchableOpacity
                        style={styles.voiceBtn}
                        onPress={() => startCall(activeAppt, doc.name, 'voice')}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="call" size={16} color={Colors.primary} />
                        <Text style={styles.voiceBtnText}>Voice</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.videoBtn}
                        onPress={() => startCall(activeAppt, doc.name, 'video')}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="videocam" size={16} color={Colors.white} />
                        <Text style={styles.videoBtnText}>Video</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={[styles.chatBtn, { opacity: 0.5 }]}>
                      <MaterialIcons name="location-on" size={16} color={Colors.onSurfaceVariant} />
                      <Text style={[styles.chatBtnText, { color: Colors.onSurfaceVariant }]}>In-Person Visit</Text>
                    </View>
                  )}
                </View>
              </>
            ) : doc.isAvailable ? (
              <Button
                label={`Book with ${(doc.name || 'Doctor').split(' ').slice(0, 2).join(' ')}`}
                icon="event"
                block
                onPress={() => onOpenBooking(doc.id, doc.name, doc.specialty, doc.clinicName)}
              />
            ) : null}
          </Card>
        );
      })}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={48} color={Colors.outline} />
          <Text style={styles.emptyText}>No doctors match your filters</Text>
        </View>
      )}
    </ScrollView>

    {/* Chat Modal */}
    <AppointmentChatModal
      visible={!!chatApptId}
      onClose={() => setChatApptId(null)}
      appointmentId={chatApptId || ''}
      participantName={chatParticipant}
      appointmentDate={chatApptDate}
      appointmentTime={chatApptTime}
      mode={chatApptMode}
      api={apiClient}
      currentUserId={currentUserId}
    />

    {/* WhatsApp-Style 1-to-1 Calling Modal */}
    <CallModal
      visible={!!callApptId}
      onClose={() => setCallApptId(null)}
      peerName={callPeerName}
      appointmentId={callApptId || ''}
      callType={callType}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 12, paddingBottom: 24 },
  heading: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  viewOnMapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceContainerLowest, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.outlineLight, alignSelf: 'flex-start', marginBottom: 4 },
  viewOnMapText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  subheading: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: -8 },
  filterRow: { gap: 8, paddingVertical: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.full, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineLight },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
  filterChipTextActive: { color: Colors.white },
  ayushmanToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ayushmanText: { fontSize: 12, fontWeight: '600', color: Colors.onSurfaceVariant },
  docCard: { gap: 10 },
  docHeader: { flexDirection: 'row', gap: 12 },
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 15, fontWeight: '700', color: Colors.onSurface },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.full },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A' },
  onlineBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.full },
  offlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9CA3AF' },
  offlineBadgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  docSpecialty: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 },
  docClinic: { fontSize: 11, fontWeight: '600', color: Colors.onSurfaceVariant, marginTop: 2 },
  docStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceContainerLow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.outlineLight },
  statText: { fontSize: 11, fontWeight: '700', color: Colors.onSurface },
  statSub: { fontSize: 10, color: Colors.onSurfaceVariant },
  activeApptBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.tertiaryContainer, padding: 10, borderRadius: Radii.md },
  activeApptText: { fontSize: 12, fontWeight: '600', color: Colors.onTertiaryContainer, flex: 1 },
  commRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.md, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  chatBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  voiceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.md, backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1.5, borderColor: Colors.primary },
  voiceBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  videoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.md, backgroundColor: Colors.primary, ...Shadows.sm },
  videoBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.outline },
});
