import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { ScreenContainer, EmptyState, Loading, Chip } from '../components/Common';
import { TaskCard } from '../components/TaskCard';
import { SmartCountTile } from '../components/SmartCountTile';
import { useLiveQuery } from '../db/useLiveQuery';
import { listTasks, getSmartCounts } from '../db/repositories/tasks';
import { listCategories } from '../db/repositories/categories';
import { listUpcomingMeetings, listCalendarEventsBetween } from '../db/repositories/taskExtras';
import { colors, spacing, typography } from '../theme/theme';
import { useSessionStore } from '../store/sessionStore';
import { Ionicons } from '@expo/vector-icons';

function startEndOfToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const userName = useSessionStore((s) => s.userName);
  const [category, setCategory] = useState('All');

  const categories = useLiveQuery('task_categories', listCategories);
  const counts = useLiveQuery(['tasks', 'meetings'], getSmartCounts);
  const tasks = useLiveQuery(['tasks', 'task_categories'], () => listTasks({ category }), [category]);
  const { start, end } = useMemo(startEndOfToday, []);
  const todayEvents = useLiveQuery('calendar_events', () => listCalendarEventsBetween(start, end), [start, end]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const categoryChips = ['All', ...(categories.data?.map((c) => c.name) ?? [])];

  return (
    <ScreenContainer>
      <FlatList
        data={tasks.data ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { tasks.reload(); counts.reload(); todayEvents.reload(); }} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.greeting}>{greeting}, {userName}</Text>
              <Text style={styles.dateText}>{format(new Date(), 'EEEE, dd MMMM yyyy')}</Text>
            </View>

            {counts.data && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countsRow}>
                <SmartCountTile label="P1" count={counts.data.p1} color={colors.p1} onPress={() => navigation.navigate('Tasks', { priority: 'P1' })} />
                <SmartCountTile label="P2" count={counts.data.p2} color={colors.p2} onPress={() => navigation.navigate('Tasks', { priority: 'P2' })} />
                <SmartCountTile label="P3" count={counts.data.p3} color={colors.p3} onPress={() => navigation.navigate('Tasks', { priority: 'P3' })} />
                <SmartCountTile label="Overdue" count={counts.data.overdue} color={colors.danger} onPress={() => navigation.navigate('Tasks', { dateFilter: 'overdue' })} />
                <SmartCountTile label="Today" count={counts.data.today} color={colors.brand} onPress={() => navigation.navigate('Tasks', { dateFilter: 'today' })} />
                <SmartCountTile label="Travel" count={counts.data.travel} color={colors.categoryTravel} onPress={() => navigation.navigate('Travel')} />
                <SmartCountTile label="Meetings" count={counts.data.meetings} color={colors.categoryPersonal} onPress={() => navigation.navigate('Calendar')} />
              </ScrollView>
            )}

            {todayEvents.data && todayEvents.data.length > 0 && (
              <View style={styles.todaySection}>
                <Text style={styles.sectionLabel}>TODAY'S MEETINGS</Text>
                {todayEvents.data.map((ev) => (
                  <View key={ev.id} style={styles.meetingRow}>
                    <Ionicons name="time-outline" size={16} color={colors.brand} />
                    <Text style={styles.meetingTime}>{format(new Date(ev.start_time), 'h:mm a')}</Text>
                    <Text style={styles.meetingTitle} numberOfLines={1}>{ev.title}</Text>
                  </View>
                ))}
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {categoryChips.map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>PENDING TASKS</Text>
          </View>
        }
        renderItem={({ item }) => <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })} />}
        ListEmptyComponent={
          tasks.loading ? <Loading /> : <EmptyState icon="checkmark-done-circle-outline" title="Nothing pending" subtitle="You're all caught up. Tap + NEW TASK to add one." />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, paddingBottom: 120 },
  header: { marginBottom: spacing.lg },
  greeting: { ...typography.display, color: colors.textPrimary },
  dateText: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  countsRow: { gap: spacing.sm, paddingBottom: spacing.md },
  todaySection: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  meetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  meetingTime: { ...typography.captionMedium, color: colors.brand, width: 72 },
  meetingTitle: { ...typography.body, color: colors.textPrimary, flex: 1 },
  chipsRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  sectionLabel: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm, letterSpacing: 0.5 },
});
