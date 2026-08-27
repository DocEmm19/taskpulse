import { pullDirectTables, PullDb, PullableSupabaseClient, PullDeps } from '../pull';

// Two-client sync integration test. Drives the REAL pullDirectTables + reconcile
// against a shared in-memory "cloud" that stamps updated_at server-side on every
// write — i.e. the migration-003 trigger. This reproduces the exact flow the
// cross-device bug broke (an edit on one device never reaching the other) and
// pins the invariant that fixed it: when updated_at is server-monotonic, a
// device's pull watermark can never outrun a peer's later update.
//
// No browser, no real Supabase — the bug was in sync logic, not the UI, so this
// is the smallest check that catches its whole class.
// ponytail: JS-level integration over a Playwright/CI-Supabase rig; add that
// only when a UI-level (not logic-level) sync regression actually appears.

type Row = Record<string, unknown>;

// Shared cloud with a monotonic server clock — every push gets a strictly
// increasing updated_at, exactly like `updated_at = now()` in the DB trigger.
function makeCloud() {
  const rows: Record<string, Row[]> = { tasks: [] };
  let tick = 0;
  const stamp = () => new Date(Date.parse('2026-08-27T00:00:00.000Z') + tick++ * 1000).toISOString();
  return {
    rows,
    // server-stamps updated_at, ignoring whatever the client sent
    push(table: string, row: Row) {
      const withStamp = { ...row, updated_at: stamp() };
      const arr = rows[table] ?? (rows[table] = []);
      const i = arr.findIndex((r) => r.id === row.id);
      if (i >= 0) arr[i] = withStamp;
      else arr.push(withStamp);
    },
    client(): PullableSupabaseClient {
      return {
        from(table: string) {
          return {
            select() {
              return {
                gt(_c: string, v: string) {
                  const data = (rows[table] ?? []).filter((r) => (r.updated_at as string) > v);
                  return { order: () => Promise.resolve({ data: [...data].sort((a, b) => (a.updated_at as string).localeCompare(b.updated_at as string)), error: null }) };
                },
                in() { throw new Error('unused'); },
              };
            },
          };
        },
      };
    },
  };
}

function makeClient(cloud: ReturnType<typeof makeCloud>): { deps: PullDeps; store: Record<string, Row>; pull: () => Promise<void> } {
  const store: Record<string, Row> = {};
  const meta: Record<string, string> = {};
  const db: PullDb = {
    async getRow(t, id) { return store[`${t}:${id}`] ?? null; },
    async upsertRow(t, cols, row) { const f: Row = {}; for (const c of cols) f[c] = row[c] ?? null; store[`${t}:${row.id as string}`] = f; },
  };
  const deps: PullDeps = {
    getSupabase: () => cloud.client(),
    db,
    getMeta: async (k) => meta[k] ?? null,
    setMeta: async (k, v) => { meta[k] = v; },
    notifyTablesChanged: () => {},
  };
  return { deps, store, pull: async () => { await pullDirectTables(deps); } };
}

test("A's later edit reaches B even after B's own more-recent write", async () => {
  const cloud = makeCloud();
  const A = makeClient(cloud);
  const B = makeClient(cloud);

  // A creates a task; B pulls it.
  cloud.push('tasks', { id: 't1', title: 'Book flights', category_id: 'c1' });
  await B.pull();
  expect(B.store['tasks:t1'].title).toBe('Book flights');

  // B creates its OWN task (advances B's watermark to a newer stamp) and pulls.
  cloud.push('tasks', { id: 't2', title: 'Call vendor', category_id: 'c1' });
  await B.pull();
  expect(B.store['tasks:t2']).toBeDefined();

  // A now edits t1 — server stamps it NEWER than B's t2 write.
  cloud.push('tasks', { id: 't1', title: 'Book flights (rescheduled)', category_id: 'c1' });

  // B pulls again: the edit must arrive, not be filtered out by B's watermark.
  await B.pull();
  expect(B.store['tasks:t1'].title).toBe('Book flights (rescheduled)');
});

test('a stale re-push (older than local) does not clobber the local copy', async () => {
  const cloud = makeCloud();
  const A = makeClient(cloud);

  cloud.push('tasks', { id: 't1', title: 'v1', category_id: 'c1' });
  await A.pull();
  // Local edit A already has as the newest; simulate by bumping local updated_at
  // beyond any cloud row, then a cloud row that is older must not overwrite it.
  A.store['tasks:t1'] = { ...A.store['tasks:t1'], title: 'local-newer', updated_at: '2999-01-01T00:00:00.000Z' };
  cloud.push('tasks', { id: 't1', title: 'ancient' }); // gets an early-ish stamp, < 2999
  // reset A's watermark so it re-fetches the row
  await A.deps.setMeta('last_pull:tasks', '2026-08-27T00:00:00.000Z');
  await A.pull();
  expect(A.store['tasks:t1'].title).toBe('local-newer');
});
