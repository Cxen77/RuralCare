import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii } from '../../constants/theme';

type Variant = 'neutral' | 'dangerSoft' | 'primarySoft' | 'primary' | 'plain';
type Size = 'xs' | 'sm' | 'md';

interface IconButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  size?: Size;
  variant?: Variant;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<Size, { box: number; icon: number }> = {
  xs: { box: 28, icon: 15 },
  sm: { box: 32, icon: 18 },
  md: { box: 40, icon: 22 },
};

const VARIANTS: Record<Variant, { bg?: string; fg: string; border?: string }> = {
  neutral: { bg: Colors.surfaceContainer, fg: Colors.onSurfaceVariant },
  dangerSoft: { bg: '#FEE2E2', fg: Colors.error, border: '#FECACA' },
  primarySoft: { bg: Colors.primaryLight, fg: Colors.primary },
  primary: { bg: Colors.primary, fg: Colors.white },
  plain: { fg: Colors.onSurfaceVariant },
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 'sm',
  variant = 'neutral',
  color,
  disabled = false,
  style,
}) => {
  const s = SIZES[size];
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.box,
        { width: s.box, height: s.box, borderRadius: s.box / 2 },
        v.bg && { backgroundColor: v.bg },
        v.border && { borderWidth: 1, borderColor: v.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <MaterialIcons name={icon} size={s.icon} color={color ?? v.fg} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
});
