import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { TaskWithCategory } from '../types/models';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { CategoryPill, OverdueBadge, PriorityBadge, StatusBadge } from './Badges';
import { daysOverdue, daysPending, isOverdue } from '../db/repositories/tasks';

interface Props {
  task: TaskWithCategory;
  onPress: () => void;
}

export function TaskCard({ task, onPress }: Props) {
  const overdue = isOverdue(task);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.stripe, { backgroundColor: task.category_color }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
          {task.is_starred ? <Ionicons name="star" size={16} color={colors.warning} /> : null}
        </View>

        <View style={styles.badgeRow}>
          <CategoryPill name={task.category_name} color={task.category_color} />
          <PriorityBadge priority={task.priority} />
          {overdue ? <OverdueBadge days={daysOverdue(task.due_date!)} /> : <StatusBadge status={task.status} />}
        </View>

        {task.assigned_to_name ? (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>With: {task.assigned_to_name}</Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaTextMuted}>
            Pending Since: {format(new Date(task.pending_since), 'dd-MMM-yyyy')}
            {task.due_date ? `   ·   Due: ${format(new Date(task.due_date), 'dd-MMM-yyyy')}` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  stripe: { width: 4 },
  body: { flex: 1, padding: spacing.lg, gap: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textSecondary },
  metaTextMuted: { ...typography.caption, color: colors.textMuted },
});
