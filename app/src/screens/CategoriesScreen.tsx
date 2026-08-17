import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LabeledInput, PrimaryButton, SectionCard } from '../components/Common';
import { useLiveQuery } from '../db/useLiveQuery';
import { createCategory, listCategories } from '../db/repositories/categories';
import { colors, radius, spacing, typography } from '../theme/theme';

const SWATCHES = ['#2452E8', '#7A5AF8', '#12B76A', '#F04438', '#F79009', '#12879C', '#DB2777', '#6941C6'];

export function CategoriesScreen() {
  const { data: categories } = useLiveQuery('task_categories', listCategories);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCategory(name.trim(), color, 'pricetag-outline');
      setName('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FlatList
      data={categories ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <SectionCard title="Add Category" icon="add-circle-outline">
          <LabeledInput label="Category Name" value={name} onChangeText={setName} placeholder="e.g. Finance" />
          <Text style={styles.swatchLabel}>Color</Text>
          <View style={styles.swatchRow}>
            {SWATCHES.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]} />
            ))}
          </View>
          <PrimaryButton label={saving ? 'Adding...' : 'Add Category'} onPress={handleAdd} disabled={saving} icon="add" />
        </SectionCard>
      }
      renderItem={({ item }) => (
        <View style={styles.categoryRow}>
          <View style={[styles.dot, { backgroundColor: item.color_hex }]} />
          <Text style={styles.categoryName}>{item.name}</Text>
          {item.is_default ? <Text style={styles.defaultTag}>Default</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  swatchLabel: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.textPrimary },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  categoryName: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  defaultTag: { ...typography.tiny, color: colors.textMuted },
});
