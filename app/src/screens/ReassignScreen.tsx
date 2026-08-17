import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LabeledInput, Loading, PrimaryButton } from '../components/Common';
import { useLiveQuery } from '../db/useLiveQuery';
import { getTaskById, reassignTask } from '../db/repositories/tasks';
import { colors, spacing, typography } from '../theme/theme';

/** Req. #7: reassign a task while recording from/to, a reason, and a remark —
 * the full history this writes to is shown on the Task Detail screen's
 * "Reassignment History" section (task_reassignments, append-only). */
export function ReassignScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const taskId: string = route.params.taskId;

  const { data: task, loading } = useLiveQuery('tasks', () => getTaskById(taskId), [taskId]);
  const [toName, setToName] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading || !task) return <Loading />;

  async function handleReassign() {
    if (!toName.trim()) return Alert.alert('Enter the name of the new assignee');
    setSaving(true);
    try {
      await reassignTask(taskId, { toName, reason: reason || null, remark: remark || null });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.currentBox}>
        <Text style={styles.currentLabel}>Currently assigned to</Text>
        <Text style={styles.currentValue}>{task.assigned_to_name || 'Unassigned'}</Text>
      </View>

      <LabeledInput label="Reassign To" required value={toName} onChangeText={setToName} placeholder="e.g. Mohit" />
      <LabeledInput label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Client discussion required" />
      <LabeledInput label="Remark" value={remark} onChangeText={setRemark} placeholder="e.g. Please close before Monday" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />

      <PrimaryButton label={saving ? 'Reassigning...' : 'Confirm Reassignment'} onPress={handleReassign} disabled={saving} icon="swap-horizontal" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  currentBox: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  currentLabel: { ...typography.tiny, color: colors.textMuted },
  currentValue: { ...typography.h2, color: colors.textPrimary, marginTop: 2 },
});
