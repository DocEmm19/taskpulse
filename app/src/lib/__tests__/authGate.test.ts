import { shouldShowAppAfterGate } from '../authGate';

describe('shouldShowAppAfterGate', () => {
  test('not configured -> show app (offline mode), either platform', () => {
    expect(shouldShowAppAfterGate({ isWeb: true, configured: false, hasSession: false, skipped: false })).toBe(true);
    expect(shouldShowAppAfterGate({ isWeb: false, configured: false, hasSession: false, skipped: false })).toBe(true);
  });

  test('existing session -> show app, either platform', () => {
    expect(shouldShowAppAfterGate({ isWeb: true, configured: true, hasSession: true, skipped: false })).toBe(true);
    expect(shouldShowAppAfterGate({ isWeb: false, configured: true, hasSession: true, skipped: false })).toBe(true);
  });

  test('web + configured + no session + skipped -> FALSE (skip ignored on web)', () => {
    expect(shouldShowAppAfterGate({ isWeb: true, configured: true, hasSession: false, skipped: true })).toBe(false);
  });

  test('web + configured + no session + not skipped -> false (gate)', () => {
    expect(shouldShowAppAfterGate({ isWeb: true, configured: true, hasSession: false, skipped: false })).toBe(false);
  });

  test('native + configured + no session + skipped -> true (skip honored on native)', () => {
    expect(shouldShowAppAfterGate({ isWeb: false, configured: true, hasSession: false, skipped: true })).toBe(true);
  });

  test('native + configured + no session + not skipped -> false (gate)', () => {
    expect(shouldShowAppAfterGate({ isWeb: false, configured: true, hasSession: false, skipped: false })).toBe(false);
  });
});
