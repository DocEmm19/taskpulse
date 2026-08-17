import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

interface Props {
  label: string;
  count: number;
  color?: string;
  onPress?: () => void;
}

/** One clickable stat tile ("P1 – 5") for the Home dashboard's smart counts row
 * (Req. #30) — tapping opens the corresponding filtered task list. */
export function SmartCountTile({ label, count, color = colors.brand, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
      <Text style={[styles.count, { color }]}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minWidth: 84,
    alignItems: 'center',
    gap: 2,
    ...shadow.card,
  },
  count: { ...typography.h1, fontSize: 22 },
  label: { ...typography.tiny, color: colors.textSecondary, textTransform: 'uppercase' },
});
