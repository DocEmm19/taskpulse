import { getDb, getMeta, setMeta } from '../../db/database';
import { notifyTablesChanged as defaultNotifyTablesChanged } from '../../db/events';
import { shouldApplyIncoming } from './reconcile';
import { DIRECT_CLOUD_TABLES, TASK_CHILD_CLOUD_TABLES, TABLE_COLUMNS, TASK_CHILD_COLUMNS } from './syncTables';
import type { getSupabase as GetSupabaseFn } from './supabaseClient';

// ----------------------------------------------------------------------------
// pull.ts — PULL side of two-way cloud sync (Task 8). syncEngine.ts only
// pushes local writes up; this module is the mirror: it fetches the direct
// tables (DIRECT_CLOUD_TABLES from ./syncTables — the single source of truth
// shared with syncEngine.ts's push-side DIRECT_TABLES map) for rows changed
// since this device's last-pull watermark, reconciles each row against the
// local copy with last-write-wins (reconcile.ts), and upserts winners into
// SQLite.
//
// Wired into runSyncCycle() (Task 10), which calls pullDirectTables() then
// pullTaskChildren() right after the push-queue drain on every cycle.
//
// Every dependency (Supabase client, db reads/writes, meta, notify) is
// injectable via `PullDeps` so this can be fully unit-tested with in-memory
// fakes and no real network or SQLite. Production call sites stay clean:
// `pullDirectTables()` with no args uses the real app wiring.
//
// `./supabaseClient` is deliberately NOT imported at module scope: it eagerly
// pulls in `react-native-url-polyfill/auto` and `@react-native-async-storage/
// async-storage`, neither of which resolve under the plain Jest unit-test
// environment used here (no native modules). It's `require()`d lazily inside
// `getDefaultDeps()`, which only runs when `pullDirectTables()` is called with
// no injected deps (i.e. real app usage) — never from `pull.test.ts`, which
// always injects a fake.
// ----------------------------------------------------------------------------

const DEFAULT_WATERMARK = '1970-01-01T00:00:00Z';

const WATERMARK_RESET_FLAG = 'sync.watermarkReset.v1';

/** One-time self-heal for the client-clock watermark bug. Older builds advanced
 * each `last_pull:<table>` watermark to the max *client-stamped* `updated_at`
 * seen. A device whose clock ran ahead would inflate its watermark past a
 * peer's genuinely-later updates, so `gt('updated_at', watermark)` filtered
 * those updates out permanently (a task edited on one device never reached the
 * other). Once `updated_at` is stamped server-side (migration
 * 003_server_stamped_updated_at.sql), resetting the watermarks lets the next
 * pull rebuild them from authoritative server timestamps. Guarded by app_meta
 * so it runs exactly once per device; the next `runSyncCycle` re-pulls
 * everything (idempotent) and re-establishes correct watermarks. */
export async function resetSyncWatermarksOnce(): Promise<void> {
  if (await getMeta(WATERMARK_RESET_FLAG)) return;
  for (const table of DIRECT_CLOUD_TABLES) {
    await setMeta(`last_pull:${table}`, DEFAULT_WATERMARK);
  }
  await setMeta(WATERMARK_RESET_FLAG, new Date().toISOString());
}

type CloudRow = Record<string, unknown>;

// TABLE_COLUMNS / TASK_CHILD_COLUMNS (the per-cloud-table column whitelists,
// used below as the defense-in-depth boundary restricting what an incoming
// cloud row may write into SQLite) now live in ./syncTables — the single
// source of truth shared with syncEngine.ts's push-side `sanitizeRow` (Task
// 10), so push and pull agree on the cloud column set per table.

/** Minimal shape this module needs from a Supabase client — structurally
 * matches `@supabase/supabase-js`'s `.from(t).select().gt(c, v).order(c, o)`
 * chain (used by `pullDirectTables`) and its `.from(t).select().in(c, vs)`
 * chain (used by `pullTaskChildren`), so production passes the real client
 * untouched while tests inject a plain-object fake with no network and no
 * mocking library. */
export interface PullableSupabaseClient {
  from(table: string): {
    select(columns?: string): {
      gt(
        column: string,
        value: string
      ): {
        order(
          column: string,
          opts?: { ascending?: boolean }
        ): PromiseLike<{ data: CloudRow[] | null; error: unknown }>;
      };
      in(column: string, values: readonly string[]): PromiseLike<{ data: CloudRow[] | null; error: unknown }>;
    };
  };
}

