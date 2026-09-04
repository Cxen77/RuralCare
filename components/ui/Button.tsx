import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'soft' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHTS: Record<Size, number> = { sm: 36, md: 46, lg: 54 };
const FONT_SIZES: Record<Size, number> = { sm: 12, md: 14, lg: 15 };

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: Colors.primary, fg: Colors.white },
  secondary: { bg: Colors.secondary, fg: Colors.white },
  soft: { bg: Colors.primaryLight, fg: Colors.primary },
  outline: { bg: Colors.white, fg: Colors.onSurfaceVariant, border: Colors.outlineLight },
  danger: { bg: Colors.error, fg: Colors.white },
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  block = false,
  style,
}) => {
  const v = VARIANTS[variant];
  return (
    <PaperButton
      mode="contained"
      onPress={onPress}
      icon={
        icon
          ? ({ size: iconSize, color: iconColor }) => (
              <MaterialIcons name={icon as any} size={iconSize || 18} color={iconColor || v.fg} />
            )
          : undefined
      }
      loading={loading}
      disabled={disabled}
      uppercase={false}
      buttonColor={v.bg}
      textColor={v.fg}
      style={[
        styles.base,
        { height: HEIGHTS[size] },
        !block && styles.inline,
        v.border && styles.bordered,
        v.border && { borderColor: v.border },
        variant === 'primary' && Shadows.md,
        disabled && styles.disabledShadow,
        style,
      ]}
      contentStyle={styles.content}
      labelStyle={[styles.label, { fontSize: FONT_SIZES[size], color: v.fg }]}
    >
      {label}
    </PaperButton>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.md,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  bordered: {
    borderWidth: 1,
  },
  content: {
    height: '100%',
    paddingHorizontal: Spacing.md,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  disabledShadow: {
    elevation: 0,
    boxShadow: 'none',
  },
});
