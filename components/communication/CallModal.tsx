/**
 * CallModal – WhatsApp-style 1-to-1 calling UI.
 *
 * VIDEO: Full-screen remote video, floating self-preview, dark overlay controls.
 * VOICE: Avatar with animated rings, caller info, gradient background.
 * Bottom bar: mic, camera, switch camera, end call.
 *
 * Driven entirely by the WebRTCCallingEngine singleton.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getCallingEngine, CallState, CallType } from '../../services/communication/WebRTCCallingEngine';

const NativeRTCView = Platform.OS === 'web' ? null : require('react-native-' + 'webrtc').RTCView;

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
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to engine events
  useEffect(() => {
    if (!visible) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(engine.on('stateChange', (state: CallState) => setCallState({ ...state })));
    unsubs.push(engine.on('localStream', (stream: MediaStream) => setLocalStream(stream)));
    unsubs.push(engine.on('remoteStream', (stream: MediaStream) => setRemoteStream(stream)));
    unsubs.push(engine.on('error', (data: { error: string }) => setErrorMsg(data.error)));

    unsubs.push(engine.on('ended', () => {
      setTimeout(() => onClose(), 500);
    }));
    unsubs.push(engine.on('declined', () => {
      setErrorMsg('Call was declined');
      setTimeout(() => onClose(), 2000);
    }));
    unsubs.push(engine.on('missed', () => {
      setErrorMsg('No answer');
      setTimeout(() => onClose(), 2000);
    }));

    // If the engine already has a call, hydrate state; otherwise initiate new call
    if (engine.currentCall) {
      setCallState({ ...engine.currentCall });
    } else if (appointmentId) {
      engine.initiateCall(appointmentId, initialCallType);
    }

    return () => { unsubs.forEach((u) => u()); };
  }, [visible]);

  // Attach streams to video/audio elements (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (Platform.OS === 'web' && remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('[CallModal] Auto-play audio failed:', err);
      });
    }
    if (Platform.OS === 'web' && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn('[CallModal] Auto-play video failed:', err);
      });
    }
  }, [remoteStream]);

  // Auto-hide controls during connected video calls
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

  const handleEndCall = () => {
    engine.endCall();
    onClose();
  };

  const cleanPeerName = (peerName || 'Doctor')
    .replace(/(Dr\.?\s+)+Dr\.?/gi, 'Dr.')
    .replace(/^(Dr\.?\s*)+/i, 'Dr. ')
    .trim();

  const cleanErrorMsg = errorMsg
    ? errorMsg
        .replace(/(Dr\.?\s+)+Dr\.?/gi, 'Dr.')
        .replace(/^(Dr\.?\s*)+/i, 'Dr. ')
        .trim()
    : '';

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (cleanErrorMsg) {
      if (/offline/i.test(cleanErrorMsg)) return 'Currently offline';
      if (/declined/i.test(cleanErrorMsg)) return 'Call declined';
      if (/no answer|missed|timeout/i.test(cleanErrorMsg)) return 'No answer';
      return 'Call ended';
    }
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

  // ── RENDER ─────────────────────────────────────────────────────────────

  const renderVoiceBackground = () => {
    const nameWithoutDr = cleanPeerName.replace(/^Dr\.?\s*/i, '');
    const avatarLetter = (nameWithoutDr.charAt(0) || cleanPeerName.charAt(0) || '?').toUpperCase();
    return (
      <View style={styles.voiceBg}>
        <View style={styles.voiceGradient}>
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>

          {/* Name & Status */}
          <Text style={styles.voiceName}>{cleanPeerName}</Text>
          <Text style={styles.voiceStatus}>{getStatusText()}</Text>
        </View>
      </View>
    );
  };

  const renderVideoBackground = () => {
    const nameWithoutDr = cleanPeerName.replace(/^Dr\.?\s*/i, '');
    const avatarLetter = (nameWithoutDr.charAt(0) || cleanPeerName.charAt(0) || '?').toUpperCase();
    return (
      <View style={styles.videoBg}>
        {Platform.OS !== 'web' && remoteStream && NativeRTCView && (
          <NativeRTCView
            streamURL={(remoteStream as any).toURL()}
            style={StyleSheet.absoluteFillObject}
            objectFit="cover"
          />
        )}
        {/* Remote video (full screen) */}
        {Platform.OS === 'web' && (
          <video
            ref={remoteVideoRef as any}
            autoPlay
            playsInline
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover', backgroundColor: '#0F172A',
            } as any}
          />
        )}

        {/* If no remote stream yet, show placeholder */}
        {!remoteStream && (
          <View style={styles.videoPlaceholder}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <Text style={styles.voiceName}>{cleanPeerName}</Text>
            <Text style={styles.voiceStatus}>{getStatusText()}</Text>
          </View>
        )}

        {/* Local self-preview (floating pip) */}
        {Platform.OS === 'web' && localStream && (
          <View style={styles.localPip}>
            <video
              ref={localVideoRef as any}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                borderRadius: 12, transform: 'scaleX(-1)',
              } as any}
            />
            {callState?.isCameraOff && (
              <View style={styles.pipCameraOff}>
                <MaterialIcons name="videocam-off" size={20} color="#FFF" />
              </View>
            )}
          </View>
        )}
        {Platform.OS !== 'web' && localStream && NativeRTCView && (
          <View style={styles.localPip}>
            <NativeRTCView
              streamURL={(localStream as any).toURL()}
              style={StyleSheet.absoluteFillObject}
              objectFit="cover"
              mirror
            />
            {callState?.isCameraOff && (
              <View style={styles.pipCameraOff}>
                <MaterialIcons name="videocam-off" size={20} color="#FFF" />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleEndCall} statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.container}
        onPress={resetControlsTimer}
      >
        {/* Background: voice or video */}
        {isVideo ? renderVideoBackground() : renderVoiceBackground()}

        {/* Hidden audio element for remote voice playback on web */}
        {Platform.OS === 'web' && (
          <audio
            ref={remoteAudioRef as any}
            autoPlay
            playsInline
            style={{ display: 'none' } as any}
          />
        )}

        {/* Top bar (visible during controls) */}
        {showControls && (
          <View style={styles.topBar}>
            <View style={styles.topBarContent}>
              {isVideo ? (
                <>
                  <View style={styles.topLeft}>
                    <MaterialIcons name="videocam" size={18} color="#34D399" />
                    <Text style={styles.topName} numberOfLines={1}>{cleanPeerName}</Text>
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
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.topBackBtn}
                    onPress={handleEndCall}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialIcons name="keyboard-arrow-down" size={28} color="#94A3B8" />
                  </TouchableOpacity>
                  <View style={styles.securityBadge}>
                    <MaterialIcons name="lock" size={12} color="#64748B" />
                    <Text style={styles.securityText}>End-to-end encrypted</Text>
                  </View>
                  <View style={{ width: 28 }} />
                </>
              )}
            </View>
          </View>
        )}

        {/* Error overlay badge */}
        {cleanErrorMsg && !['Call was declined', 'No answer'].includes(cleanErrorMsg) && (
          <View style={styles.errorOverlay}>
            <MaterialIcons name="cloud-off" size={18} color="#F87171" />
            <Text style={styles.errorText}>{cleanErrorMsg}</Text>
          </View>
        )}

        {/* Bottom controls */}
        {showControls && (
          <View style={styles.bottomBar}>
            <View style={styles.controlsRow}>
              {/* Mic toggle */}
              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={[styles.controlBtn, callState?.isMuted && styles.controlBtnActive]}
                  onPress={() => engine.toggleMute()}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={callState?.isMuted ? 'mic-off' : 'mic'}
                    size={26}
                    color="#FFF"
                  />
                </TouchableOpacity>
                <Text style={styles.controlLabel}>
                  {callState?.isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </View>

              {/* Camera toggle (video calls only) */}
              {isVideo && (
                <View style={styles.controlItem}>
                  <TouchableOpacity
                    style={[styles.controlBtn, callState?.isCameraOff && styles.controlBtnActive]}
                    onPress={() => engine.toggleCamera()}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={callState?.isCameraOff ? 'videocam-off' : 'videocam'}
                      size={26}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                  <Text style={styles.controlLabel}>
                    {callState?.isCameraOff ? 'Camera On' : 'Camera Off'}
                  </Text>
                </View>
              )}

              {/* Switch call mode (voice ↔ video) */}
              {isConnected && (
                <View style={styles.controlItem}>
                  <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => engine.switchCallMode(isVideo ? 'voice' : 'video')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={isVideo ? 'phone' : 'videocam'}
                      size={26}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                  <Text style={styles.controlLabel}>
                    {isVideo ? 'Voice' : 'Video'}
                  </Text>
                </View>
              )}

              {/* End call */}
              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={styles.endCallBtn}
                  onPress={handleEndCall}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="call-end" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={[styles.controlLabel, { color: '#F87171' }]}>End</Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  // ── Voice Background ──
  voiceBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceGradient: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFF',
  },
  voiceName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 20,
    zIndex: 5,
    textAlign: 'center',
  },
  voiceStatus: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    zIndex: 5,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── Video Background ──
  videoBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localPip: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    elevation: 8,
  },
  pipCameraOff: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  // ── Top Bar ──
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 10,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBackBtn: {
    padding: 4,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  topName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextTop: {
    fontSize: 13,
    color: '#94A3B8',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34D399',
  },

  // ── Error ──
  errorOverlay: {
    position: 'absolute',
    top: 68,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    maxWidth: '88%',
    zIndex: 15,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FECACA',
    textAlign: 'center',
  },

  // ── Bottom Controls ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 36,
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  controlItem: {
    alignItems: 'center',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
  },
  controlLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 6,
    fontWeight: '500',
  },
  endCallBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#DC2626',
    elevation: 4,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