/** Minimal local-db seam: read one row by id, and upsert a row restricted to
 * an explicit column whitelist. Production is backed by `getDb()`; tests back
 * it with an in-memory map. */
export interface PullDb {
  getRow(table: string, id: string): Promise<CloudRow | null>;
  upsertRow(table: string, columns: readonly string[], row: CloudRow): Promise<void>;
}

export interface PullDeps {
  getSupabase: () => PullableSupabaseClient | null;
  db: PullDb;
  getMeta: (key: string) => Promise<string | null>;
  setMeta: (key: string, value: string) => Promise<void>;
  notifyTablesChanged: (tables: string | string[]) => void;
}

/** Local-db seam for `pullTaskChildren`: unlike `PullDb` above, there's no
 * per-row reconcile step here (child tables are append/replace — see the
 * module comment on `pullTaskChildren`), so all this needs is "wipe this
 * table's rows for these tasks" and "insert a row". Production is backed by
 * `getDb()`; tests back it with an in-memory map. */
export interface PullChildrenDb {
  deleteRows(table: string, taskIds: string[]): Promise<void>;
  insertRow(table: string, columns: readonly string[], row: CloudRow): Promise<void>;
}

export interface PullChildrenDeps {
  getSupabase: () => PullableSupabaseClient | null;
  db: PullChildrenDb;
  notifyTablesChanged: (tables: string | string[]) => void;
}

/** expo-sqlite bind values are string | number | boolean | null | blob.
 * Coerce anything else (e.g. a stray object) to a string rather than passing
 * it through untouched. */
function toBindValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

async function defaultGetRow(table: string, id: string): Promise<CloudRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CloudRow>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return row ?? null;
}

