import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ScreenContainer, EmptyState, Loading, PrimaryButton } from '../components/Common';
import { useLiveQuery } from '../db/useLiveQuery';
import { listTravelPlans } from '../db/repositories/taskExtras';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

export function TravelScreen() {
  const navigation = useNavigation<any>();
  const { data: plans, loading } = useLiveQuery(['travel_plans', 'tasks'], listTravelPlans);

  const upcoming = (plans ?? []).filter((p) => new Date(p.travel_date).getTime() >= Date.now() - 24 * 3600 * 1000);
  const past = (plans ?? []).filter((p) => new Date(p.travel_date).getTime() < Date.now() - 24 * 3600 * 1000);

  return (
    <ScreenContainer>
      <FlatList
        data={[...upcoming, ...past]}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Travel Plans</Text>
            <PrimaryButton label="+ Plan Travel" onPress={() => navigation.navigate('NewTask', { presetCategory: 'Travel' })} />
          </View>
        }
        renderItem={({ item }) => {
          const isPast = new Date(item.travel_date).getTime() < Date.now() - 24 * 3600 * 1000;
          return (
            <Pressable style={[styles.card, isPast && { opacity: 0.6 }]} onPress={() => navigation.navigate('TaskDetail', { taskId: item.task_id })}>
              <View style={styles.cardHeader}>
                <Ionicons name="airplane" size={20} color={colors.categoryTravel} />
                <Text style={styles.city}>{item.city}</Text>
              </View>
              <Text style={styles.taskTitle} numberOfLines={1}>{item.task_title}</Text>
              <Text style={styles.dates}>
                {format(new Date(item.travel_date), 'dd-MMM-yyyy')}
                {item.return_date ? ` → ${format(new Date(item.return_date), 'dd-MMM-yyyy')}` : ''}
              </Text>
              {item.purpose ? <Text style={styles.purpose}>{item.purpose}</Text> : null}
              {item.hotel_name ? (
                <View style={styles.metaRow}>
                  <Ionicons name="bed-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText}>{item.hotel_name}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={loading ? <Loading /> : <EmptyState icon="airplane-outline" title="No travel planned" subtitle="Tap + Plan Travel to add a trip." />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, paddingBottom: 120 },
  headerRow: { marginBottom: spacing.md, gap: spacing.md },
  heading: { ...typography.display, fontSize: 22, color: colors.textPrimary },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  city: { ...typography.h1, color: colors.textPrimary },
  taskTitle: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: 2 },
  dates: { ...typography.caption, color: colors.brand, marginBottom: spacing.xs },
  purpose: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted },
});
