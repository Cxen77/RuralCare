import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../constants/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actionLabel, onAction }) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    {actionLabel && (
      <Pressable onPress={onAction} hitSlop={8}>
        <Text style={styles.action}>{actionLabel}</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    ...Typography.h3,
    color: Colors.secondary,
    letterSpacing: -0.2,
  },
  action: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
