/**
 * IncomingCallModal – Full-screen incoming call notification.
 *
 * Shows caller info, animated pulse, and accept/decline buttons.
 * WhatsApp-style dark UI with green accept / red decline buttons.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Vibration, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { IncomingCallInfo, CallType } from '../../services/communication/WebRTCCallingEngine';

interface IncomingCallModalProps {
  visible: boolean;
  callInfo: IncomingCallInfo | null;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible, callInfo, onAccept, onDecline,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideUpAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      // Start pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();

      // Slide up buttons
      Animated.spring(slideUpAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();

      // Vibrate on native
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500], true);
      }

      return () => {
        pulse.stop();
        if (Platform.OS !== 'web') Vibration.cancel();
      };
    } else {
      slideUpAnim.setValue(40);
    }
  }, [visible]);

  if (!callInfo) return null;

  const isVideo = callInfo.callType === 'video';
  const callerInitial = (callInfo.callerName || '?').charAt(0).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top label */}
          <View style={styles.topLabel}>
            <MaterialIcons name={isVideo ? 'videocam' : 'call'} size={16} color="#34D399" />
            <Text style={styles.topLabelText}>
              Incoming {isVideo ? 'Video' : 'Voice'} Call
            </Text>
          </View>

          {/* Caller info */}
          <View style={styles.callerSection}>
            {/* Pulse rings */}
            <Animated.View style={[styles.ring, styles.ring3, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: Animated.multiply(pulseAnim, 0.85) }] }]} />
            <Animated.View style={[styles.ring, styles.ring1, { transform: [{ scale: Animated.multiply(pulseAnim, 0.7) }] }]} />

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{callerInitial}</Text>
            </View>
          </View>

          <Text style={styles.callerName}>{callInfo.callerName}</Text>
          <Text style={styles.callerRole}>
            {callInfo.callerRole === 'DOCTOR' ? '👨‍⚕️ Doctor' : '🏥 Patient'}
          </Text>

          {/* Action buttons */}
          <Animated.View style={[styles.actions, { transform: [{ translateY: slideUpAnim }] }]}>
            {/* Decline */}
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.7}>
              <View style={styles.declineBtnInner}>
                <MaterialIcons name="call-end" size={30} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept */}
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.7}>
              <View style={styles.acceptBtnInner}>
                <MaterialIcons name={isVideo ? 'videocam' : 'call'} size={30} color="#FFF" />
              </View>
              <Text style={styles.actionLabel}>Accept</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  topLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 28,
  },
  topLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34D399',
  },

  callerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  ring1: {
    width: 120,
    height: 120,
    borderColor: 'rgba(8, 127, 140, 0.5)',
  },
  ring2: {
    width: 150,
    height: 150,
    borderColor: 'rgba(8, 127, 140, 0.3)',
  },
  ring3: {
    width: 180,
    height: 180,
    borderColor: 'rgba(8, 127, 140, 0.15)',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#087F8C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },

  callerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 4,
  },
  callerRole: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 32,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    width: '100%',
  },
  declineBtn: {
    alignItems: 'center',
    gap: 8,
  },
  declineBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  acceptBtn: {
    alignItems: 'center',
    gap: 8,
  },
  acceptBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
