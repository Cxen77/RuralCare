import React from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Shadows, Spacing } from '../constants/theme';
import { Button } from './ui';

interface EmergencySosModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EmergencySosModal: React.FC<EmergencySosModalProps> = ({ visible, onClose }) => {
  const [count, setCount] = React.useState(5);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (visible) {
      setCount(5);
      interval = setInterval(() => {
        setCount(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            onClose();
            Alert.alert('Emergency Ambulance Alert', 'Connecting to 108 Emergency Ambulance. GPS location broadcasted to Ramnagar PHC and emergency contacts.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.radarCircle}>
            <Text style={styles.countdownText}>{count}</Text>
          </View>

          <Text style={styles.heading}>CONNECTING SOS EMERGENCY</Text>
          <Text style={styles.subtext}>
            Dialing <Text style={{ fontWeight: '700', color: Colors.secondary }}>108 National Ambulance</Text> and broadcasting GPS coordinates to Ramnagar PHC & village contacts.
          </Text>

          <Button
            label="Call 108 Immediately"
            icon="phone-in-talk"
            variant="danger"
            block
            onPress={() => {
              onClose();
              Alert.alert('Dialing 108', 'Calling National Emergency Ambulance Service (108)...');
            }}
            style={styles.callNowBtn}
          />

          <Button
            label="Cancel SOS"
            variant="outline"
            block
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 28, 36, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sos,
  },
  radarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    borderWidth: 4,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  countdownText: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.error,
  },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.errorDark,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  callNowBtn: {
    width: '100%',
    marginBottom: Spacing.xs,
  },
});
