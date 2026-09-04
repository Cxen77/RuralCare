import React from 'react';
import { Pressable, StyleSheet, Switch as RNSwitch, SwitchProps, Text, View } from 'react-native';
import { Colors } from '../../constants/theme';

export const Toggle: React.FC<SwitchProps> = ({ value, onValueChange, disabled, ...rest }) => (
  <RNSwitch
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
    trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primary }}
    thumbColor={Colors.white}
    ios_backgroundColor={Colors.surfaceContainerHigh}
    {...rest}
  />
);

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  value,
  onChange,
  disabled = false,
}) => (
  <Pressable
    onPress={() => !disabled && onChange(!value)}
    style={styles.row}
    disabled={disabled}
  >
    <View style={styles.textWrap}>
      <Text style={[styles.label, disabled && styles.disabled]}>{label}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
    <Toggle value={value} onValueChange={onChange} disabled={disabled} />
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  description: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  disabled: {
    color: Colors.outline,
  },
});
