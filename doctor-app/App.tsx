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
import { LoadingOverlay } from './components/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, usePoll } from './services/api';
import {
  APPOINTMENTS,
  Appointment,
  PATIENTS,
  Patient,
  PRESCRIPTIONS,
  Prescription,
  PrescriptionItem,
  REFERRALS,
  Referral,
} from './data/mock';

function DoctorApp() {
  const [activeTab, setActiveTab] = useState<DoctorTab>('today');
  const [appointments, setAppointments] = useState<Appointment[]>(APPOINTMENTS);
  const [patients, setPatients] = useState<Patient[]>(PATIENTS);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(PRESCRIPTIONS);
  const [referrals, setReferrals] = useState<Referral[]>(REFERRALS);

  const { data: remoteAppointments } = usePoll<any[]>(
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
    setAppointments(prev => {
      const serverAppts: Appointment[] = remoteAppointments.map(a => ({
        id: a.id,
        patientId: a.patientId,
        time: a.time || '10:00 AM',
        reason: a.chiefComplaint || a.reason || 'General consultation',
        triage: a.aiTriageSummary || 'No preliminary triage summary.',
        mode: a.mode === 'teleconsultation' ? 'video' : 'clinic',
        status: a.status === 'completed' ? 'done' : a.status === 'in_consultation' ? 'in-consult' : 'waiting',
      }));
      return serverAppts;
    });
  }, [remoteAppointments]);

  useEffect(() => {
    if (!remotePatients) return;
    setPatients(prev => {
      const knownIds = new Set(prev.map(p => p.id));
      const formatted: Patient[] = remotePatients.map(p => ({
        id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        village: p.village,
        phone: p.phone,
        bloodGroup: p.bloodGroup || 'B+',
        allergies: p.allergies || [],
        abhaId: p.abhaId,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      }));
      return formatted;
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
        pharmacyName: rx.pharmacyId || 'PHC Pharmacy',
        pharmacyStatus: rx.dispensingStatus === 'dispensed' ? 'ready' : rx.dispensingStatus === 'partial' ? 'partial' : 'sent',
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
      id: `a${Date.now()}`,
      patientId,
      time: 'Walk-in',
      reason: 'Walk-in consultation',
      triage: 'No AI intake. Direct consultation.',
      mode: 'clinic',
      status: 'in-consult',
    };
    setAppointments(prev => [newAppt, ...prev]);
    api
      .post('/appointments', {
        patientId,
        patientName: patient?.name,
        doctorName: 'Dr. Anita Sharma',
        clinic: 'Ramnagar PHC',
        time: 'Walk-in',
        mode: 'in-person',
        chiefComplaint: 'Walk-in consultation',
        aiTriageSummary: newAppt.triage,
        status: 'confirmed',
      })
      .catch(() => {});
    setActivePatient(patient);
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
        doctorName: 'Dr. Anita Sharma',
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
        doctorId: 'd1',
        referringDoctor: 'Dr. Anita Sharma',
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
        onBellPress={handleShowNotifications}
        onProfilePress={() => setActiveTab('profile')}
      />

      <View style={styles.content}>
        {activeTab === 'today' && (
          <TodayScreen
            appointments={appointments}
            patientsById={patientsById}
            referrals={referrals}
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

        {activeTab === 'profile' && <ProfileScreen />}
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
    </View>
  );
}

function AuthGate() {
  const { user, restoring } = useAuth();
  if (restoring) {
    return (
      <View style={styles.gate}>
        <LoadingOverlay visible label="Loading RuralCare…" />
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
  });

  console.log('[DoctorApp] Fonts loaded:', fontsLoaded, 'Error:', fontError);

  if (!fontsLoaded && !fontError) {
    return null;
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
