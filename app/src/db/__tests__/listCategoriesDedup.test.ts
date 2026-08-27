// listCategories must collapse duplicate DEFAULT categories by name to one chip.
// Once a shared workspace syncs, every member pulls the other members' four
// default categories (each seeded with a random id per device), so without
// dedup each member would see two "Personal", two "Official", etc. This test
// pins the dedup query shape (same fake-db technique as the other repo tests).

jest.mock('../database', () => ({ __esModule: true, getDb: jest.fn() }));
// categories.ts → helpers.ts → sessionStore.ts pulls in AsyncStorage (a native
// module that fails under plain Jest); mock the store like the other repo tests.
jest.mock('../../store/sessionStore', () => ({
  getCurrentUserId: () => 'user-1',
  getDeviceId: () => 'device-1',
  getCurrentUserName: () => 'Test',
}));

import { getDb } from '../database';
import { listCategories } from '../repositories/categories';

const mockedGetDb = getDb as jest.MockedFunction<typeof getDb>;

function makeFakeDb() {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    async getAllAsync(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return [];
    },
  };
  return { db, calls };
}

describe('listCategories — default-category dedup', () => {
  test('queries one row per default name (MIN(id) GROUP BY name) and keeps all custom categories', async () => {
    const { db, calls } = makeFakeDb();
    mockedGetDb.mockResolvedValue(db as any);

    await listCategories();

    expect(calls).toHaveLength(1);
    const sql = calls[0].sql.replace(/\s+/g, ' ');
    // Custom categories pass through untouched...
    expect(sql).toMatch(/is_default = 0/);
    // ...defaults are collapsed to one id per name.
    expect(sql).toMatch(/MIN\(id\).*WHERE is_default = 1.*GROUP BY name/);
    expect(sql).toMatch(/ORDER BY sort_order ASC, name ASC/);
  });
});
