import React, { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

export function ScreenContainer({ children, style }: PropsWithChildren<{ style?: any }>) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function SectionCard({ title, icon, children, right }: PropsWithChildren<{ title: string; icon?: any; right?: React.ReactNode }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {icon ? <Ionicons name={icon} size={17} color={colors.textSecondary} /> : null}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {right}
      </View>
      <View>{children}</View>
    </View>
  );
}

export function EmptyState({ icon = 'checkmark-done-circle-outline', title, subtitle }: { icon?: any; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function LabeledInput(
  props: TextInputProps & {
    label: string;
    required?: boolean;
    /** Optional subtle accent (New Task screen redesign, and any future
     * caller that opts in): shows a small icon + tints the label text +
     * adds a thin colored left border on the input, tightens the input's
     * corner radius slightly. Omit both (as every pre-existing caller does)
     * to render pixel-identical to before. */
    icon?: any;
    accentColor?: string;
  }
) {
  const { label, required, icon, accentColor, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        {icon ? <Ionicons name={icon} size={13} color={accentColor ?? colors.textSecondary} /> : null}
        <Text style={[styles.fieldLabel, accentColor ? { color: accentColor } : null]}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      </View>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor, borderRadius: radius.sm } : null, style]}
        {...rest}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const activeColor = color ?? colors.brand;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: activeColor + '1F', borderColor: activeColor }]}
    >
      <Text style={[styles.chipText, selected && { color: activeColor, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: any }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryButton, disabled && { opacity: 0.5 }, pressed && !disabled && { opacity: 0.85 }]}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.white} /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, color }: { label: string; onPress: () => void; icon?: any; color?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}>
      {icon ? <Ionicons name={icon} size={16} color={color ?? colors.brand} /> : null}
      <Text style={[styles.secondaryButtonText, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

export function IconTextRow({ icon, text, onPress, color }: { icon: any; text: string; onPress?: () => void; color?: string }) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.iconTextRow}>
      <Ionicons name={icon} size={18} color={color ?? colors.brand} />
      <Text style={[styles.iconTextRowText, color ? { color } : onPress ? { color: colors.brand } : null]} numberOfLines={2}>
        {text}
      </Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionTitle: { ...typography.h2, color: colors.textPrimary },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { ...typography.bodyMedium, color: colors.textSecondary },
  emptySubtitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: spacing.lg },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  fieldLabel: { ...typography.captionMedium, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.textPrimary,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.captionMedium, color: colors.textSecondary },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  primaryButtonText: { ...typography.bodyMedium, color: colors.white },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  secondaryButtonText: { ...typography.captionMedium, color: colors.brand },
  iconTextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  iconTextRowText: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
