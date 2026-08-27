import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

/** The persistent "+ NEW TASK" button — required to be reachable from every
 * tab in one tap (Req. #33/#37). Rendered once by RootNavigator, floating
 * above the tab bar. */
export function NewTaskFab() {
  const navigation = useNavigation<any>();
  return (
    <Pressable
      onPress={() => navigation.navigate('NewTask')}
      style={({ pressed }) => [styles.fab, { transform: [{ scale: pressed ? 0.97 : 1 }] }, pressed && { opacity: 0.95 }]}
      accessibilityLabel="Create new task"
    >
      <Ionicons name="add" size={22} color={colors.white} />
      <Text style={styles.label}>NEW TASK</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 84,
    backgroundColor: colors.brandDark, // deeper cobalt fill → white label clears WCAG AA
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    ...shadow.glow, // restrained cobalt bloom — the one place the accent glows
  },
  label: { ...typography.bodyMedium, color: colors.white, letterSpacing: 0.3 },
});
