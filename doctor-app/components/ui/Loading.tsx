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
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
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

export const ClinicalAnimatedLoader: React.FC<{
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
}> = ({
  title = 'RuralCare • Doctor Portal',
  subtitle = 'Loading patient & clinical data…',
  showProgress = true,
}) => {
  const pulseScale = useSharedValue(1);
  const progressX = useSharedValue(-80);

  useEffect(() => {
    // Breathing pulse
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.96, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Continuous progress bar slide
    progressX.value = withRepeat(
      withTiming(180, { duration: 1400, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
  }, [pulseScale, progressX]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progressX.value }],
  }));

  return (
    <View style={styles.clinicalLoaderContainer}>
      {/* Clean Modern Medical Badge - No Circle Waves */}
      <Animated.View style={[styles.mainBadge, pulseStyle]}>
        <MaterialIcons name="medical-services" size={32} color={Colors.white} />
      </Animated.View>

      {/* Pill Tag */}
      <View style={styles.pillTag}>
        <View style={styles.liveDot} />
        <Text style={styles.pillText}>CLINICAL SYNC</Text>
      </View>

      {/* Title & Subtitle */}
      <Text style={styles.clinicalTitle}>{title}</Text>
      <Text style={styles.clinicalSubtitle}>{subtitle}</Text>

      {/* Smooth animated progress runner */}
      {showProgress && (
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarThumb, progressStyle]} />
        </View>
      )}
    </View>
  );
};

export const ClinicalLoadingScreen: React.FC<{
  title?: string;
  subtitle?: string;
}> = ({ title, subtitle }) => (
  <View style={styles.fullScreenCenter}>
    <ClinicalAnimatedLoader title={title} subtitle={subtitle} />
  </View>
);

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, label }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <ClinicalAnimatedLoader
          title={label || 'RuralCare • Doctor Portal'}
          subtitle="Loading patient & clinical data…"
        />
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
    backgroundColor: 'rgba(15, 28, 36, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  overlayCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    width: '88%',
    maxWidth: 340,
    ...Shadows.lg,
  },
  clinicalLoaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  mainBadge: {
    width: 64,
    height: 64,
    borderRadius: Radii.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    gap: 6,
    marginBottom: Spacing.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  clinicalTitle: {
    ...Typography.h3,
    color: Colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  clinicalSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  progressBarTrack: {
    width: 160,
    height: 4,
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radii.full,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  progressBarThumb: {
    width: 60,
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
  },
  fullScreenCenter: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
