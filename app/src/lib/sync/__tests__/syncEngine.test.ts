// syncEngine.ts imports NetInfo, supabaseClient (react-native-url-polyfill +
// AsyncStorage) and sessionStore (AsyncStorage) at module scope — none of
// which resolve under plain Jest (no native modules; see pull.ts's own
// module comment for the identical constraint on the pull side). Mocking
// those three specific modules (the ones that actually break resolution) is
// enough to let the REAL syncEngine.ts load; ../../db/database and
// ../../db/events are already jest-safe (see db/__tests__/migrations.test.ts
// and pull.test.ts, which import database.ts directly with no mocking).
//
// './pull' is mocked separately (not because it's native-unsafe — it isn't —
// but so these tests can assert the ADDED wiring: that runSyncCycle() calls
// pullDirectTables() then pullTaskChildren(ids) after the push drain,
// without needing a real Supabase client or network).

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));

jest.mock('../supabaseClient', () => ({
  __esModule: true,
  getSupabase: jest.fn(() => null),
  isSupabaseConfigured: jest.fn(() => true),
  ATTACHMENTS_BUCKET: 'attachments-private',
}));

jest.mock('../../../store/sessionStore', () => ({
  __esModule: true,
  getCurrentUserId: jest.fn(() => 'user-1'),
}));

jest.mock('../pull', () => ({
  __esModule: true,
  pullDirectTables: jest.fn(async () => []),
  pullTaskChildren: jest.fn(async () => undefined),
}));

// database.ts itself is jest-safe (see pull.test.ts / migrations.test.ts,
// which import it directly) — but its `getDb()` opens a REAL expo-sqlite
// database, which does not work under plain Jest (no native binding). Mocked
// here purely so runSyncCycle's push-drain step gets an in-memory fake
// instead of trying to open real SQLite.
jest.mock('../../../db/database', () => ({
  __esModule: true,
  getDb: jest.fn(),
}));

import NetInfo from '@react-native-community/netinfo';
import * as supabaseClient from '../supabaseClient';
import * as pull from '../pull';
import { getDb } from '../../../db/database';
import { runSyncCycle, sanitizeRow } from '../syncEngine';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockedFetch = NetInfo.fetch as jest.Mock;
const mockedIsConfigured = supabaseClient.isSupabaseConfigured as jest.Mock;
const mockedGetSupabase = supabaseClient.getSupabase as jest.Mock;
const mockedPullDirect = pull.pullDirectTables as jest.Mock;
const mockedPullChildren = pull.pullTaskChildren as jest.Mock;

function makeEmptyQueueDb() {
  return {
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => undefined),
  };
}

describe('runSyncCycle — pull wiring (Task 10)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsConfigured.mockReturnValue(true);
    mockedFetch.mockResolvedValue({ isConnected: true });
    mockedGetSupabase.mockReturnValue(null);
    mockedGetDb.mockResolvedValue(makeEmptyQueueDb() as any);
    mockedPullDirect.mockResolvedValue([]);
    mockedPullChildren.mockResolvedValue(undefined);
  });

  test('push drain runs before pullDirectTables, and pullTaskChildren receives pullDirectTables ids', async () => {
    const order: string[] = [];

    // A real queued "task" item so the push side does observable work, then
    // asserts it precedes the pull calls.
    const fakeDb = {
      getAllAsync: jest.fn(async () => [
        { id: 'q1', entity_type: 'task', entity_id: 'task-9', operation: 'CREATE', retry_count: 0, status: 'queued', created_at: 'x' },
      ]),
      getFirstAsync: jest.fn(async () => ({ id: 'task-9', title: 'hello' })),
      runAsync: jest.fn(async () => undefined),
    };
    mockedGetDb.mockResolvedValue(fakeDb as any);

    const fakeSupabase = {
      from: jest.fn(() => ({
        upsert: jest.fn(async () => {
          order.push('push');
          return { error: null };
        }),
      })),
    };
    mockedGetSupabase.mockReturnValue(fakeSupabase);

    mockedPullDirect.mockImplementation(async () => {
      order.push('pullDirectTables');
      return ['task-1', 'task-2'];
    });
    mockedPullChildren.mockImplementation(async (ids: string[]) => {
      order.push(`pullTaskChildren:${ids.join(',')}`);
    });

    await runSyncCycle();

    expect(order).toEqual(['push', 'pullDirectTables', 'pullTaskChildren:task-1,task-2']);
    expect(mockedPullDirect).toHaveBeenCalledTimes(1);
    expect(mockedPullChildren).toHaveBeenCalledWith(['task-1', 'task-2']);
  });

  test('no-op — including no pull — when isSupabaseConfigured() is false', async () => {
    mockedIsConfigured.mockReturnValue(false);

    await runSyncCycle();

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(mockedPullDirect).not.toHaveBeenCalled();
    expect(mockedPullChildren).not.toHaveBeenCalled();
  });

  test('no-op — including no pull — when offline', async () => {
    mockedFetch.mockResolvedValue({ isConnected: false });

    await runSyncCycle();

    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(mockedPullDirect).not.toHaveBeenCalled();
    expect(mockedPullChildren).not.toHaveBeenCalled();
  });

  test('a thrown pull error still resets isRunning — the next cycle is not stuck skipped', async () => {
    mockedPullDirect.mockRejectedValueOnce(new Error('cloud unreachable'));

    await expect(runSyncCycle()).rejects.toThrow('cloud unreachable');

    // If isRunning were left stuck true, this second call would short-circuit
    // before ever touching NetInfo/getDb/pull again.
    mockedPullDirect.mockResolvedValueOnce([]);
    await runSyncCycle();

    expect(mockedPullDirect).toHaveBeenCalledTimes(2);
  });
});

describe('sanitizeRow (Task 10 data-integrity fix)', () => {
  test('drops columns not in the cloud whitelist for a known table', () => {
    const row = {
      id: 'cat-1',
      name: 'Work',
      color_hex: '#fff',
      icon: 'briefcase',
      is_default: 0,
      sort_order: 1,
      created_by: 'u1',
      created_at: 'a',
      updated_at: 'b',
      // Not in task_categories' cloud whitelist:
      some_local_only_scratch_field: 'should be dropped',
    };

    const result = sanitizeRow(row, 'task_categories');

    expect(result).not.toHaveProperty('some_local_only_scratch_field');
    expect(result).toEqual({
      id: 'cat-1',
      name: 'Work',
      color_hex: '#fff',
      icon: 'briefcase',
      is_default: 0,
      sort_order: 1,
      created_by: 'u1',
      created_at: 'a',
      updated_at: 'b',
    });
  });

  test('falls back to an unfiltered clone for a table with no whitelist entry', () => {
    const row = { id: 'x', anything: 'goes', another_field: 42 };

    const result = sanitizeRow(row, 'some_未_whitelisted_table');

    expect(result).toEqual(row);
    expect(result).not.toBe(row); // still a clone, not the same reference
  });

  test('task-child cloud tables are also covered by the shared whitelist', () => {
    const row = {
      id: 'r1',
      task_id: 't1',
      body: 'a remark',
      author_id: 'u1',
      original_language: 'en',
      created_at: 'a',
      leaked_local_column: true,
    };

    const result = sanitizeRow(row, 'task_remarks');

    expect(result).not.toHaveProperty('leaked_local_column');
    expect(result.body).toBe('a remark');
  });
});
