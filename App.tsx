import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from './constants/theme';
import { SwasthyaSetuTheme } from './constants/paperTheme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CarePlatformProvider } from './context/CarePlatformContext';
import { Header } from './components/Header';
import { BottomTabBar, TabType } from './components/BottomTabBar';
import { EmergencySosModal } from './components/EmergencySosModal';
import { BookingModal } from './components/BookingModal';
import { PrescriptionQrModal } from './components/PrescriptionQrModal';
import { LoadingOverlay } from './components/ui';
import { getCallingEngine, IncomingCallInfo, CallType } from './services/communication/WebRTCCallingEngine';
import { session } from './services/apiClient';
import { IncomingCallModal } from './components/communication/IncomingCallModal';
import { CallModal } from './components/communication/CallModal';

// Patient screens
import { PatientLoginScreen } from './screens/patient/PatientLoginScreen';
import { PatientHomeScreen } from './screens/patient/PatientHomeScreen';
import { PatientTriageScreen } from './screens/patient/PatientTriageScreen';
import { PatientDoctorsScreen } from './screens/patient/PatientDoctorsScreen';
import { PatientMapScreen } from './screens/patient/PatientMapScreen';
import { PatientMedsScreen } from './screens/patient/PatientMedsScreen';
import { PatientProfileScreen } from './screens/patient/PatientProfileScreen';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [sosVisible, setSosVisible] = useState(false);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState<{
    id: string;
    name: string;
    specialty: string;
    clinic: string;
    aiTriageSummary?: string;
    aiSymptoms?: string[];
  }>({ id: '', name: '', specialty: '', clinic: '' });
  const [qrVisible, setQrVisible] = useState(false);
  const [qrDetails, setQrDetails] = useState({ medName: '', rxCode: '' });
  const [mapFocusDoctorId, setMapFocusDoctorId] = useState<string | null>(null);

  // Global 1-to-1 Calling State
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<{
    peerName: string;
    appointmentId: string;
    callType: CallType;
  } | null>(null);

  const { token } = useAuth();

  useEffect(() => {
    const engine = getCallingEngine();
    const effectiveToken = token || session.getToken();
    if (effectiveToken) {
      engine.connect(effectiveToken);
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

  const handleOpenBooking = (
    id: string,
    name: string,
    specialty: string,
    clinic: string,
    aiTriageSummary?: string,
    aiSymptoms?: string[]
  ) => {
    setBookingDoctor({ id, name, specialty, clinic, aiTriageSummary, aiSymptoms });
    setBookingVisible(true);
  };

  const handleOpenDoctorMap = (doctorId: string, doctorName: string) => {
    setMapFocusDoctorId(doctorId);
    setActiveTab('map');
  };

  const handleOpenQr = (medName: string, rxCode: string) => {
    setQrDetails({ medName, rxCode });
    setQrVisible(true);
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab as TabType);
  };

  return (
    <View style={styles.appContainer}>
      {/* Top Header with Profile & SOS */}
<Header
      onProfilePress={() => setActiveTab('profile')}
      onSosPress={() => setSosVisible(true)}
      onViewMap={() => setActiveTab('map')}
    />

      {/* Tab Screens Container */}
      <View style={styles.content}>
        {activeTab === 'home' && (
          <PatientHomeScreen
            onNavigate={handleNavigate}
            onOpenSos={() => setSosVisible(true)}
          />
        )}
        {activeTab === 'triage' && (
          <PatientTriageScreen
            onNavigate={handleNavigate}
            onOpenBooking={handleOpenBooking}
          />
        )}
        {activeTab === 'doctors' && (
          <PatientDoctorsScreen onOpenBooking={handleOpenBooking} />
        )}
        {activeTab === 'map' && (
          <PatientMapScreen
            focusDoctorId={mapFocusDoctorId}
            onOpenBooking={handleOpenBooking}
          />
        )}
        {activeTab === 'meds' && (
          <PatientMedsScreen onOpenQr={handleOpenQr} />
        )}
        {activeTab === 'profile' && (
          <PatientProfileScreen />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Global Modals */}
      <EmergencySosModal
        visible={sosVisible}
        onClose={() => setSosVisible(false)}
      />
      <BookingModal
        visible={bookingVisible}
        doctorId={bookingDoctor.id}
        doctorName={bookingDoctor.name}
        doctorSpecialty={bookingDoctor.specialty}
        clinicName={bookingDoctor.clinic}
        aiTriageSummary={bookingDoctor.aiTriageSummary}
        aiSymptoms={bookingDoctor.aiSymptoms}
        onClose={() => setBookingVisible(false)}
      />
      <PrescriptionQrModal
        visible={qrVisible}
        medName={qrDetails.medName}
        rxCode={qrDetails.rxCode}
        onClose={() => setQrVisible(false)}
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
        <LoadingOverlay visible label="Loading RuralCare…" />
      </View>
    );
  }

  if (!user) return <PatientLoginScreen />;

  return (
    <CarePlatformProvider>
      <AppContent />
    </CarePlatformProvider>
  );
}

/**
 * SafeAreaShell — uses useSafeAreaInsets from react-native-safe-area-context
 * (not the basic SafeAreaView from react-native) to correctly handle
 * Android status bar, display cutouts (notch/punch-hole), and gesture
 * navigation bar insets on every Android device.
 */
function SafeAreaShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.safeArea,
        {
          // Top inset accounts for status bar + display cutout on Android
          paddingTop: insets.top,
          // Bottom inset accounts for gesture nav bar
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

  console.log('[App] Fonts loaded:', fontsLoaded, 'Error:', fontError);

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
  gate: {
    flex: 1,
    backgroundColor: Colors.surface,
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
});
