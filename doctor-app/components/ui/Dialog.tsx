import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Portal, Dialog as PaperDialog } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Spacing } from '../../constants/theme';

interface AppDialogProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  message?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  dismissable?: boolean;
  children?: React.ReactNode;
}

export const AppDialog: React.FC<AppDialogProps> = ({
  visible,
  onClose,
  title,
  message,
  icon,
  iconColor = Colors.primary,
  dismissable = true,
  children,
}) => {
  return (
    <Portal>
      <PaperDialog
        visible={visible}
        onDismiss={onClose}
        dismissable={dismissable}
        style={styles.dialog}
      >
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: `${iconColor}1A` }]}>
            <MaterialIcons name={icon} size={26} color={iconColor} />
          </View>
        )}
        {title && <PaperDialog.Title style={styles.title}>{title}</PaperDialog.Title>}
        {message && (
          <PaperDialog.Content>
            <Text style={styles.message}>{message}</Text>
          </PaperDialog.Content>
        )}
        <PaperDialog.Actions style={styles.actions}>{children}</PaperDialog.Actions>
      </PaperDialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.secondary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: Spacing.xs,
  },
  actions: {
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
});
