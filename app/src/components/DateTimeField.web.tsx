import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  /** Optional subtle accent (New Task screen redesign) — tints the row's left
   * border and background very lightly. Omit to render exactly as before
   * (every other existing caller — Meeting Time, Travel Date, Return Date —
   * doesn't pass this, so their appearance is unchanged). */
  accentColor?: string;
  accentSoft?: string;
}

/** Web-only counterpart to DateTimeField.tsx (Metro picks this file
 * automatically on web builds via the `.web.tsx` platform extension; native
 * iOS/Android keep using DateTimeField.tsx unchanged).
 *
 * Why this file exists: `@react-native-community/datetimepicker` ships no
 * web implementation — its generic fallback (src/datetimepicker.js) just
 * renders `null` and calls `console.warn('DateTimePicker is not supported
 * on: web')`. DateTimeField.tsx's picker markup is also only rendered when
 * `Platform.OS === 'ios'`, so on web tapping the field silently does
 * nothing — no popup, no error, nothing (confirmed via the New Task screen's
 * Due Date field). This file fixes that by rendering the browser's native
 * date/time input, kept visually invisible (opacity 0) and stretched over
 * the exact same styled row used on native, so the on-screen look is
 * unchanged but the row is now actually interactive — clicking/tapping it
 * opens the OS's real date/time picker UI. */
export function DateTimeField({ label, value, onChange, mode = 'date', clearable = true, placeholder = 'Not set', accentColor, accentSoft }: Props) {
  const displayText = value
    ? mode === 'date'
      ? format(value, 'dd-MMM-yyyy')
      : format(value, 'dd-MMM-yyyy, h:mm a')
    : placeholder;

  const inputType = mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'datetime-local';

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!raw) {
      onChange(null);
      return;
    }
    if (mode === 'date') {
      const [y, m, d] = raw.split('-').map(Number);
      onChange(new Date(y, m - 1, d));
    } else if (mode === 'time') {
      const [h, mi] = raw.split(':').map(Number);
      const base = value ? new Date(value) : new Date();
      base.setHours(h, mi, 0, 0);
      onChange(base);
    } else {
      // datetime-local values ("YYYY-MM-DDTHH:MM") have no timezone suffix,
      // so `new Date(...)` parses them as local time — matching the
      // Android/iOS pickers, which also operate in local time.
      onChange(new Date(raw));
    }
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, accentColor ? { color: accentColor } : null]}>{label}</Text>
      <View
        style={[
          styles.row,
          accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor } : null,
          accentSoft ? { backgroundColor: accentSoft } : null,
        ]}
      >
        {/* Invisible native input painted above the row's own children (it's
            declared last and is `position: absolute`, so it wins hit-testing
            over the static-flow icon/text below it) — this is what makes the
            whole row clickable. Its own visuals are irrelevant since
            opacity is 0. */}
        <Ionicons name="calendar-outline" size={18} color={accentColor ?? colors.textSecondary} />
        <Text style={[styles.value, !value && { color: colors.textMuted }]}>{displayText}</Text>
        {clearable && value ? (
          <View style={styles.clearWrap}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} onPress={() => onChange(null)} />
          </View>
        ) : null}
        <input
          type={inputType}
          value={toInputValue(value, mode)}
          onChange={handleNativeChange}
          aria-label={label}
          style={webOverlayStyle}
        />
      </View>
    </View>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toInputValue(value: Date | null, mode: 'date' | 'time' | 'datetime' = 'date'): string {
  if (!value) return '';
  const y = value.getFullYear();
  const mo = pad(value.getMonth() + 1);
  const d = pad(value.getDate());
  if (mode === 'date') return `${y}-${mo}-${d}`;
  const h = pad(value.getHours());
  const mi = pad(value.getMinutes());
  if (mode === 'time') return `${h}:${mi}`;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

// Cast to `any`: these are plain CSS properties for a raw DOM <input>
// (react-native-web passes web-only elements straight through to react-dom),
// not React Native style props, so they don't match StyleSheet's types.
const webOverlayStyle: any = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  margin: 0,
  zIndex: 1,
};

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  value: { ...typography.body, color: colors.textPrimary, flex: 1 },
  // Its own stacking context with a higher z-index than the overlay input
  // above, so the "clear" (x) icon stays clickable instead of the tap being
  // swallowed by the invisible date input that covers the rest of the row.
  clearWrap: { position: 'relative', zIndex: 2 },
});
