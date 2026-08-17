import { pullDirectTables, pullTaskChildren, PullChildrenDb, PullDb, PullableSupabaseClient } from '../pull';

// ----------------------------------------------------------------------------
// Fakes — no real Supabase client, no real SQLite. `makeFakeSupabase` mimics
// the exact chain this module calls: `.from(t).select().gt(c, v).order(c, o)`.
// `makeFakeDb` is an in-memory map keyed by `${table}:${id}`.
// ----------------------------------------------------------------------------

type CloudRow = Record<string, unknown>;

function makeFakeSupabase(rowsByTable: Record<string, CloudRow[]>): {
  client: PullableSupabaseClient;
  calls: { table: string; gtColumn: string; gtValue: string }[];
} {
  const calls: { table: string; gtColumn: string; gtValue: string }[] = [];
  const client: PullableSupabaseClient = {
    from(table: string) {
      return {
        select() {
          return {
            gt(gtColumn: string, gtValue: string) {
              calls.push({ table, gtColumn, gtValue });
              const rows = (rowsByTable[table] ?? []).filter((r) => (r.updated_at as string) > gtValue);
              return {
                order() {
                  const sorted = [...rows].sort((a, b) =>
                    (a.updated_at as string).localeCompare(b.updated_at as string)
                  );
                  return Promise.resolve({ data: sorted, error: null });
                },
              };
            },
            in() {
              throw new Error('pullDirectTables does not use .in()');
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

function makeFakeDb(seed: Record<string, CloudRow> = {}): PullDb & { store: Record<string, CloudRow> } {
  const store: Record<string, CloudRow> = { ...seed };
  return {
    store,
    async getRow(table, id) {
      return store[`${table}:${id}`] ?? null;
    },
    async upsertRow(table, columns, row) {
      const filtered: CloudRow = {};
      for (const c of columns) filtered[c] = row[c] ?? null;
      store[`${table}:${row.id as string}`] = filtered;
    },
  };
}

function makeMetaStore() {
  const meta: Record<string, string> = {};
  return {
    meta,
    getMeta: async (key: string) => meta[key] ?? null,
    setMeta: async (key: string, value: string) => {
      meta[key] = value;
    },
  };
}

test('client null -> no-op, returns empty array', async () => {
  const db = makeFakeDb();
  const { getMeta, setMeta } = makeMetaStore();
  const notified: string[] = [];

  const result = await pullDirectTables({
    getSupabase: () => null,
    db,
    getMeta,
    setMeta,
    notifyTablesChanged: (t) => notified.push(...(Array.isArray(t) ? t : [t])),
  });

  expect(result).toEqual([]);
  expect(notified).toEqual([]);
});

test('applies only the newer-than-local row per table, advances watermark to max updated_at, notifies changed tables', async () => {
  const localId = 'task-1';
  const db = makeFakeDb({
    'tasks:task-1': { id: localId, title: 'Local title', updated_at: '2026-01-02T00:00:00Z' },
  });
  const { getMeta, setMeta, meta } = makeMetaStore();

  const { client, calls } = makeFakeSupabase({
    tasks: [
      // Older than local -> rejected by shouldApplyIncoming, but still advances the "seen" watermark candidate.
      { id: 'task-1', title: 'Stale remote title', updated_at: '2026-01-01T00:00:00Z' },
      // Newer than local -> applied.
      { id: 'task-2', title: 'Fresh from cloud', updated_at: '2026-01-03T00:00:00Z' },
    ],
  });

  const notified: string[] = [];
  const changedTaskIds = await pullDirectTables({
    getSupabase: () => client,
    db,
    getMeta,
    setMeta,
    notifyTablesChanged: (t) => notified.push(...(Array.isArray(t) ? t : [t])),
  });

  // Only the newer row for task-1 was rejected (local wins); task-2 had no local row so it's always applied.
  expect(db.store['tasks:task-1'].title).toBe('Local title');
  expect(db.store['tasks:task-2'].title).toBe('Fresh from cloud');

  // Watermark advances to the max updated_at seen among ALL fetched rows, not just applied ones.
  expect(meta['last_pull:tasks']).toBe('2026-01-03T00:00:00Z');

  // Returned ids are the tasks-table rows actually written (winners only).
  expect(changedTaskIds).toEqual(['task-2']);

  expect(notified).toContain('tasks');

  // Queried using the default epoch watermark since none was stored yet.
  const tasksCall = calls.find((c) => c.table === 'tasks');
  expect(tasksCall?.gtColumn).toBe('updated_at');
  expect(tasksCall?.gtValue).toBe('1970-01-01T00:00:00Z');
});

test('uses the stored watermark for the gt() filter on subsequent pulls', async () => {
  const db = makeFakeDb();
  const { getMeta, setMeta, meta } = makeMetaStore();
  meta['last_pull:contacts'] = '2026-02-01T00:00:00Z';

  const { client, calls } = makeFakeSupabase({
    contacts: [{ id: 'c1', name: 'New contact', updated_at: '2026-02-02T00:00:00Z' }],
  });

  await pullDirectTables({
    getSupabase: () => client,
    db,
    getMeta,
    setMeta,
    notifyTablesChanged: () => {},
  });

  const contactsCall = calls.find((c) => c.table === 'contacts');
  expect(contactsCall?.gtValue).toBe('2026-02-01T00:00:00Z');
  expect(meta['last_pull:contacts']).toBe('2026-02-02T00:00:00Z');
});

test('applies a soft-delete row (deleted_at set) when it is newer than local', async () => {
  const db = makeFakeDb({
    'contacts:c1': { id: 'c1', name: 'Alive', updated_at: '2026-01-01T00:00:00Z', deleted_at: null },
  });
  const { getMeta, setMeta } = makeMetaStore();

  const { client } = makeFakeSupabase({
    contacts: [{ id: 'c1', name: 'Alive', updated_at: '2026-01-05T00:00:00Z', deleted_at: '2026-01-05T00:00:00Z' }],
  });

  await pullDirectTables({
    getSupabase: () => client,
    db,
    getMeta,
    setMeta,
    notifyTablesChanged: () => {},
  });

  expect(db.store['contacts:c1'].deleted_at).toBe('2026-01-05T00:00:00Z');
});

test('does not touch the watermark or notify when no rows come back for a table', async () => {
  const db = makeFakeDb();
  const { getMeta, setMeta, meta } = makeMetaStore();
  const { client } = makeFakeSupabase({}); // every table returns []

  const notified: string[] = [];
  await pullDirectTables({
    getSupabase: () => client,
    db,
    getMeta,
    setMeta,
    notifyTablesChanged: (t) => notified.push(...(Array.isArray(t) ? t : [t])),
  });

  expect(meta['last_pull:tasks']).toBeUndefined();
  expect(notified).toEqual([]);
});

test('defense-in-depth: writes only the explicit column whitelist, dropping unexpected cloud keys', async () => {
  const db = makeFakeDb();
  const { getMeta, setMeta } = makeMetaStore();
  const { client } = makeFakeSupabase({
    tasks: [
      {
        id: 'task-9',
        title: 'Legit title',
        updated_at: '2026-01-01T00:00:00Z',
        // Not a real local column — simulates a compromised/malformed cloud row.
        __proto__malicious: 'DROP TABLE tasks;',
        arbitrary_injected_column: 'should not appear locally',
      },
    ],
  });

  await pullDirectTables({
    getSupabase: () => client,
    db,
    getMeta,
    setMeta,
    notifyTablesChanged: () => {},
  });

  const written = db.store['tasks:task-9'];
  expect(written.title).toBe('Legit title');
  expect(written).not.toHaveProperty('arbitrary_injected_column');
});

test('warns (does not throw) and keeps processing other tables when a fetch errors', async () => {
  const db = makeFakeDb();
  const { getMeta, setMeta, meta } = makeMetaStore();
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  const client: PullableSupabaseClient = {
    from(table: string) {
      return {
        select() {
          return {
            gt() {
              return {
                order() {
                  if (table === 'tasks') {
                    return Promise.resolve({ data: null, error: new Error('network boom') });
                  }
                  if (table === 'contacts') {
                    return Promise.resolve({
                      data: [{ id: 'c1', name: 'Still works', updated_at: '2026-01-01T00:00:00Z' }],
                      error: null,
                    });
                  }
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
            in() {
              throw new Error('pullDirectTables does not use .in()');
            },
          };
        },
      };
    },
  };

  await expect(
    pullDirectTables({
      getSupabase: () => client,
      db,
      getMeta,
      setMeta,
      notifyTablesChanged: () => {},
    })
  ).resolves.not.toThrow();

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('tasks'), expect.anything());
  // The errored table's watermark is left untouched (nothing was actually seen).
  expect(meta['last_pull:tasks']).toBeUndefined();
  // A different table's fetch still succeeds and is applied normally.
  expect(db.store['contacts:c1'].name).toBe('Still works');

  warnSpy.mockRestore();
});

// ----------------------------------------------------------------------------
// pullTaskChildren (Task 9) — separate fakes: the child-pull data flow has no
// reconcile step (no last-write-wins; child tables are append/replace, see
// pull.ts's module comment), so its Supabase seam only needs `.select().in()`
// (no `.gt().order()` watermark filter) and its db seam only needs
// delete-then-insert, not a per-row read.
// ----------------------------------------------------------------------------

function makeFakeChildSupabase(rowsByTable: Record<string, CloudRow[]>): {
  client: PullableSupabaseClient;
  calls: { table: string; inColumn: string; inValues: string[] }[];
} {
  const calls: { table: string; inColumn: string; inValues: string[] }[] = [];
  const client: PullableSupabaseClient = {
    from(table: string) {
      return {
        select() {
          return {
            gt() {
              throw new Error('pullTaskChildren does not use .gt()');
            },
            in(inColumn: string, inValues: string[]) {
              calls.push({ table, inColumn, inValues });
              const rows = (rowsByTable[table] ?? []).filter((r) => inValues.includes(r.task_id as string));
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

function makeFakeChildDb(seed: Record<string, CloudRow[]> = {}): PullChildrenDb & { store: Record<string, CloudRow[]> } {
  const store: Record<string, CloudRow[]> = {};
  for (const key of Object.keys(seed)) store[key] = [...seed[key]];
  return {
    store,
    async deleteRows(table, taskIds) {
      const rows = store[table] ?? [];
      store[table] = rows.filter((r) => !taskIds.includes(r.task_id as string));
    },
    async insertRow(table, columns, row) {
      const filtered: CloudRow = {};
      for (const c of columns) filtered[c] = row[c] ?? null;
      store[table] = [...(store[table] ?? []), filtered];
    },
  };
}

describe('pullTaskChildren', () => {
  test('client null -> no-op', async () => {
    const db = makeFakeChildDb();
    const notified: string[] = [];

    await pullTaskChildren(['T1'], {
      getSupabase: () => null,
      db,
      notifyTablesChanged: (t) => notified.push(...(Array.isArray(t) ? t : [t])),
    });

    expect(notified).toEqual([]);
  });

  test('empty taskIds -> no-op, does not query Supabase', async () => {
    const db = makeFakeChildDb();
    const { client, calls } = makeFakeChildSupabase({});

    await pullTaskChildren([], { getSupabase: () => client, db, notifyTablesChanged: () => {} });

    expect(calls).toEqual([]);
  });

  test('replaces local child rows for the pulled task only, leaving other tasks untouched', async () => {
    const db = makeFakeChildDb({
      task_remarks: [{ id: 'r-old', task_id: 'T1', body: 'stale local remark', created_at: '2026-01-01T00:00:00Z' }],
      task_links: [{ id: 'l-t2', task_id: 'T2', link_type: 'drive', label: null, url: 'https://t2', created_at: '2026-01-01T00:00:00Z' }],
    });

    const { client, calls } = makeFakeChildSupabase({
      task_remarks: [{ id: 'r1', task_id: 'T1', body: 'fresh remark', author_id: 'u1', created_at: '2026-02-01T00:00:00Z' }],
      task_links: [{ id: 'l1', task_id: 'T1', link_type: 'drive', label: 'Doc', url: 'https://t1', created_at: '2026-02-01T00:00:00Z' }],
    });

    const notified: string[] = [];
    await pullTaskChildren(['T1'], {
      getSupabase: () => client,
      db,
      notifyTablesChanged: (t) => notified.push(...(Array.isArray(t) ? t : [t])),
    });

    // T1's stale remark is gone, replaced by the fresh cloud row.
    expect(db.store['task_remarks']).toEqual([
      { id: 'r1', task_id: 'T1', body: 'fresh remark', author_id: 'u1', original_language: null, created_at: '2026-02-01T00:00:00Z' },
    ]);

    // T2's link is untouched; T1's new link was inserted alongside it.
    expect(db.store['task_links']).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'l-t2', task_id: 'T2' }), expect.objectContaining({ id: 'l1', task_id: 'T1' })])
    );
    expect(db.store['task_links']).toHaveLength(2);

    // Every child table queried with `task_id in ['T1']`.
    const remarksCall = calls.find((c) => c.table === 'task_remarks');
    expect(remarksCall?.inColumn).toBe('task_id');
    expect(remarksCall?.inValues).toEqual(['T1']);

    expect(notified).toEqual(
      expect.arrayContaining(['task_remarks', 'task_links', 'task_emails', 'locations', 'meetings', 'travel_plans', 'task_contacts'])
    );
  });

  test('defense-in-depth: writes only the explicit column whitelist, dropping unexpected cloud keys', async () => {
    const db = makeFakeChildDb();
    const { client } = makeFakeChildSupabase({
      task_contacts: [{ id: 'tc1', task_id: 'T1', contact_id: 'c1', created_at: '2026-01-01T00:00:00Z', arbitrary_injected_column: 'nope' }],
    });

    await pullTaskChildren(['T1'], { getSupabase: () => client, db, notifyTablesChanged: () => {} });

    expect(db.store['task_contacts']).toEqual([{ id: 'tc1', task_id: 'T1', contact_id: 'c1', created_at: '2026-01-01T00:00:00Z' }]);
  });

  test('warns (does not throw) and keeps processing other tables when a fetch errors', async () => {
    const db = makeFakeChildDb();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const client: PullableSupabaseClient = {
      from(table: string) {
        return {
          select() {
            return {
              gt() {
                throw new Error('unused');
              },
              in() {
                if (table === 'task_remarks') return Promise.resolve({ data: null, error: new Error('network boom') });
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
        };
      },
    };

    await expect(
      pullTaskChildren(['T1'], { getSupabase: () => client, db, notifyTablesChanged: () => {} })
    ).resolves.not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('task_remarks'), expect.anything());
    warnSpy.mockRestore();
  });
});
