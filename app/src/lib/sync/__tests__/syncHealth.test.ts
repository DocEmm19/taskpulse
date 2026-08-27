import { syncHealthLabel } from '../syncHealth';

const T0 = Date.parse('2026-08-27T12:00:00.000Z');

test('stuck items => warn "Sync issue" regardless of lastOkAt', () => {
  expect(syncHealthLabel({ stuck: 2, lastOkAt: '2026-08-27T11:59:00.000Z' }, T0)).toEqual({ text: 'Sync issue', tone: 'warn' });
});

test('no successful cycle yet => "Syncing…"', () => {
  expect(syncHealthLabel({ stuck: 0, lastOkAt: null }, T0)).toEqual({ text: 'Syncing…', tone: 'ok' });
});

test('relative "synced" time buckets', () => {
  expect(syncHealthLabel({ stuck: 0, lastOkAt: '2026-08-27T11:59:40.000Z' }, T0).text).toBe('Synced just now'); // 20s
  expect(syncHealthLabel({ stuck: 0, lastOkAt: '2026-08-27T11:55:00.000Z' }, T0).text).toBe('Synced 5m ago');
  expect(syncHealthLabel({ stuck: 0, lastOkAt: '2026-08-27T09:00:00.000Z' }, T0).text).toBe('Synced 3h ago');
});
