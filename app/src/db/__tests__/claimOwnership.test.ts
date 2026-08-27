// claimOwnership.ts calls getDb() directly (no injectable-deps seam like
// pull.ts has), and getDb() opens a REAL expo-sqlite database that doesn't
// work under plain Jest (see syncEngine.test.ts's identical note). Mocking
// '../database' with an in-memory fake — same technique used there — lets
// this test genuinely exercise claimLocalDataForUser()'s SQL/queueing logic
// without touching native SQLite. './events' (notifyTablesChanged) is a
// pure in-memory pub/sub with no native deps, so it's left real.

jest.mock('../database', () => ({
  __esModule: true,
  getDb: jest.fn(),
}));

import { getDb } from '../database';
import { claimLocalDataForUser, adoptOrphanCategoriesForUser } from '../claimOwnership';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

type Call = { sql: string; params: unknown[] };

function makeFakeDb(selectResults: Record<string, { id: string }[]>) {
  const calls: Call[] = [];
  const db = {
    async withTransactionAsync(fn: () => Promise<void>) {
      await fn();
    },
    async runAsync(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
    },
    async getAllAsync(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      for (const [needle, rows] of Object.entries(selectResults)) {
        if (sql.includes(needle)) return rows;
      }
      return [];
    },
  };
  return { db, calls };
}

describe('claimLocalDataForUser (Task 10 fix)', () => {
  test('bumps updated_at on task_categories and attachments, and re-queues both into sync_queue', async () => {
    const { db, calls } = makeFakeDb({
      'FROM tasks WHERE created_by': [],
      'FROM task_categories WHERE created_by': [{ id: 'cat-1' }, { id: 'cat-2' }],
      'FROM attachments WHERE uploaded_by': [{ id: 'att-1' }],
    });
    mockedGetDb.mockResolvedValue(db as any);

    await claimLocalDataForUser('local-old-id', 'supabase-new-id');

    const categoryUpdate = calls.find((c) => c.sql.includes('UPDATE task_categories SET created_by'));
    expect(categoryUpdate).toBeDefined();
    expect(categoryUpdate!.sql).toMatch(/updated_at\s*=\s*\?/);
    expect(categoryUpdate!.params).toEqual(['supabase-new-id', expect.any(String), 'local-old-id']);
    // param 2 is the ISO timestamp being bumped to
    expect(() => new Date(categoryUpdate!.params[1] as string).toISOString()).not.toThrow();

    const attachmentUpdate = calls.find((c) => c.sql.includes('UPDATE attachments SET uploaded_by'));
    expect(attachmentUpdate).toBeDefined();
    expect(attachmentUpdate!.sql).toMatch(/updated_at\s*=\s*\?/);
    expect(attachmentUpdate!.params).toEqual(['supabase-new-id', expect.any(String), 'local-old-id']);

    // Both reattributed categories enqueued into sync_queue as 'task_category' rows.
    const categoryQueueRows = calls.filter((c) => c.sql.includes('INSERT INTO sync_queue') && c.sql.includes("'task_category'"));
    expect(categoryQueueRows).toHaveLength(2);
    expect(categoryQueueRows.map((c) => c.params[1])).toEqual(['cat-1', 'cat-2']);

    // The reattributed attachment enqueued as an 'attachment' row.
    const attachmentQueueRows = calls.filter((c) => c.sql.includes('INSERT INTO sync_queue') && c.sql.includes("'attachment'"));
    expect(attachmentQueueRows).toHaveLength(1);
    expect(attachmentQueueRows[0].params[1]).toBe('att-1');
  });

  test('adopts NULL-owned legacy default categories so they can sync (root cause of tasks never pushing)', async () => {
    // Older builds seeded Personal/Official/Travel/Urgent with created_by = NULL
    // and never queued them, so they never reached the cloud — and because
    // tasks.category_id is a NOT NULL FK to task_categories, every task push was
    // rejected on the FK and silently retried forever. The fix adopts those
    // NULL-owned rows under the signed-in user so they satisfy RLS and re-queue.
    const { db, calls } = makeFakeDb({
      'FROM task_categories WHERE created_by': [{ id: 'default-personal' }],
    });
    mockedGetDb.mockResolvedValue(db as any);

    await claimLocalDataForUser('local-old-id', 'supabase-new-id');

    const nullAdopt = calls.find((c) => c.sql.includes('UPDATE task_categories SET created_by') && c.sql.includes('created_by IS NULL'));
    expect(nullAdopt).toBeDefined();
    expect(nullAdopt!.params).toEqual(['supabase-new-id', expect.any(String)]);

    // The now-adopted default category is re-queued for push like any other.
    const queued = calls.filter((c) => c.sql.includes('INSERT INTO sync_queue') && c.sql.includes("'task_category'"));
    expect(queued.map((c) => c.params[1])).toContain('default-personal');
  });

  test('no-op when oldLocalUserId equals newSupabaseUserId', async () => {
    const { db, calls } = makeFakeDb({});
    mockedGetDb.mockResolvedValue(db as any);

    await claimLocalDataForUser('same-id', 'same-id');

    expect(calls).toHaveLength(0);
  });
});

describe('adoptOrphanCategoriesForUser (already-signed-in boot path)', () => {
  test('adopts NULL-owned categories and re-queues them with INSERT OR REPLACE (idempotent)', async () => {
    const { db, calls } = makeFakeDb({
      'FROM task_categories WHERE created_by IS NULL': [{ id: 'default-personal' }, { id: 'default-official' }],
    });
    mockedGetDb.mockResolvedValue(db as any);

    await adoptOrphanCategoriesForUser('supabase-user');

    const adopt = calls.find((c) => c.sql.includes('UPDATE task_categories SET created_by') && c.sql.includes('created_by IS NULL'));
    expect(adopt).toBeDefined();
    expect(adopt!.params).toEqual(['supabase-user', expect.any(String)]);

    const queued = calls.filter((c) => c.sql.includes('INSERT OR REPLACE INTO sync_queue') && c.sql.includes("'task_category'"));
    expect(queued).toHaveLength(2);
    expect(queued.map((c) => c.params[1])).toEqual(['default-personal', 'default-official']);
  });

  test('no-op (no writes) when there are no NULL-owned categories', async () => {
    const { db, calls } = makeFakeDb({ 'FROM task_categories WHERE created_by IS NULL': [] });
    mockedGetDb.mockResolvedValue(db as any);

    await adoptOrphanCategoriesForUser('supabase-user');

    expect(calls.find((c) => c.sql.includes('UPDATE task_categories'))).toBeUndefined();
    expect(calls.find((c) => c.sql.includes('INSERT OR REPLACE INTO sync_queue'))).toBeUndefined();
  });
});
