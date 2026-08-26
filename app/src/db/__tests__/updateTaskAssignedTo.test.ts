// Bug: NewEditTaskScreen's "Assigned To" field renders and edits fine, but
// saving an EDIT to an existing task silently dropped the change — TaskPatch
// (updateTask's input type) had no `assignedToName` field at all, so the
// screen's isEdit save path never passed the value through. Creating a NEW
// task always worked (createTask already accepted assignedToName). This test
// proves updateTask now persists an assigned-to change the same way it does
// title/priority/due date, using the same fake-db technique as
// touchParentTask.test.ts (getDb() opens a real native SQLite db that
// doesn't run under plain Jest).
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

describe('updateTask — assignedToName', () => {
  test('changing the assignee updates assigned_to_name and logs an "assigned" activity event', async () => {
    const { db, calls } = makeFakeDb({ id: 'task-1', assigned_to_name: 'Rajni', title: 'Follow up', category_id: 'cat-1', priority: 'P2', status: 'pending', due_date: null, reminder_at: null });
    mockedGetDb.mockResolvedValue(db as any);

    await updateTask('task-1', { assignedToName: 'Mohit' });

    const taskUpdate = calls.find((c) => c.sql.includes('UPDATE tasks SET'));
    expect(taskUpdate).toBeDefined();
    expect(taskUpdate!.sql).toMatch(/assigned_to_name\s*=\s*\?/);
    expect(taskUpdate!.params).toContain('Mohit');

    const activityInsert = calls.find((c) => c.sql.includes('INSERT INTO task_activity'));
    expect(activityInsert).toBeDefined();
    expect(activityInsert!.params).toEqual(expect.arrayContaining(['assigned', 'Assigned to Mohit']));
  });

  test('clearing the assignee (empty string coerced to null by the caller) is also persisted', async () => {
    const { db, calls } = makeFakeDb({ id: 'task-1', assigned_to_name: 'Rajni', title: 'Follow up', category_id: 'cat-1', priority: 'P2', status: 'pending', due_date: null, reminder_at: null });
    mockedGetDb.mockResolvedValue(db as any);

    await updateTask('task-1', { assignedToName: null });

    const taskUpdate = calls.find((c) => c.sql.includes('UPDATE tasks SET'));
    expect(taskUpdate).toBeDefined();
    expect(taskUpdate!.sql).toMatch(/assigned_to_name\s*=\s*\?/);
    expect(taskUpdate!.params).toContain(null);

    const activityInsert = calls.find((c) => c.sql.includes('INSERT INTO task_activity'));
    expect(activityInsert!.params).toEqual(expect.arrayContaining(['assigned', 'Assignee removed']));
  });

  test('no-op when the assignee is unchanged — does not write or log anything', async () => {
    const { db, calls } = makeFakeDb({ id: 'task-1', assigned_to_name: 'Rajni', title: 'Follow up', category_id: 'cat-1', priority: 'P2', status: 'pending', due_date: null, reminder_at: null });
    mockedGetDb.mockResolvedValue(db as any);

    await updateTask('task-1', { assignedToName: 'Rajni' });

    expect(calls.find((c) => c.sql.includes('UPDATE tasks SET'))).toBeUndefined();
  });
});
