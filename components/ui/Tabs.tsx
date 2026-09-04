import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radii } from '../../constants/theme';

export interface TabOption {
  value: string;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

interface TabsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

export const Tabs: React.FC<TabsProps> = ({ options, value, onChange, style }) => {
  const [widths, setWidths] = useState<number[]>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const offset = useSharedValue(0);
  const indicatorWidth = widths[activeIndex] ?? 0;

  useEffect(() => {
    if (!widths.length) return;
    const left = widths.slice(0, activeIndex).reduce((a, b) => a + b, 0);
    offset.value = withTiming(left, { duration: 220 });
  }, [activeIndex, widths, offset]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View style={[styles.container, style]}>
      {indicatorWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: indicatorWidth },
            indicatorStyle,
          ]}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            onLayout={(e) => {
              const width = e.nativeEvent?.layout?.width;
              if (typeof width === 'number') {
                const idx = options.indexOf(option);
                setWidths((prev) => {
                  const next = [...prev];
                  next[idx] = width;
                  return next;
                });
              }
            }}
            style={styles.segment}
          >
            {option.icon && (
              <MaterialIcons
                name={option.icon}
                size={16}
                color={active ? Colors.primary : Colors.textSecondary}
              />
            )}
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.outlineLight,
    padding: 3,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: Radii.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primaryFixedDim,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
