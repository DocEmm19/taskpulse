import { EXTRA_COLUMNS } from '../database';

describe('migrations', () => {
  test('actor_name is an ensured column', () => {
    expect(EXTRA_COLUMNS).toContainEqual({ table: 'task_activity', column: 'actor_name', type: 'TEXT' });
  });

  // Task 6: every DIRECT_TABLES table (see syncEngine.ts) must carry
  // `updated_at` for last-write-wins cloud sync. tasks/contacts already had it
  // in their original CREATE TABLE; these three didn't, so they need the
  // additive-migration path.
  test.each(['task_categories', 'attachments', 'calendar_events'])(
    'updated_at is an ensured column on %s',
    (table) => {
      expect(EXTRA_COLUMNS).toContainEqual({ table, column: 'updated_at', type: 'TEXT' });
    }
  );
});
