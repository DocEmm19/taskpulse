import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionCard } from '../components/Common';
import { useLiveQuery } from '../db/useLiveQuery';
import { getDb } from '../db/database';
import { isSupabaseConfigured } from '../lib/sync/supabaseClient';
import { colors, spacing, typography } from '../theme/theme';

async function getQueueCounts() {
  const db = await getDb();
  const pending = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM sync_queue WHERE status IN ('queued','in_flight')");
  const failed = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM sync_queue WHERE status = 'failed'");
  return { pending: pending?.c ?? 0, failed: failed?.c ?? 0 };
}

export function SyncStatusScreen() {
  const configured = isSupabaseConfigured();
  const { data } = useLiveQuery('sync_queue', getQueueCounts);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <SectionCard title="Cloud Sync" icon={configured ? 'cloud-done-outline' : 'cloud-offline-outline'}>
        <View style={styles.statusRow}>
          <Ionicons name={configured ? 'checkmark-circle' : 'information-circle'} size={20} color={configured ? colors.success : colors.warning} />
          <Text style={styles.statusText}>{configured ? 'Connected to a Supabase project' : 'Running fully offline — no Supabase project configured yet'}</Text>
        </View>
        {!configured && (
          <Text style={styles.hint}>
            The app works completely without this — every feature works offline. To sync across devices, create a Supabase project and add its URL and anon key
            as EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. See SUPABASE_SETUP.md in the project for step-by-step instructions.
          </Text>
        )}
      </SectionCard>

      <SectionCard title="Pending Changes" icon="time-outline">
        <Text style={styles.statNumber}>{data?.pending ?? 0}</Text>
        <Text style={styles.statLabel}>changes waiting to sync</Text>
      </SectionCard>

      {(data?.failed ?? 0) > 0 && (
        <SectionCard title="Needs Attention" icon="alert-circle-outline">
          <Text style={[styles.statNumber, { color: colors.danger }]}>{data?.failed}</Text>
          <Text style={styles.statLabel}>changes failed and will retry automatically</Text>
        </SectionCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  statusText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
  statNumber: { ...typography.display, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textMuted },
});
