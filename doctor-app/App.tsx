import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from './constants/theme';
import { SwasthyaSetuTheme } from './constants/paperTheme';
import { Header } from './components/Header';
import { BottomTabBar, DoctorTab } from './components/BottomTabBar';
import { PrescriptionSheet } from './components/PrescriptionSheet';
import { ReferralSheet } from './components/ReferralSheet';
import { TodayScreen } from './screens/TodayScreen';
import { PatientsScreen } from './screens/PatientsScreen';
import { ConsultScreen } from './screens/ConsultScreen';
import { RxScreen } from './screens/RxScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LoginScreen } from './screens/LoginScreen';
import { LoadingOverlay, ClinicalLoadingScreen } from './components/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, usePoll, session } from './services/api';
import { getCallingEngine, IncomingCallInfo, CallType } from './services/communication/WebRTCCallingEngine';
import { IncomingCallModal } from './components/communication/IncomingCallModal';
import { CallModal } from './components/communication/CallModal';
import {
  Appointment,
  Patient,
  Prescription,
  PrescriptionItem,
  Referral,
  DoctorProfileData,
} from './types';

function DoctorApp() {
  const { user, doctorId, token } = useAuth();
  const [activeTab, setActiveTab] = useState<DoctorTab>('today');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfileData | null>(null);

  // Global 1-to-1 Calling State
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<{
    peerName: string;
    appointmentId: string;
    callType: CallType;
  } | null>(null);

  useEffect(() => {
    const engine = getCallingEngine();
    const activeToken = token || session.getToken();
    if (activeToken) {
      console.log('[DoctorApp] Connecting calling engine with token...');
      engine.connect(activeToken);
    }

    const unsubs = [
      engine.on('incoming', (info: IncomingCallInfo) => {
        setIncomingCall(info);
      }),
      engine.on('ended', () => {
        setIncomingCall(null);
        setActiveCallSession(null);
      }),
      engine.on('declined', () => {
        setIncomingCall(null);
      }),
      engine.on('missed', () => {
        setIncomingCall(null);
      }),
    ];

    return () => {
      unsubs.forEach(u => u());
    };
  }, [token]);

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    const engine = getCallingEngine();
    engine.acceptCall(incomingCall.callId);
    setActiveCallSession({
      peerName: incomingCall.callerName,
      appointmentId: incomingCall.appointmentId,
      callType: incomingCall.callType,
    });
    setIncomingCall(null);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    const engine = getCallingEngine();
    engine.declineCall(incomingCall.callId);
    setIncomingCall(null);
  };

  // Fetch verified doctor profile from backend database
  useEffect(() => {
    const docId = doctorId || user?.doctorId;
    if (!docId) return;

    api
      .get<any>(`/doctors/${docId}`)
      .then(doc => {
        if (doc) {
          setDoctorProfile({
            id: doc.id,
            name: doc.name || user?.name || 'Doctor',
            degrees: doc.qualification || 'MBBS',
            specialty: doc.specialty || 'General Medicine',
            facility: doc.clinicName || 'RuralCare Health Facility',
            clinicAddress: doc.clinicAddress || '',
            hprId: doc.registrationNumber || 'HPR-Verified',
            phone: doc.phone || '+91-XXXX-XXXXXX',
            languages: doc.languages || ['Hindi', 'English'],
            consultationFee: doc.consultationFee ?? 0,
            maxPatientsPerDay: doc.maxPatientsPerDay ?? 40,
            ayushmanPaneled: !!doc.ayushmanPaneled,
            teleconsultation: !!doc.teleconsultation,
            latitude: doc.latitude,
            longitude: doc.longitude,
          });
        }
      })
      .catch(err => {
        console.log('[DoctorApp] Profile load info:', err?.message);
      });
  }, [doctorId, user]);

  const { data: remoteAppointments, offline: appointmentsOffline } = usePoll<any[]>(
    () => api.get<any[]>('/appointments'),
    3000
  );
  const { data: remoteReferrals } = usePoll<any[]>(
    () => api.get<any[]>('/referrals'),
    2500
  );
  const { data: remotePatients } = usePoll<any[]>(
    () => api.get<any[]>('/patients'),
    4000
  );
  const { data: remotePrescriptions } = usePoll<any[]>(
    () => api.get<any[]>('/prescriptions'),
    3500
  );

  useEffect(() => {
    if (!remoteAppointments) return;
    const serverAppts: Appointment[] = remoteAppointments
      .map(a => {
        const pat =
          a.patient ||
          (a.patientName
            ? {
                id: a.patientId,
                name: a.patientName,
                phone: a.patientPhone || '',
                village: a.patientVillage || 'Vaishali',
                age: a.patientAge || 30,
                gender: a.patientGender || 'Other',
                allergies: a.patientAllergies || [],
                abhaId: a.patientAbhaId || 'ABHA-VERIFIED',
              }
            : null);

        return {
          id: a.id,
          patientId: a.patientId,
          date: a.date,
          time: a.time,
          reason: a.chiefComplaint || a.reason || 'General consultation',
          triage: a.aiTriageSummary || 'No preliminary triage summary.',
          mode: (a.mode === 'teleconsultation' ? 'video' : 'clinic') as 'video' | 'clinic',
          status: (a.status === 'completed' ? 'done' : a.status === 'in_consultation' ? 'in-consult' : 'waiting') as 'waiting' | 'in-consult' | 'done',
          patient: pat,
        };
      })
      .sort((a, b) => {
        if (a.status === 'in-consult' && b.status !== 'in-consult') return -1;
        if (b.status === 'in-consult' && a.status !== 'in-consult') return 1;
        if (a.status === 'waiting' && b.status === 'done') return -1;
        if (b.status === 'waiting' && a.status === 'done') return 1;
        return (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || '');
      });
    setAppointments(serverAppts);

    // Populate patients dynamically from real appointment records
    setPatients(prev => {
      const existingMap = new Map(prev.map(p => [p.id, p]));
      remoteAppointments.forEach(a => {
        if (a.patient && a.patient.id) {
          existingMap.set(a.patient.id, {
            id: a.patient.id,
            name: a.patient.name || `Patient ${a.patient.id}`,
            age: a.patient.age || 0,
            gender: a.patient.gender || 'Unknown',
            village: a.patient.village || 'Local Village',
            phone: a.patient.phone || '',
            bloodGroup: a.patient.bloodGroup || 'O+',
            allergies: a.patient.allergies || [],
            abhaId: a.patient.abhaId || '',
            avatar: a.patient.avatar,
          });
        }
      });
      return Array.from(existingMap.values());
    });
  }, [remoteAppointments]);

  useEffect(() => {
    if (!remotePatients) return;
    setPatients(prev => {
      const existingMap = new Map(prev.map(p => [p.id, p]));
      remotePatients.forEach(p => {
        existingMap.set(p.id, {
          id: p.id,
          name: p.name,
          age: p.age,
          gender: p.gender,
          village: p.village || 'Local Village',
          phone: p.phone || '',
          bloodGroup: p.bloodGroup || 'O+',
          allergies: p.allergies || [],
          abhaId: p.abhaId || '',
          avatar: p.avatar,
        });
      });
      return Array.from(existingMap.values());
    });
  }, [remotePatients]);

  useEffect(() => {
    if (!remotePrescriptions) return;
    setPrescriptions(
      remotePrescriptions.map(rx => ({
        id: rx.id,
        code: rx.qrCode || 'RX-000000',
        patientId: rx.patientId,
        patientName: rx.patientName,
        items: (rx.items || []).map((i: any) => ({
          medicine: i.drugName || i.genericName,
          dose: i.dosage || '1 tablet',
          frequency: i.frequency || 'Twice daily',
          duration: i.duration || '5 days',
        })),
        createdAt: new Date(rx.issuedAt || rx.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pharmacyName: rx.pharmacyName || rx.pharmacyId || 'Local Medical Stores',
        pharmacyStatus:
          rx.dispensingStatus === 'dispensed'
            ? 'dispensed'
            : rx.dispensingStatus === 'ready_for_pickup'
            ? 'ready'
            : rx.dispensingStatus === 'preparing'
            ? 'preparing'
            : rx.dispensingStatus === 'confirmed'
            ? 'confirmed'
            : rx.dispensingStatus === 'sent_to_pharmacy'
            ? 'sent'
            : rx.dispensingStatus === 'partial'
            ? 'partial'
            : 'pending',
        diagnosis: rx.diagnosis,
        doctorName: rx.doctorName,
        rawItems: rx.items,
      }))
    );
  }, [remotePrescriptions]);

  useEffect(() => {
    if (!remoteReferrals) return;
    setReferrals(
      remoteReferrals.map(r => ({
        id: r.id,
        patientName: r.patientName,
        specialty: r.specialty || 'General Medicine',
        beds: r.assignedBed || r.beds || 'General (2 days)',
        diagnostics: r.diagnostics || [],
        urgency: r.urgency === 'high' || r.urgency === 'emergency' ? 'emergency' : r.urgency === 'medium' || r.urgency === 'priority' ? 'priority' : 'routine',
        status: r.status === 'accepted' ? 'accepted' : r.status === 'rejected' ? 'rejected' : 'pending',
        hospitalName: r.hospitalName,
        createdAt: new Date(r.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
    );
  }, [remoteReferrals]);

  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [rxSheetVisible, setRxSheetVisible] = useState(false);
  const [referralSheetVisible, setReferralSheetVisible] = useState(false);

  const patientsById = useMemo(
    () => Object.fromEntries(patients.map(p => [p.id, p])) as Record<string, Patient>,
    [patients]
  );

  const statusById = useMemo(() => {
    const map: Record<string, 'waiting' | 'in-consult' | 'done'> = {};
    appointments.forEach(a => {
      map[a.patientId] = a.status;
    });
    return map;
  }, [appointments]);

  const startConsultByAppointment = (appointmentId: string) => {
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) return;
    setAppointments(prev =>
      prev.map(a => (a.id === appointmentId ? { ...a, status: 'in-consult' } : a))
    );
    api.patch(`/appointments/${appointmentId}`, { status: 'in_consultation' }).catch(() => {});
    setActivePatient(patientsById[appt.patientId]);
    setActiveTab('consult');
  };

  const startConsultByPatient = (patientId: string) => {
    const existing = appointments.find(
      a => a.patientId === patientId && a.status !== 'done'
    );
    if (existing) {
      startConsultByAppointment(existing.id);
      return;
    }
    const patient = patientsById[patientId];
    const newAppt: Appointment = {
      id: `appt_${Date.now()}`,
      patientId,
      time: 'Walk-in',
      reason: 'Walk-in consultation',
      triage: 'Direct walk-in consultation.',
      mode: 'clinic',
      status: 'in-consult',
      patient: patient || null,
    };
    setAppointments(prev => [newAppt, ...prev]);
    api
      .post('/appointments', {
        patientId,
        doctorId: doctorId || user?.doctorId || 'd1',
        patientName: patient?.name,
        doctorName: doctorProfile?.name || user?.name || 'Doctor',
        clinic: doctorProfile?.facility || 'PHC',
        date: new Date().toISOString().split('T')[0],
        time: 'Walk-in',
        mode: 'in-person',
        chiefComplaint: 'Walk-in consultation',
        aiTriageSummary: newAppt.triage,
        status: 'in_consultation',
      })
      .catch(() => {});
    setActivePatient(patient || null);
    setActiveTab('consult');
  };

  const handleIssuePrescription = async (items: PrescriptionItem[], pharmacy: string) => {
    if (!activePatient) return;
    const appt = appointments.find(a => a.patientId === activePatient.id && a.status === 'in-consult');
    const qrCode = `RX-${Math.floor(100000 + Math.random() * 899999)}`;

    const formattedItems = items.map((i, idx) => ({
      id: `item-${idx + 1}`,
      drugName: i.medicine,
      genericName: i.medicine,
      dosage: i.dose,
      form: 'tablet',
      frequency: i.frequency,
      duration: i.duration,
      instructions: 'As directed by physician',
      quantity: 10,
    }));

    try {
      await api.post('/prescriptions', {
        consultationId: appt?.id || `cons-${Date.now()}`,
        patientId: activePatient.id,
        patientName: activePatient.name,
        doctorId: doctorId || user?.doctorId || 'd1',
        doctorName: doctorProfile?.name || user?.name || 'Doctor',
        diagnosis: appt?.reason || 'General Consultation',
        items: formattedItems,
        qrCode,
        pharmacyId: 'ph1',
      });
    } catch {}

    setPrescriptions(prev => [
      {
        id: `rx${Date.now()}`,
        code: qrCode,
        patientId: activePatient.id,
        patientName: activePatient.name,
        items,
        createdAt: 'Just now',
        pharmacyName: pharmacy,
        pharmacyStatus: 'sent',
      },
      ...prev,
    ]);
  };

  const handleCreateReferral = async (referral: Referral) => {
    setReferrals(prev => [referral, ...prev]);
    const appt = appointments.find(a => a.patientId === activePatient?.id && a.status === 'in-consult');

    try {
      await api.post('/referrals', {
        patientId: activePatient?.id || 'p1',
        patientName: referral.patientName,
        doctorId: doctorId || user?.doctorId || 'd1',
        referringDoctor: doctorProfile?.name || user?.name || 'Doctor',
        hospitalId: 'hosp-601',
        hospitalName: 'Ramnagar Community Health Center',
        consultationId: appt?.id || `cons-${Date.now()}`,
        reason: referral.specialty,
        specialty: referral.specialty,
        beds: referral.beds,
        diagnostics: referral.diagnostics,
        urgency: referral.urgency === 'emergency' ? 'high' : referral.urgency === 'priority' ? 'medium' : 'routine',
      });
    } catch {}
  };

  const handleCompleteConsult = async () => {
    if (!activePatient) return;
    const appt = appointments.find(
      a => a.patientId === activePatient.id && a.status === 'in-consult'
    );
    setAppointments(prev =>
      prev.map(a =>
        a.patientId === activePatient.id && a.status === 'in-consult'
          ? { ...a, status: 'done' }
          : a
      )
    );
    if (appt) {
      api.patch(`/appointments/${appt.id}`, { status: 'completed' }).catch(() => {});
      api.post('/consultations', {
        appointmentId: appt.id,
        patientId: activePatient.id,
        doctorId: doctorId || user?.doctorId || 'd1',
        clinicalNotes: 'Consultation concluded. Prescriptions/referrals provided as needed.',
        provisionalDiagnosis: appt.reason || 'Completed Visit',
      }).catch(() => {});
    }
    setActivePatient(null);
    setActiveTab('today');
  };

  const handleShowNotifications = async () => {
    try {
      const notifs = await api.get<any[]>('/notifications');
      if (!notifs || notifs.length === 0) {
        Alert.alert('Notifications', 'No new alerts at this time.');
      } else {
        const unread = notifs.slice(0, 3).map(n => `• ${n.title}: ${n.message}`).join('\n\n');
        Alert.alert('Recent Notifications', unread);
      }
    } catch {
      Alert.alert('Notifications', 'No notifications found.');
    }
  };

  return (
    <View style={styles.appContainer}>
      <Header
        doctor={doctorProfile}
        doctorId={doctorId || user?.doctorId || doctorProfile?.id}
        onUpdateDoctor={setDoctorProfile}
        onBellPress={handleShowNotifications}
        onProfilePress={() => setActiveTab('profile')}
      />

      <View style={styles.content}>
        {activeTab === 'today' && (
          <TodayScreen
            appointments={appointments}
            patientsById={patientsById}
            referrals={referrals}
            doctor={doctorProfile}
            isLoading={remoteAppointments === null}
            isOffline={appointmentsOffline}
            onStartConsult={startConsultByAppointment}
            onOpenQueue={() => setActiveTab('patients')}
          />
        )}

        {activeTab === 'patients' && (
          <PatientsScreen
            patients={patients}
            statusById={statusById}
            onStartConsult={startConsultByPatient}
          />
        )}

        {activeTab === 'consult' && activePatient && (
          <ConsultScreen
            patient={activePatient}
            appointment={appointments.find(
              a => a.patientId === activePatient.id && a.status === 'in-consult'
            )}
            onOpenPrescription={() => setRxSheetVisible(true)}
            onOpenReferral={() => setReferralSheetVisible(true)}
            onComplete={handleCompleteConsult}
          />
        )}

        {activeTab === 'rx' && <RxScreen prescriptions={prescriptions} />}

        {activeTab === 'profile' && (
          <ProfileScreen
            doctorProfile={doctorProfile}
            onUpdateDoctor={setDoctorProfile}
            appointmentsCount={appointments.filter(a => a.status === 'done').length}
            prescriptionsCount={prescriptions.length}
            referralsCount={referrals.length}
            teleconsultCount={appointments.filter(a => a.mode === 'video').length}
          />
        )}
      </View>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <PrescriptionSheet
        visible={rxSheetVisible}
        onClose={() => setRxSheetVisible(false)}
        patient={activePatient}
        onIssue={handleIssuePrescription}
      />

      <ReferralSheet
        visible={referralSheetVisible}
        onClose={() => setReferralSheetVisible(false)}
        patient={activePatient}
        onCreate={handleCreateReferral}
      />

      {/* Global 1-to-1 Calling Modals */}
      <IncomingCallModal
        visible={!!incomingCall}
        callInfo={incomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />
      {activeCallSession && (
        <CallModal
          visible={!!activeCallSession}
          onClose={() => setActiveCallSession(null)}
          peerName={activeCallSession.peerName}
          appointmentId={activeCallSession.appointmentId}
          callType={activeCallSession.callType}
        />
      )}
    </View>
  );
}

function AuthGate() {
  const { user, restoring } = useAuth();
  if (restoring) {
    return (
      <View style={styles.gate}>
        <ClinicalLoadingScreen
          title="RuralCare • Doctor Portal"
          subtitle="Restoring secure clinical session…"
        />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  return <DoctorApp />;
}

function SafeAreaShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.safeArea,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <StatusBar style="dark" backgroundColor={Colors.surface} />
      {children}
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
    MaterialIcons: require('./assets/fonts/MaterialIcons.ttf'),
    material: require('./assets/fonts/material.ttf'),
    MaterialCommunityIcons: require('./assets/fonts/MaterialCommunityIcons.ttf'),
    'material-community': require('./assets/fonts/material-community.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.surface }}>
        <StatusBar style="dark" backgroundColor={Colors.surface} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PaperProvider theme={SwasthyaSetuTheme}>
          <AuthProvider>
            <SafeAreaShell>
              <AuthGate />
            </SafeAreaShell>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  appContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    flex: 1,
  },
  gate: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
});
