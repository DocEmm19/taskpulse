import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { priorityMeta, PriorityKey, radius, spacing, statusMeta, StatusKey, typography } from '../theme/theme';

export function PriorityBadge({ priority }: { priority: PriorityKey }) {
  const meta = priorityMeta[priority];
  return (
    <View style={[styles.pill, { backgroundColor: meta.soft }]}>
      <Text style={[styles.pillText, { color: meta.color }]}>{priority}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const meta = statusMeta[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.soft }]}>
      <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

export function CategoryPill({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '1A' }]}>
      <Text style={[styles.pillText, { color }]}>{name}</Text>
    </View>
  );
}

export function OverdueBadge({ days }: { days: number }) {
  return (
    <View style={[styles.pill, { backgroundColor: '#FEECEB' }]}>
      <Text style={[styles.pillText, { color: '#D92D20' }]}>
        🔴 Overdue by {days} {days === 1 ? 'Day' : 'Days'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    ...typography.tiny,
  },
});
