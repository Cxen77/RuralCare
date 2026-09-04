import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../constants/theme';

interface DividerProps {
  inset?: number;
  style?: StyleProp<ViewStyle>;
}

export const Divider: React.FC<DividerProps> = ({ inset = 0, style }) => (
  <View style={[styles.divider, { marginHorizontal: inset }, style]} />
);

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: Colors.outlineLight,
  },
});
