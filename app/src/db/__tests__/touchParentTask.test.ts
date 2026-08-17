// FINDING 1 (final-fix-findings.md, 2026-08-14 production review): child-
// mutation repo fns (addRemark, addTaskEmail, addTaskLink, setTaskLocation,
// setTaskMeeting, addCalendarEvent, setTravelPlan, linkContactToTask) used to
// INSERT the child row + enqueueSync('<child>', taskId) without ever bumping
// the parent `tasks.updated_at`. Since sync/pull.ts's `pullTaskChildren` is
// only invoked for tasks whose OWN row changed (`pullDirectTables`'s
// `changedTaskIds`), the other device never re-pulled the child tables and
// two-way sync silently broke for daily/incremental child edits.
//
// Fix: `touchParentTask` (db/helpers.ts) mirrors `updateTask`'s own bump
// (version/sync_status/updated_at) and enqueues a `task` UPDATE the same way.
// This test proves (1) the helper itself does the right UPDATE + enqueue, and
// (2) a representative child-mutation fn (`addRemark`) actually calls it.
//
// Same fake-db technique as claimOwnership.test.ts: getDb() opens a REAL
// expo-sqlite database that doesn't work under plain Jest, so '../database'
// is mocked with an in-memory call-recording fake instead of touching native
// SQLite. sessionStore is mocked too since addRemark/logActivity read the
// logged-in user off it.

jest.mock('../database', () => ({
  __esModule: true,
  getDb: jest.fn(),
}));

jest.mock('../../store/sessionStore', () => ({
  getCurrentUserId: () => 'user-1',
  getDeviceId: () => 'device-1',
  getCurrentUserName: () => 'Abhay',
}));

import { getDb } from '../database';
import { touchParentTask } from '../helpers';
import { addRemark } from '../repositories/tasks';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

type Call = { sql: string; params: unknown[] };

function makeFakeDb() {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
    },
    async getFirstAsync() {
      return null;
    },
    async getAllAsync() {
      return [];
    },
  };
  return { db, calls };
}

describe('touchParentTask (FINDING 1 fix)', () => {
  test('bumps tasks.updated_at/version/sync_status and enqueues a task UPDATE', async () => {
    const { db, calls } = makeFakeDb();
    mockedGetDb.mockResolvedValue(db as any);

    await touchParentTask(db as any, 'task-1');

    const taskUpdate = calls.find((c) => c.sql.includes('UPDATE tasks SET'));
    expect(taskUpdate).toBeDefined();
    expect(taskUpdate!.sql).toMatch(/version\s*=\s*version\s*\+\s*1/);
    expect(taskUpdate!.sql).toMatch(/sync_status\s*=\s*'pending_update'/);
    expect(taskUpdate!.sql).toMatch(/updated_at\s*=\s*\?/);
    expect(taskUpdate!.params[taskUpdate!.params.length - 1]).toBe('task-1');
    // param before the WHERE id is the ISO timestamp being bumped to
    const tsParam = taskUpdate!.params[0] as string;
    expect(() => new Date(tsParam).toISOString()).not.toThrow();

    const enqueued = calls.find((c) => c.sql.includes('INSERT INTO sync_queue') && (c.params as unknown[]).includes('task'));
    expect(enqueued).toBeDefined();
    // entity_type='task', entity_id='task-1', operation='UPDATE'
    expect(enqueued!.params).toEqual(expect.arrayContaining(['task', 'task-1', 'UPDATE']));
  });

  test('is monotonic-safe to call repeatedly (no reconcile loop risk): each call is an independent bump', async () => {
    const { db, calls } = makeFakeDb();
    mockedGetDb.mockResolvedValue(db as any);

    await touchParentTask(db as any, 'task-1');
    await touchParentTask(db as any, 'task-1');

    const taskUpdates = calls.filter((c) => c.sql.includes('UPDATE tasks SET'));
    expect(taskUpdates).toHaveLength(2);
  });
});

describe('addRemark (representative child-mutation fn) — FINDING 1 fix', () => {
  test('inserting a remark also bumps the parent task and enqueues a task UPDATE', async () => {
    const { db, calls } = makeFakeDb();
    mockedGetDb.mockResolvedValue(db as any);

    await addRemark('task-1', 'Called the client, awaiting reply');

    const remarkInsert = calls.find((c) => c.sql.includes('INSERT INTO task_remarks'));
    expect(remarkInsert).toBeDefined();

    const childEnqueue = calls.find(
      (c) => c.sql.includes('INSERT INTO sync_queue') && (c.params as unknown[]).includes('task_remark')
    );
    expect(childEnqueue).toBeDefined();

    // The FINDING 1 fix: the parent task itself must also be bumped + re-queued.
    const taskUpdate = calls.find((c) => c.sql.includes('UPDATE tasks SET'));
    expect(taskUpdate).toBeDefined();
    expect(taskUpdate!.sql).toMatch(/sync_status\s*=\s*'pending_update'/);

    const taskEnqueue = calls.find(
      (c) => c.sql.includes('INSERT INTO sync_queue') && (c.params as unknown[]).includes('task') && (c.params as unknown[]).includes('UPDATE')
    );
    expect(taskEnqueue).toBeDefined();
    expect(taskEnqueue!.params).toEqual(expect.arrayContaining(['task', 'task-1', 'UPDATE']));
  });
});
