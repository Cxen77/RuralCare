import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TextInput as PaperInput, HelperText } from 'react-native-paper';
import { Colors, Radii, Spacing } from '../../constants/theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  onTrailingIconPress?: () => void;
  errorText?: string;
  helperText?: string;
  multiline?: boolean;
  numberOfLines?: number;
  secure?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address' | 'number-pad';
  disabled?: boolean;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  leadingIcon,
  trailingIcon,
  onTrailingIconPress,
  errorText,
  helperText,
  multiline = false,
  numberOfLines,
  secure = false,
  keyboardType = 'default',
  disabled = false,
  editable = true,
  style,
}) => {
  return (
    <>
      <PaperInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        left={
          leadingIcon ? (
            <PaperInput.Icon
              icon={({ size, color }) => (
                <MaterialIcons name={leadingIcon as any} size={size || 20} color={color || Colors.textSecondary} />
              )}
            />
          ) : undefined
        }
        right={
          trailingIcon ? (
            <PaperInput.Icon
              icon={({ size, color }) => (
                <MaterialIcons name={trailingIcon as any} size={size || 20} color={color || Colors.textSecondary} />
              )}
              onPress={onTrailingIconPress}
            />
          ) : undefined
        }
        multiline={multiline}
        numberOfLines={numberOfLines}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        disabled={disabled}
        editable={editable}
        outlineColor={errorText ? Colors.error : Colors.outlineLight}
        activeOutlineColor={errorText ? Colors.error : Colors.primary}
        error={!!errorText}
        style={[styles.input, multiline && styles.multilineInput, style]}
        outlineStyle={styles.outline}
      />
      {(!!errorText || !!helperText) && (
        <HelperText
          type={errorText ? 'error' : 'info'}
          visible
          padding="none"
          style={[styles.helper, errorText && styles.helperError]}
        >
          {errorText || helperText}
        </HelperText>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.white,
    fontSize: 14,
    minHeight: 48,
  },
  outline: {
    borderRadius: Radii.sm,
    borderColor: Colors.outlineLight,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
  },
  helper: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  helperError: {
    color: Colors.error,
  },
});
