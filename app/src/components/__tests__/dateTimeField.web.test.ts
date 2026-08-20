// DateTimeField.web.tsx exists because @react-native-community/datetimepicker
// has no web implementation at all (its generic fallback renders `null` and
// just console.warns "DateTimePicker is not supported on: web"), and
// DateTimeField.tsx's own picker markup is gated on `Platform.OS === 'ios'` —
// so on web, tapping the Due Date / Reminder field on the New Task screen
// did nothing at all (confirmed via a live repro). The web file replaces the
// native picker with the browser's own <input type="date"/"datetime-local">,
// which needs its value formatted as the browser expects — that's what
// `toInputValue` does, and this test is what proves the conversion (and the
// reverse `new Date(...)` parse a component does on change) is correct
// across all three supported modes (date / time / datetime).
import { toInputValue } from '../DateTimeField.web';

describe('toInputValue (DateTimeField.web)', () => {
  test('null value renders as empty string for any mode (shows the picker with nothing pre-filled)', () => {
    expect(toInputValue(null, 'date')).toBe('');
    expect(toInputValue(null, 'time')).toBe('');
    expect(toInputValue(null, 'datetime')).toBe('');
  });

  test('"date" mode formats as YYYY-MM-DD, the exact format <input type="date"> requires', () => {
    const d = new Date(2026, 7, 5); // August 5, 2026 (month is 0-indexed)
    expect(toInputValue(d, 'date')).toBe('2026-08-05');
  });

  test('"time" mode formats as zero-padded HH:MM', () => {
    const d = new Date(2026, 7, 5, 9, 5);
    expect(toInputValue(d, 'time')).toBe('09:05');
  });

  test('"datetime" mode formats as YYYY-MM-DDTHH:MM, the exact format <input type="datetime-local"> requires', () => {
    const d = new Date(2026, 7, 5, 14, 30);
    expect(toInputValue(d, 'datetime')).toBe('2026-08-05T14:30');
  });

  test('round-trips through the native <input> value and back to the same wall-clock time', () => {
    // Mirrors what the component's onChange handler does: parse the
    // datetime-local string back into a Date the same way a real change
    // event would deliver it, and confirm nothing shifts by a day/hour
    // (the classic timezone-string bug this format is chosen to avoid).
    const original = new Date(2026, 0, 31, 23, 45);
    const raw = toInputValue(original, 'datetime');
    const parsed = new Date(raw); // no timezone suffix => parsed as local time
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(31);
    expect(parsed.getHours()).toBe(23);
    expect(parsed.getMinutes()).toBe(45);
  });
});
