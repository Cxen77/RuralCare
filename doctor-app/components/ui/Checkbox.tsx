import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Checkbox as PaperCheckbox } from 'react-native-paper';
import { Colors, Spacing } from '../../constants/theme';

interface CheckRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export const CheckRow: React.FC<CheckRowProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => (
  <Pressable
    onPress={() => !disabled && onChange(!checked)}
    style={styles.row}
    disabled={disabled}
    accessibilityRole="checkbox"
    accessibilityState={{ checked, disabled }}
  >
    <PaperCheckbox.Android status={checked ? 'checked' : 'unchecked'} disabled={disabled} />
    <View style={styles.textWrap}>
      <Text style={[styles.label, disabled && styles.disabled]}>{label}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  </Pressable>
);

interface CheckboxGroupProps {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({ options, values, onChange }) => (
  <View>
    {options.map((o) => {
      const checked = values.includes(o.value);
      return (
        <CheckRow
          key={o.value}
          label={o.label}
          checked={checked}
          onChange={(v) =>
            onChange(v ? [...values, o.value] : values.filter((x) => x !== o.value))
          }
        />
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
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
