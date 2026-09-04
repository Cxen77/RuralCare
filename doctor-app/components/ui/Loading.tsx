import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Radii, Shadows, Spacing, Typography } from '../../constants/theme';

interface SpinnerProps {
  size?: number | 'small' | 'large';
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'large', color = Colors.primary }) => (
  <ActivityIndicator size={size} color={color} />
);

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 14,
  radius = Radii.sm,
  circle = false,
  style,
}) => {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height: circle ? (typeof width === 'number' ? width : height) : height,
          borderRadius: circle ? Radii.full : radius,
          backgroundColor: Colors.surfaceContainerHigh,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC = () => (
  <View style={styles.skeletonCard}>
    <Skeleton width={44} height={44} circle />
    <View style={styles.skeletonLines}>
      <Skeleton width="62%" height={13} />
      <Skeleton width="88%" height={10} />
      <Skeleton width="38%" height={10} />
    </View>
  </View>
);

interface LoadingOverlayProps {
  visible: boolean;
  label?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, label }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <Spinner />
        {label && <Text style={styles.overlayLabel}>{label}</Text>}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    borderRadius: Radii.lg,
    padding: Spacing.md,
  },
  skeletonLines: {
    flex: 1,
    gap: Spacing.sm + 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 28, 36, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm + 4,
    ...Shadows.lg,
  },
  overlayLabel: {
    ...Typography.bodyMedium,
    color: Colors.onSurface,
  },
});
