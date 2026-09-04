import React from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Shadows, Spacing, Typography } from '../constants/theme';
import { Button, IconButton } from './ui';

interface PrescriptionQrModalProps {
  visible: boolean;
  medName: string;
  rxCode: string;
  onClose: () => void;
}

export const PrescriptionQrModal: React.FC<PrescriptionQrModalProps> = ({
  visible,
  medName,
  rxCode,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Digital Prescription QR</Text>
            <IconButton icon="close" size="sm" variant="neutral" onPress={onClose} />
          </View>

          <Text style={styles.medTitle}>{medName}</Text>
          <Text style={styles.helperText}>
            Show this QR code at any Jan Aushadhi or City Pharmacy for verified digital dispensing.
          </Text>

          <View style={styles.qrWrapper}>
            <Image
              source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=RURALCARE-${rxCode}` }}
              style={styles.qrImage}
            />
          </View>

          <Text style={styles.rxCodeText}>{rxCode}</Text>
          <Text style={styles.doctorSign}>Authorized by Dr. Anita Sharma (MBBS, MD)</Text>

          <Button label="Done" block onPress={onClose} style={styles.doneBtn} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: 'rgba(15, 28, 36, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.lg,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondary,
  },
  medTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  qrWrapper: {
    padding: 12,
    borderRadius: Radii.lg,
    borderWidth: 2,
    borderColor: Colors.primaryFixedDim,
    borderStyle: 'dashed',
    marginVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  rxCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 1,
  },
  doctorSign: {
    ...Typography.micro,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  doneBtn: {
    width: '100%',
  },
});
