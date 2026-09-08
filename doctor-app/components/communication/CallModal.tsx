/**
 * CallModal – WhatsApp-style 1-to-1 calling UI (Doctor App).
 *
 * VIDEO: Full-screen remote video, floating self-preview, dark overlay controls.
 * VOICE: Avatar with animated rings, caller info, gradient background.
 * Bottom bar: mic, camera, switch camera, end call.
 *
 * Driven by the WebRTCCallingEngine singleton.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getCallingEngine, CallState, CallType } from '../../services/communication/WebRTCCallingEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface CallModalProps {
  visible: boolean;
  onClose: () => void;
  peerName: string;
  appointmentId: string;
  callType?: CallType;
}

export const CallModal: React.FC<CallModalProps> = ({
  visible, onClose, peerName, appointmentId, callType: initialCallType = 'video',
}) => {
  const engine = getCallingEngine();
  const [callState, setCallState] = useState<CallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && callState && (callState.status === 'ringing' || callState.status === 'initiating' || callState.callType === 'voice')) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible, callState?.status, callState?.callType]);

  useEffect(() => {
    if (!visible) return;
    const unsubs: (() => void)[] = [];
    unsubs.push(engine.on('stateChange', (state: CallState) => setCallState({ ...state })));
    unsubs.push(engine.on('localStream', (stream: MediaStream) => setLocalStream(stream)));
    unsubs.push(engine.on('remoteStream', (stream: MediaStream) => setRemoteStream(stream)));
    unsubs.push(engine.on('error', (data: { error: string }) => setErrorMsg(data.error)));
    unsubs.push(engine.on('ended', () => { setTimeout(() => onClose(), 500); }));
    unsubs.push(engine.on('declined', () => { setErrorMsg('Call was declined'); setTimeout(() => onClose(), 2000); }));
    unsubs.push(engine.on('missed', () => { setErrorMsg('No answer'); setTimeout(() => onClose(), 2000); }));
    // If the engine already has a call, hydrate state; otherwise initiate new call
    if (engine.currentCall) {
      setCallState({ ...engine.currentCall });
    } else if (appointmentId) {
      engine.initiateCall(appointmentId, initialCallType);
    }
    return () => { unsubs.forEach((u) => u()); };
  }, [visible]);

  useEffect(() => {
    if (Platform.OS === 'web' && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (Platform.OS === 'web' && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (callState?.status === 'connected' && callState?.callType === 'video') {
      controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    }
  }, [callState?.status, callState?.callType]);

  useEffect(() => {
    if (callState?.status === 'connected' && callState?.callType === 'video') {
      resetControlsTimer();
    } else {
      setShowControls(true);
    }
  }, [callState?.status, callState?.callType]);

  const handleEndCall = () => { engine.endCall(); onClose(); };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (errorMsg) return errorMsg;
    switch (callState?.status) {
      case 'initiating': return 'Calling…';
      case 'ringing': return 'Ringing…';
      case 'connecting': return 'Connecting…';
      case 'connected': return formatDuration(callState.duration);
      default: return 'Starting call…';
    }
  };

  const isConnected = callState?.status === 'connected';
  const isVideo = callState?.callType === 'video';

  const renderVoiceBackground = () => (
    <View style={styles.voiceBg}>
      <View style={styles.voiceGradient}>
        <Animated.View style={[styles.pulseRing, styles.pulseRing3, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.pulseRing, styles.pulseRing2, { transform: [{ scale: Animated.multiply(pulseAnim, 0.85) }] }]} />
        <Animated.View style={[styles.pulseRing, styles.pulseRing1, { transform: [{ scale: Animated.multiply(pulseAnim, 0.7) }] }]} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(peerName || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.voiceName}>{peerName}</Text>
        <Text style={styles.voiceStatus}>{getStatusText()}</Text>
      </View>
    </View>
  );

  const renderVideoBackground = () => (
    <View style={styles.videoBg}>
      {Platform.OS === 'web' && (
        <video
          ref={remoteVideoRef as any}
          autoPlay playsInline
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#0F172A' } as any}
        />
      )}
      {!remoteStream && (
        <View style={styles.videoPlaceholder}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(peerName || '?').charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.voiceName}>{peerName}</Text>
          <Text style={styles.voiceStatus}>{getStatusText()}</Text>
        </View>
      )}
      {Platform.OS === 'web' && localStream && (
        <View style={styles.localPip}>
          <video
            ref={localVideoRef as any}
            autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12, transform: 'scaleX(-1)' } as any}
          />
          {callState?.isCameraOff && (
            <View style={styles.pipCameraOff}><MaterialIcons name="videocam-off" size={20} color="#FFF" /></View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleEndCall} statusBarTranslucent>
      <TouchableOpacity activeOpacity={1} style={styles.container} onPress={resetControlsTimer}>
        {isVideo ? renderVideoBackground() : renderVoiceBackground()}

        {showControls && (
          <View style={styles.topBar}>
            <View style={styles.topBarContent}>
              <View style={styles.topLeft}>
                <MaterialIcons name={isVideo ? 'videocam' : 'call'} size={16} color="#34D399" />
                <Text style={styles.topName} numberOfLines={1}>{peerName}</Text>
              </View>
              <View style={styles.topRight}>
                {isConnected ? (
                  <View style={styles.durationBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.durationText}>{formatDuration(callState!.duration)}</Text>
                  </View>
                ) : (
                  <Text style={styles.statusTextTop}>{getStatusText()}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {errorMsg && !['Call was declined', 'No answer'].includes(errorMsg) && (
          <View style={styles.errorOverlay}>
            <MaterialIcons name="error-outline" size={24} color="#FCA5A5" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {showControls && (
          <View style={styles.bottomBar}>
            <View style={styles.controlsRow}>
              <TouchableOpacity style={[styles.controlBtn, callState?.isMuted && styles.controlBtnActive]} onPress={() => engine.toggleMute()} activeOpacity={0.7}>
                <MaterialIcons name={callState?.isMuted ? 'mic-off' : 'mic'} size={24} color="#FFF" />
                <Text style={styles.controlLabel}>{callState?.isMuted ? 'Unmute' : 'Mute'}</Text>
              </TouchableOpacity>

              {isVideo && (
                <TouchableOpacity style={[styles.controlBtn, callState?.isCameraOff && styles.controlBtnActive]} onPress={() => engine.toggleCamera()} activeOpacity={0.7}>
                  <MaterialIcons name={callState?.isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#FFF" />
                  <Text style={styles.controlLabel}>{callState?.isCameraOff ? 'Camera On' : 'Camera Off'}</Text>
                </TouchableOpacity>
              )}

              {isConnected && (
                <TouchableOpacity style={styles.controlBtn} onPress={() => engine.switchCallMode(isVideo ? 'voice' : 'video')} activeOpacity={0.7}>
                  <MaterialIcons name={isVideo ? 'phone' : 'videocam'} size={24} color="#FFF" />
                  <Text style={styles.controlLabel}>{isVideo ? 'Voice' : 'Video'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.7}>
                <MaterialIcons name="call-end" size={28} color="#FFF" />
                <Text style={styles.controlLabel}>End</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  voiceBg: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  voiceGradient: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#087F8C', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  avatarText: { fontSize: 40, fontWeight: '700', color: '#FFF' },
  voiceName: { fontSize: 24, fontWeight: '700', color: '#FFF', marginTop: 20, zIndex: 5 },
  voiceStatus: { fontSize: 14, color: '#94A3B8', marginTop: 6, zIndex: 5 },
  pulseRing: { position: 'absolute', borderRadius: 999, borderWidth: 2 },
  pulseRing1: { width: 130, height: 130, borderColor: 'rgba(8, 127, 140, 0.5)' },
  pulseRing2: { width: 170, height: 170, borderColor: 'rgba(8, 127, 140, 0.3)' },
  pulseRing3: { width: 210, height: 210, borderColor: 'rgba(8, 127, 140, 0.15)' },
  videoBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F172A' },
  videoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  localPip: { position: 'absolute', top: 80, right: 16, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E293B', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', elevation: 8 },
  pipCameraOff: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(15, 23, 42, 0.7)' },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  topName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  statusTextTop: { fontSize: 13, color: '#94A3B8' },
  durationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34, 197, 94, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  durationText: { fontSize: 13, fontWeight: '600', color: '#34D399' },
  errorOverlay: { position: 'absolute', top: 120, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(127, 29, 29, 0.85)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  errorText: { fontSize: 13, color: '#FCA5A5', flex: 1 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40, paddingTop: 20, paddingHorizontal: 24, backgroundColor: 'rgba(15, 23, 42, 0.85)' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  controlBtn: { alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
  controlBtnActive: { backgroundColor: 'rgba(239, 68, 68, 0.6)' },
  controlLabel: { fontSize: 10, color: '#CBD5E1', marginTop: 4 },
  endCallBtn: { alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: '#DC2626' },
});
