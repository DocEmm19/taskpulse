import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { ScreenContainer, EmptyState, Loading } from '../components/Common';
import { useLiveQuery } from '../db/useLiveQuery';
import { listCalendarEventsBetween, listMeetingsBetween } from '../db/repositories/taskExtras';
import { listTasks } from '../db/repositories/tasks';
import { colors, radius, spacing, typography } from '../theme/theme';

type AgendaItem = {
  id: string;
  time: Date;
  endTime?: Date | null;
  title: string;
  subtitle?: string | null;
  kind: 'meeting' | 'calendar_event' | 'task_due';
  taskId?: string | null;
};

const DAYS_VISIBLE = 14;

export function CalendarScreen() {
  const navigation = useNavigation<any>();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const strip = useMemo(() => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(startOfDay(new Date()), i - 2)), []);
  const dayStart = selectedDate.toISOString();
  const dayEnd = addDays(selectedDate, 1).toISOString();

  const meetings = useLiveQuery('meetings', () => listMeetingsBetween(dayStart, dayEnd), [dayStart, dayEnd]);
  const events = useLiveQuery('calendar_events', () => listCalendarEventsBetween(dayStart, dayEnd), [dayStart, dayEnd]);
  const dueTasks = useLiveQuery(['tasks'], () => listTasks({ dateFilter: undefined }), []);

  const tasksDueThisDay = (dueTasks.data ?? []).filter((t) => t.due_date && isSameDay(new Date(t.due_date), selectedDate));

  const agenda: AgendaItem[] = useMemo(() => {
    const items: AgendaItem[] = [];
    (meetings.data ?? []).forEach((m) =>
      items.push({ id: `m_${m.id}`, time: new Date(m.start_time), endTime: m.end_time ? new Date(m.end_time) : null, title: m.title, subtitle: m.location ?? m.meeting_link, kind: 'meeting', taskId: m.task_id })
    );
    (events.data ?? []).forEach((e) =>
      items.push({ id: `e_${e.id}`, time: new Date(e.start_time), endTime: new Date(e.end_time), title: e.title, subtitle: e.location ?? e.meeting_link, kind: 'calendar_event', taskId: e.task_id })
    );
    tasksDueThisDay.forEach((t) =>
      items.push({ id: `t_${t.id}`, time: new Date(t.due_date!), title: t.title, subtitle: `${t.priority} · Due`, kind: 'task_due', taskId: t.id })
    );
    return items.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [meetings.data, events.data, tasksDueThisDay]);

  const loading = meetings.loading || events.loading;

  return (
    <ScreenContainer>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {strip.map((d) => {
          const selected = isSameDay(d, selectedDate);
          const today = isSameDay(d, new Date());
          return (
            <Pressable key={d.toISOString()} onPress={() => setSelectedDate(d)} style={[styles.dayChip, selected && styles.dayChipSelected]}>
              <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>{format(d, 'EEE')}</Text>
              <Text style={[styles.dayNumber, selected && styles.dayLabelSelected, today && !selected && { color: colors.brand }]}>{format(d, 'd')}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.heading}>{format(selectedDate, 'EEEE, dd MMMM yyyy')}</Text>

      <FlatList
        data={agenda}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.agendaRow}
            onPress={() => item.taskId && navigation.navigate('TaskDetail', { taskId: item.taskId })}
          >
            <View style={styles.timeCol}>
              <Text style={styles.timeText}>{format(item.time, 'h:mm a')}</Text>
            </View>
            <View style={[styles.agendaBar, { backgroundColor: kindColor(item.kind) }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.agendaTitleRow}>
                <Ionicons name={kindIcon(item.kind)} size={16} color={kindColor(item.kind)} />
                <Text style={styles.agendaTitle} numberOfLines={1}>{item.title}</Text>
              </View>
              {item.subtitle ? <Text style={styles.agendaSubtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={loading ? <Loading /> : <EmptyState icon="calendar-outline" title="Nothing scheduled" subtitle="No meetings, events, or due tasks for this day." />}
      />
    </ScreenContainer>
  );
}

function kindColor(kind: AgendaItem['kind']) {
  if (kind === 'meeting') return colors.brand;
  if (kind === 'calendar_event') return colors.categoryPersonal;
  return colors.p2;
}
function kindIcon(kind: AgendaItem['kind']): any {
  if (kind === 'meeting') return 'videocam-outline';
  if (kind === 'calendar_event') return 'calendar-outline';
  return 'alert-circle-outline';
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  dayChip: { alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, minWidth: 48, backgroundColor: colors.surface },
  dayChipSelected: { backgroundColor: colors.brand },
  dayLabel: { ...typography.tiny, color: colors.textMuted },
  dayNumber: { ...typography.bodyMedium, color: colors.textPrimary },
  dayLabelSelected: { color: colors.white },
  heading: { ...typography.h2, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: 0, paddingBottom: 120 },
  agendaRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, alignItems: 'center', gap: spacing.sm },
  timeCol: { width: 76 },
  timeText: { ...typography.captionMedium, color: colors.textSecondary },
  agendaBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  agendaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  agendaTitle: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  agendaSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
