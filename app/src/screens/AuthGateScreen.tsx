import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LabeledInput, PrimaryButton, SecondaryButton } from '../components/Common';
import { signInWithPassword } from '../lib/sync/auth';
import { isWeb } from '../lib/platform';
import { colors, spacing, typography } from '../theme/theme';

/**
 * Only ever shown when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are set AND there is
 * no existing Supabase session (see App.tsx). If Supabase isn't configured,
 * the app skips this entirely and runs on the local-only profile — this
 * screen exists solely so cloud sync has a real, stable auth.uid() to key
 * Row-Level Security off (ARCHITECTURE.md §5.3), not as a v1 requirement.
 *
 * Invite-only: accounts are provisioned by the admin in the Supabase
 * dashboard, so this is sign-in only — there is no public sign-up.
 */
export function AuthGateScreen({
  onSignedIn,
  onSkip,
}: {
  onSignedIn: (userId: string, name: string | null) => void;
  onSkip: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return Alert.alert('Enter your email and password');
    setLoading(true);
    try {
      const signedInUser = await signInWithPassword(email.trim(), password);
      if (signedInUser) onSignedIn(signedInUser.id, signedInUser.name);
      else Alert.alert('Could not sign in', 'Please check your email and password and try again.');
    } catch (e) {
      Alert.alert('Could not sign in', String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Ionicons name="cloud-done-outline" size={40} color={colors.brand} style={{ marginBottom: spacing.md }} />
        <Text style={styles.title}>Sign in to TaskPulse</Text>
        <Text style={styles.subtitle}>Accounts are created by your admin.</Text>

        <LabeledInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <LabeledInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <PrimaryButton label={loading ? 'Please wait...' : 'Sign In'} onPress={submit} disabled={loading} />
        {/* Offline "skip" is native-only: on web, sign-in is required (shared cloud workspace). */}
        {!isWeb && (
          <>
            <View style={{ height: spacing.lg }} />
            <SecondaryButton label="Skip for now — use offline" icon="cloud-offline-outline" color={colors.textMuted} onPress={onSkip} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: 80 },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
});
