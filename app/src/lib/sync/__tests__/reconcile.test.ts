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
