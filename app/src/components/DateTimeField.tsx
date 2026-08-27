import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, radius, spacing, typography } from '../theme/theme';

interface Props {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  clearable?: boolean;
  placeholder?: string;
  /** Web-only visual accent (see DateTimeField.web.tsx) — accepted here only
   * so callers type-check on native too; intentionally unused, native's look
   * is unchanged. */
  accentColor?: string;
  accentSoft?: string;
}

/** Cross-platform date/time picker. Android shows its native dialog on demand;
 * iOS shows an inline compact picker below the field once tapped — both close
 * themselves after picking so this works the same from either OS. */
export function DateTimeField({ label, value, onChange, mode = 'date', clearable = true, placeholder = 'Not set' }: Props) {
  const [showIOSPicker, setShowIOSPicker] = useState(false);

  const displayText = value
    ? mode === 'date'
      ? format(value, 'dd-MMM-yyyy')
      : format(value, 'dd-MMM-yyyy, h:mm a')
    : placeholder;

  function openPicker() {
    if (Platform.OS === 'android') {
      const DateTimePickerAndroid = require('@react-native-community/datetimepicker').DateTimePickerAndroid;
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode: 'date',
        onChange: (_e: any, selectedDate?: Date) => {
          if (!selectedDate) return;
          if (mode === 'datetime') {
            DateTimePickerAndroid.open({
              value: selectedDate,
              mode: 'time',
              onChange: (_e2: any, time?: Date) => {
                if (!time) return onChange(selectedDate);
                const combined = new Date(selectedDate);
                combined.setHours(time.getHours(), time.getMinutes());
                onChange(combined);
              },
            });
          } else {
            onChange(selectedDate);
          }
        },
      });
    } else {
      setShowIOSPicker(true);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.row} onPress={openPicker}>
        <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        <Text style={[styles.value, !value && { color: colors.textMuted }]}>{displayText}</Text>
        {clearable && value ? (
          <Ionicons accessibilityRole="button" accessibilityLabel="Clear" name="close-circle" size={18} color={colors.textMuted} onPress={() => onChange(null)} />
        ) : null}
      </Pressable>
      {Platform.OS === 'ios' && showIOSPicker && (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={value ?? new Date()}
            mode={mode === 'datetime' ? 'datetime' : mode}
            display="spinner"
            onChange={(_e, d) => {
              if (d) onChange(d);
            }}
          />
          <Pressable style={styles.doneBtn} onPress={() => setShowIOSPicker(false)}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body, color: colors.textPrimary, flex: 1 },
  iosPickerWrap: { backgroundColor: colors.surface, borderRadius: radius.md, marginTop: spacing.xs },
  doneBtn: { alignSelf: 'flex-end', padding: spacing.sm },
  doneText: { ...typography.captionMedium, color: colors.brand },
});
