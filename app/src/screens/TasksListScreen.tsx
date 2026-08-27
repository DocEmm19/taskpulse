import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, EmptyState, Loading, Chip } from '../components/Common';
import { TaskCard } from '../components/TaskCard';
import { useLiveQuery } from '../db/useLiveQuery';
import { listTasks, TaskFilters } from '../db/repositories/tasks';
import { listCategories } from '../db/repositories/categories';
import { colors, spacing, typography } from '../theme/theme';

const PRIORITIES = ['P1', 'P2', 'P3'] as const;
const STATUSES = ['pending', 'in_progress', 'completed', 'on_hold', 'reassigned'] as const;
const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'this_week', label: 'This Week' },
  { key: 'overdue', label: 'Overdue' },
] as const;

export function TasksListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TaskFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (route.params) {
      setFilters((f) => ({ ...f, ...route.params }));
      navigation.setParams({ priority: undefined, dateFilter: undefined, status: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.priority, route.params?.dateFilter, route.params?.status]);

  const categories = useLiveQuery('task_categories', listCategories);
  const effectiveFilters: TaskFilters = { ...filters, search, includeCompleted: filters.status === 'completed' || filters.status === 'all' };
  const tasks = useLiveQuery(['tasks', 'task_categories'], () => listTasks(effectiveFilters), [JSON.stringify(effectiveFilters)]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <ScreenContainer>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search task, person, company, city, email..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        <Ionicons
          name={showFilters ? 'options' : 'options-outline'}
          size={20}
          color={activeFilterCount > 0 ? colors.brand : colors.textMuted}
          onPress={() => setShowFilters((v) => !v)}
        />
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filterGroupLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="All" selected={!filters.category || filters.category === 'All'} onPress={() => setFilters((f) => ({ ...f, category: null }))} />
            {categories.data?.map((c) => (
              <Chip key={c.id} label={c.name} selected={filters.category === c.name} onPress={() => setFilters((f) => ({ ...f, category: c.name }))} />
            ))}
          </ScrollView>

          <Text style={styles.filterGroupLabel}>PRIORITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="All" selected={!filters.priority} onPress={() => setFilters((f) => ({ ...f, priority: null }))} />
            {PRIORITIES.map((p) => (
              <Chip key={p} label={p} selected={filters.priority === p} onPress={() => setFilters((f) => ({ ...f, priority: p }))} />
            ))}
          </ScrollView>

          <Text style={styles.filterGroupLabel}>STATUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="All" selected={!filters.status || filters.status === 'all'} onPress={() => setFilters((f) => ({ ...f, status: null }))} />
            {STATUSES.map((s) => (
              <Chip key={s} label={s.replace('_', ' ')} selected={filters.status === s} onPress={() => setFilters((f) => ({ ...f, status: s }))} />
            ))}
          </ScrollView>

          <Text style={styles.filterGroupLabel}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="Any" selected={!filters.dateFilter} onPress={() => setFilters((f) => ({ ...f, dateFilter: null }))} />
            {DATE_FILTERS.map((d) => (
              <Chip key={d.key} label={d.label} selected={filters.dateFilter === d.key} onPress={() => setFilters((f) => ({ ...f, dateFilter: d.key }))} />
            ))}
          </ScrollView>

          {activeFilterCount > 0 && (
            <Chip label="Clear filters" onPress={() => setFilters({})} color={colors.danger} />
          )}
        </View>
      )}

      <FlatList
        data={tasks.data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => <TaskCard task={item} index={index} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })} />}
        ListEmptyComponent={
          tasks.loading ? <Loading /> : <EmptyState icon="search-outline" title="No tasks match" subtitle="Try adjusting your search or filters." />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary },
  filtersPanel: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  filterGroupLabel: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },
  chipRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  listContent: { padding: spacing.lg, paddingBottom: 120 },
});
