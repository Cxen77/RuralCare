import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Card, Input } from '../components/ui';
import { Colors, Radii, Spacing, Typography } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

export const LoginScreen: React.FC = () => {
  const { login, signingIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !signingIn;

  const submit = () => {
    if (!canSubmit) return;
    login(email, password).catch(() => {
      // Surfaced through `error` from AuthContext.
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}>
            <MaterialIcons name="medical-services" size={34} color={Colors.white} />
          </View>
          <Text style={styles.title}>RuralCare for Doctors</Text>
          <Text style={styles.subtitle}>Sign in to see today's queue and issue prescriptions</Text>
        </View>

        <Card style={styles.card}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="doctor@ruralcare.dev"
            leadingIcon="mail-outline"
            keyboardType="email-address"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            leadingIcon="lock-outline"
            trailingIcon={revealed ? 'visibility-off' : 'visibility'}
            onTrailingIconPress={() => setRevealed((v) => !v)}
            secure={!revealed}
          />

          {error ? (
            <View style={styles.error}>
              <MaterialIcons name="error-outline" size={18} color={Colors.onErrorContainer} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={signingIn ? 'Signing in…' : 'Sign in'}
            onPress={submit}
            loading={signingIn}
            disabled={!canSubmit}
            block
            size="lg"
            style={styles.submit}
          />
        </Card>

        <Text style={styles.endpoint}>Connected to {API_BASE}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  brand: { alignItems: 'center', marginBottom: Spacing.xl },
  logo: {
    width: 68,
    height: 68,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.display, color: Colors.onSurface, textAlign: 'center' },
  subtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  card: { gap: Spacing.sm },
  submit: { marginTop: Spacing.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radii.md,
    padding: Spacing.sm,
  },
  errorText: { ...Typography.caption, color: Colors.onErrorContainer, flex: 1 },
  endpoint: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
