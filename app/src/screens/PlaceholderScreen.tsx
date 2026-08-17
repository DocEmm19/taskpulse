import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/theme';

/** Temporary placeholder for screens not yet built in this build pass — kept
 * so the navigation shell compiles and is fully clickable end-to-end while
 * each real screen is built next, in the order tracked in the task list.
 * Reads {title, icon} from route.params, matching how React Navigation hands
 * a screen component its props (so it can be used directly as a Tab/Stack
 * `component` with `initialParams`, no wrapper needed). */
export function PlaceholderScreen({ route }: { route?: { params?: { title?: string; icon?: any } } }) {
  const title = route?.params?.title ?? 'Coming soon';
  const icon = route?.params?.icon ?? 'construct-outline';
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>This screen is being built next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.sm, padding: spacing.xl },
  title: { ...typography.h1, color: colors.textSecondary },
  subtitle: { ...typography.body, color: colors.textMuted },
});
