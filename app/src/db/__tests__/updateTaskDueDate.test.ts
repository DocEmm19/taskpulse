// Regression test for the due-date activity-log off-by-one.
//
// Bug: updateTask logged `Due date set to ${patch.dueDate.slice(0, 10)}`.
// The due date is stored as local-midnight-as-UTC (DateTimeField.web builds it
// with `new Date(y, m-1, d)`, then NewEditTaskScreen serialises via
// `.toISOString()`), so slicing the raw UTC string is one calendar day early
// in any timezone ahead of UTC. In IST a due date the user picked as 30-Nov
// was logged as "Due date set to 2026-11-29", while every screen correctly
// *displayed* 30-Nov. This test pins IST and proves the logged day now matches
// the picked/displayed day. Same fake-db technique as updateTaskAssignedTo.test.ts.

// Pin the runtime timezone so the assertion is deterministic on any machine/CI,
// not just an IST laptop. Must be set before the first Date use in this file.
process.env.TZ = 'Asia/Kolkata';

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
import { updateTask } from '../repositories/tasks';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

type Call = { sql: string; params: unknown[] };

function makeFakeDb(beforeRow: Record<string, unknown>) {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
    },
    async getFirstAsync() {
      return beforeRow;
    },
    async getAllAsync() {
      return [];
    },
  };
  return { db, calls };
}

describe('updateTask — due date activity log (timezone)', () => {
  test('logs the LOCAL calendar day the user picked, not the UTC-shifted day', async () => {
    // The user picked 30-Nov-2026 in the date field. DateTimeField.web turns
    // that into local midnight; serialised to UTC it becomes the 29th at 18:30Z.
    const localMidnight30Nov = new Date(2026, 10, 30); // months are 0-based → November
    const dueIso = localMidnight30Nov.toISOString();
    expect(dueIso).toBe('2026-11-29T18:30:00.000Z'); // sanity: IST is +5:30, so it *does* cross midnight

    const { db, calls } = makeFakeDb({
      id: 'task-1', title: 'Follow up', category_id: 'cat-1', priority: 'P2',
      status: 'pending', assigned_to_name: null, due_date: null, reminder_at: null,
    });
    mockedGetDb.mockResolvedValue(db as any);

    await updateTask('task-1', { dueDate: dueIso });

    const activityInsert = calls.find((c) => c.sql.includes('INSERT INTO task_activity'));
    expect(activityInsert).toBeDefined();
    // The fix: "2026-11-30" (what the user picked and every screen shows),
    // NOT the old "2026-11-29" produced by slicing the raw UTC string.
    expect(activityInsert!.params).toEqual(
      expect.arrayContaining(['due_date_changed', 'Due date set to 2026-11-30']),
    );
    expect(activityInsert!.params).not.toEqual(
      expect.arrayContaining(['Due date set to 2026-11-29']),
    );
  });

  test('clearing the due date still logs "Due date removed"', async () => {
    const { db, calls } = makeFakeDb({
      id: 'task-1', title: 'Follow up', category_id: 'cat-1', priority: 'P2',
      status: 'pending', assigned_to_name: null, due_date: '2026-11-29T18:30:00.000Z', reminder_at: null,
    });
    mockedGetDb.mockResolvedValue(db as any);

    await updateTask('task-1', { dueDate: null });

    const activityInsert = calls.find((c) => c.sql.includes('INSERT INTO task_activity'));
    expect(activityInsert!.params).toEqual(
      expect.arrayContaining(['due_date_changed', 'Due date removed']),
    );
  });
});
