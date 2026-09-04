import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Pressable, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii, Typography } from '../../constants/theme';

type Tone = 'primary' | 'success' | 'navy' | 'danger';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  tone?: Tone;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: Colors.primary, fg: Colors.white },
  success: { bg: Colors.tertiary, fg: Colors.white },
  navy: { bg: Colors.secondary, fg: Colors.white },
  danger: { bg: Colors.error, fg: Colors.white },
};

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'primary',
  size = 'md',
  disabled = false,
  style,
}) => {
  const t = TONES[tone];
  const padY = size === 'sm' ? 6 : 8;
  const font = size === 'sm' ? Typography.micro : Typography.caption;
  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        { paddingVertical: padY },
        !selected && styles.unselected,
        selected && { backgroundColor: t.bg, borderColor: t.bg },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={iconSize}
          color={selected ? t.fg : Colors.onSurfaceVariant}
        />
      )}
      <Text
        style={[
          font,
          { color: selected ? t.fg : Colors.onSurfaceVariant },
          selected && styles.labelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unselected: {
    backgroundColor: Colors.surfaceContainerLow,
    borderColor: Colors.outlineLight,
  },
  labelSelected: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
});