async function defaultUpsertRow(table: string, columns: readonly string[], row: CloudRow): Promise<void> {
  const db = await getDb();
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => toBindValue(row[c]));
  // Upsert via INSERT ... ON CONFLICT(id) DO UPDATE rather than INSERT OR
  // REPLACE. REPLACE deletes+reinserts the whole row, so any column NOT in the
  // synced whitelist reverts to its default — which would null out a device's
  // local-only `attachments.local_path` (the on-disk/data-URL pointer to the
  // file) every time its row is pulled, forcing a needless re-download and, on
  // the uploader, orphaning the file it just attached. DO UPDATE writes only
  // the synced columns and leaves local-only columns untouched.
  const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`;
  await db.runAsync(sql, values);
}

async function defaultDeleteRows(table: string, taskIds: string[]): Promise<void> {
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(', ');
  await db.runAsync(`DELETE FROM ${table} WHERE task_id IN (${placeholders})`, taskIds);
}

/** Lazily builds the real-app dependency set. Only invoked when
 * `pullDirectTables()` is called with no injected deps — see the module-level
 * comment for why `./supabaseClient` must not be imported eagerly. */
function getDefaultDeps(): PullDeps {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const supabaseClient = require('./supabaseClient') as { getSupabase: typeof GetSupabaseFn };
  return {
    // Structurally compatible: supabase-js's real `.from().select().gt().order()`
    // chain is a (thenable) superset of `PullableSupabaseClient`.
    getSupabase: supabaseClient.getSupabase as unknown as () => PullableSupabaseClient | null,
    db: { getRow: defaultGetRow, upsertRow: defaultUpsertRow },
    getMeta,
    setMeta,
    notifyTablesChanged: defaultNotifyTablesChanged,
  };
}

/** Lazily builds the real-app dependency set for `pullTaskChildren`. Same
 * lazy-`require('./supabaseClient')` rationale as `getDefaultDeps()` above. */
function getDefaultChildDeps(): PullChildrenDeps {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const supabaseClient = require('./supabaseClient') as { getSupabase: typeof GetSupabaseFn };
  return {
    getSupabase: supabaseClient.getSupabase as unknown as () => PullableSupabaseClient | null,
    db: { deleteRows: defaultDeleteRows, insertRow: defaultUpsertRow },
    notifyTablesChanged: defaultNotifyTablesChanged,
  };
}

/**
 * Pulls every DIRECT_TABLES cloud table changed since this device's last-pull
 * watermark, applies last-write-wins per row (reconcile.ts), advances the
 * watermark to the max `updated_at` seen, and notifies subscribed screens for
 * any table that actually changed locally.
 *
 * Returns the ids of `tasks` rows that were written locally (winners only) so
 * a follow-up pull of their task-child tables (Task 9) knows which tasks to
 * resync children for.
 */
export async function pullDirectTables(deps?: PullDeps): Promise<string[]> {
  const d = deps ?? getDefaultDeps();
  const supabase = d.getSupabase();
  if (!supabase) return [];

  const changedTaskIds: string[] = [];

  for (const table of DIRECT_CLOUD_TABLES) {
    const columns = TABLE_COLUMNS[table];

    const watermarkKey = `last_pull:${table}`;
    const watermark = (await d.getMeta(watermarkKey)) ?? DEFAULT_WATERMARK;

    const { data, error } = await supabase.from(table).select().gt('updated_at', watermark).order('updated_at', { ascending: true });
    if (error) {
      // Distinguish "the fetch failed" from "0 rows changed" — stay resilient
      // (don't throw) so one bad table doesn't block the rest of the pull.
      console.warn(`[pullDirectTables] fetch failed for table "${table}":`, error);
      continue;
    }
    if (!data || data.length === 0) continue;

    let maxUpdatedAt = watermark;
    let tableChanged = false;

    for (const incoming of data) {
      const id = incoming.id as string | undefined;
      if (!id) continue;

      const incomingUpdatedAt = incoming.updated_at as string | null | undefined;
      if (incomingUpdatedAt && incomingUpdatedAt > maxUpdatedAt) {
        maxUpdatedAt = incomingUpdatedAt;
      }

      const local = (await d.db.getRow(table, id)) as { updated_at?: string | null } | null;
      const incomingForReconcile = incoming as { updated_at?: string | null; deleted_at?: string | null };

      if (shouldApplyIncoming(local, incomingForReconcile)) {
        await d.db.upsertRow(table, columns, incoming);
        tableChanged = true;
        if (table === 'tasks') changedTaskIds.push(id);
      }
    }

    if (maxUpdatedAt !== watermark) {
      await d.setMeta(watermarkKey, maxUpdatedAt);
    }
    if (tableChanged) {
      d.notifyTablesChanged(table);
    }
  }

  return changedTaskIds;
}

/**
 * Pulls the task-child cloud tables (TASK_CHILD_CLOUD_TABLES from
 * ./syncTables — the single source of truth shared with syncEngine.ts's
 * push-side TASK_CHILD_TABLES map) for the given task ids, and REPLACES the
 * local child rows for exactly those tasks with what the cloud has.
 *
 * Child tables have no version/updated_at reconcile concept: remarks and
 * activity are immutable appends, and links/emails/locations/meetings/travel
 * plans/task-contacts are edited by replacing the task's whole child set (see
 * syncEngine.ts's `pushTaskChildren`, which does the mirror-image full resync
 * on push). So the correct — and idempotent — pull-side operation per table
 * is: fetch every cloud row for these task ids, delete the local rows for
 * these task ids, then re-insert what the cloud returned. Tasks NOT in
 * `taskIds` are never touched.
 *
 * Called with the `tasks` ids returned by `pullDirectTables()` — see
 * syncEngine.ts's `runSyncCycle` (Task 10), which chains them together.
 */
export async function pullTaskChildren(taskIds: string[], deps?: PullChildrenDeps): Promise<void> {
  if (taskIds.length === 0) return;

  const d = deps ?? getDefaultChildDeps();
  const supabase = d.getSupabase();
  if (!supabase) return;

  for (const table of TASK_CHILD_CLOUD_TABLES) {
    const columns = TASK_CHILD_COLUMNS[table];

    const { data, error } = await supabase.from(table).select().in('task_id', taskIds);
    if (error) {
      // Same resilience posture as pullDirectTables: one bad table shouldn't
      // block the rest, and shouldn't destroy the local copy either — skip
      // straight past the delete+reinsert for this table.
      console.warn(`[pullTaskChildren] fetch failed for table "${table}":`, error);
      continue;
    }

    await d.db.deleteRows(table, taskIds);
    for (const row of data ?? []) {
      await d.db.insertRow(table, columns, row);
    }

    d.notifyTablesChanged(table);
  }
}
