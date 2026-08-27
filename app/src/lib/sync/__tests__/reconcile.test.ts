import { shouldApplyIncoming } from '../reconcile';

test('applies when no local row', () => {
  expect(shouldApplyIncoming(null, { updated_at: '2026-01-01T00:00:00Z' })).toBe(true);
});

test('applies newer incoming', () => {
  expect(shouldApplyIncoming({ updated_at: '2026-01-01T00:00:00Z' }, { updated_at: '2026-01-02T00:00:00Z' })).toBe(true);
});

test('rejects older incoming', () => {
  expect(shouldApplyIncoming({ updated_at: '2026-01-03T00:00:00Z' }, { updated_at: '2026-01-02T00:00:00Z' })).toBe(false);
});

test('applies remote delete when newer', () => {
  expect(shouldApplyIncoming({ updated_at: '2026-01-01T00:00:00Z' }, { updated_at: '2026-01-02T00:00:00Z', deleted_at: '2026-01-02T00:00:00Z' })).toBe(true);
});

// Regression: mixed ISO formats must compare by INSTANT, not by raw string.
// Local rows are written by the client as `...Z` (Date.toISOString); rows
// pulled from Supabase/PostgREST come back as `...+00:00`. A newer incoming
// update in the `+00:00` form must still beat an older local `Z` value even
// though '+' < 'Z' lexicographically — the exact case that stranded a peer's
// update at close timestamps under the old string compare.
test('applies newer incoming across Z vs +00:00 formats', () => {
  const localZ = '2026-01-02T10:00:00.000Z';
  const incomingOffsetNewer = '2026-01-02T10:00:05.000+00:00'; // 5s later, same instant-zone
  expect(shouldApplyIncoming({ updated_at: localZ }, { updated_at: incomingOffsetNewer })).toBe(true);
});

test('rejects older incoming across +00:00 vs Z formats', () => {
  const localOffset = '2026-01-02T10:00:05.000+00:00';
  const incomingZOlder = '2026-01-02T10:00:00.000Z'; // 5s earlier
  expect(shouldApplyIncoming({ updated_at: localOffset }, { updated_at: incomingZOlder })).toBe(false);
});

test('treats the same instant in different formats as equal (applies, tie->incoming)', () => {
  const sameInstantZ = '2026-01-02T10:00:00.000Z';
  const sameInstantOffset = '2026-01-02T10:00:00.000+00:00';
  // Under the old raw-string compare, incoming '+00:00' < local 'Z' → wrongly
  // rejected. By instant they're equal, and LWW applies on a tie.
  expect(shouldApplyIncoming({ updated_at: sameInstantZ }, { updated_at: sameInstantOffset })).toBe(true);
});
