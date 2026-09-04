import React from 'react';
import { Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Colors, Radii, Shadows, Spacing } from '../../constants/theme';

type Elevation = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  onPress?: () => void;
  padding?: number;
  radius?: number;
  bordered?: boolean;
  elevation?: Elevation;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  onPress,
  padding = Spacing.md,
  radius = Radii.lg,
  bordered = true,
  elevation = 'sm',
  style,
  children,
}) => {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { padding, borderRadius: radius },
    bordered && styles.bordered,
    elevation !== 'none' && Shadows[elevation],
    style,
  ];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: Colors.surfaceContainerHigh }}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  bordered: {
    borderWidth: 1,
    borderColor: Colors.outlineLight,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
