import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * App-wide safety net: turns an uncaught render error into a recoverable screen
 * instead of a blank white crash, and logs it.
 *
 * ponytail: React's built-in error boundary + console.error — no Sentry/APM
 * dependency (or account, or ongoing cost) for a 3-user tool. Add remote error
 * aggregation only when crashes need tracking across users you can't just ask.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: null };

  // Pure — unit-tested directly, no renderer needed.
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // The one place a crash is recorded. Retrievable from the device/browser
    // console; swap for a remote sink here if aggregation is ever needed.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  private reset = () => {
    // On web a full reload is the reliable recovery (also re-runs boot repairs);
    // native just clears the boundary to re-mount the tree.
    if (Platform.OS === 'web') window.location.reload();
    else this.setState({ hasError: false, message: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>The app hit an unexpected error. Your data is safe on this device.</Text>
        {this.state.message ? <Text style={styles.detail}>{this.state.message}</Text> : null}
        <Pressable onPress={this.reset} style={styles.btn} accessibilityRole="button" accessibilityLabel="Reload the app">
          <Text style={styles.btnText}>Reload</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  detail: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  btn: { marginTop: spacing.md, backgroundColor: colors.brandDark, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  btnText: { ...typography.bodyMedium, color: colors.white },
});
