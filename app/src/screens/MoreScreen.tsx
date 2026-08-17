import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { isSupabaseConfigured } from '../lib/sync/supabaseClient';
import { useSessionStore } from '../store/sessionStore';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

function MenuRow({ icon, label, subtitle, onPress }: { icon: any; label: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function MoreScreen() {
  const navigation = useNavigation<any>();
  const userName = useSessionStore((s) => s.userName);
  const deviceName = useSessionStore((s) => s.deviceName);
  const cloudOn = isSupabaseConfigured();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
        </View>
        <View>
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileDevice}>{deviceName}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>WORKSPACE</Text>
      <View style={styles.group}>
        <MenuRow icon="pricetags-outline" label="Categories" subtitle="Manage Personal, Official, Travel, Urgent & custom categories" onPress={() => navigation.navigate('Categories')} />
        <MenuRow
          icon={cloudOn ? 'cloud-done-outline' : 'cloud-offline-outline'}
          label="Sync Status"
          subtitle={cloudOn ? 'Connected to Supabase' : 'Offline mode — Supabase not configured'}
          onPress={() => navigation.navigate('SyncStatus')}
        />
      </View>

      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.group}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0 (Phase 1)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Storage</Text>
          <Text style={styles.infoValue}>Local-first (SQLite)</Text>
        </View>
      </View>

      <Text style={styles.footer}>Built for Gaurav — managing Abhay Singavi's calendar, meetings, follow-ups and travel, all in one place.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h1, color: colors.white },
  profileName: { ...typography.h1, color: colors.textPrimary },
  profileDevice: { ...typography.caption, color: colors.textMuted },
  sectionLabel: { ...typography.tiny, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.sm, letterSpacing: 0.5 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.lg, ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...typography.bodyMedium, color: colors.textPrimary },
  rowSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { ...typography.body, color: colors.textSecondary },
  infoValue: { ...typography.bodyMedium, color: colors.textPrimary },
  footer: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
});
