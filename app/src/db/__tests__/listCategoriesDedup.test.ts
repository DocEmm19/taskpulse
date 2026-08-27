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
import { listCategories, canonicalCategoryId } from '../repositories/categories';

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

describe('canonicalCategoryId — normalises a duplicate default to the shown one', () => {
  function fakeDbFor(rowById: { name: string; is_default: number } | null, minId: string | null) {
    return {
      async getFirstAsync(sql: string) {
        if (sql.includes('SELECT name, is_default')) return rowById;
        if (sql.includes('MIN(id)')) return { id: minId };
        return null;
      },
    };
  }

  test('a default duplicate id resolves to MIN(id) for its name', async () => {
    mockedGetDb.mockResolvedValue(fakeDbFor({ name: 'Personal', is_default: 1 }, 'canonical-personal') as any);
    expect(await canonicalCategoryId('losing-dup-id')).toBe('canonical-personal');
  });

  test('a custom category id is returned unchanged (never deduped)', async () => {
    mockedGetDb.mockResolvedValue(fakeDbFor({ name: 'My Project', is_default: 0 }, 'irrelevant') as any);
    expect(await canonicalCategoryId('custom-id')).toBe('custom-id');
  });

  test('an unknown id is returned unchanged', async () => {
    mockedGetDb.mockResolvedValue(fakeDbFor(null, null) as any);
    expect(await canonicalCategoryId('ghost-id')).toBe('ghost-id');
  });
});
