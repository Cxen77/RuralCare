import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Typography } from '../../constants/theme';

type Tone = 'primary' | 'success' | 'danger' | 'navy';

interface BadgeProps {
  count?: number;
  label?: string;
  tone?: Tone;
  dot?: boolean;
  max?: number;
}

const TONES: Record<Tone, string> = {
  primary: Colors.primary,
  success: '#22C55E',
  danger: Colors.error,
  navy: Colors.secondary,
};

export const Badge: React.FC<BadgeProps> = ({ count, label, tone = 'danger', dot = false, max = 99 }) => {
  if (dot) {
    return <View style={[styles.dot, { backgroundColor: TONES[tone] }]} />;
  }
  const text = label ?? (count !== undefined ? (count > max ? `${max}+` : `${count}`) : '');
  return (
    <View style={[styles.badge, { backgroundColor: TONES[tone] }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
