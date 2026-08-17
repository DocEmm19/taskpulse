import NetInfo from '@react-native-community/netinfo';
import { readFileBytes } from '../localFiles';
import { getDb } from '../../db/database';
import { getSupabase, isSupabaseConfigured, ATTACHMENTS_BUCKET } from './supabaseClient';
import { getCurrentUserId } from '../../store/sessionStore';
import { notifyTablesChanged } from '../../db/events';
import { SyncQueueItem } from '../../types/models';
import { DirectCloudTable, TaskChildCloudTable, TABLE_COLUMNS, TASK_CHILD_COLUMNS } from './syncTables';
import { pullDirectTables, pullTaskChildren } from './pull';
import { startRealtime } from './realtime';
import { isWeb } from '../platform';

// ----------------------------------------------------------------------------
// Connectivity — platform-aware. On WEB we must NOT touch NetInfo at all:
// NetInfo's default web reachability check does a recurring `HEAD` against
// the DOMAIN ROOT (not the app's base path), which 404s on GitHub Pages and
// floods the console — and if that reachability probe ever reports
// unreachable, it would silently disable sync in production. `navigator.
// onLine` is a local, no-network browser signal and is COEP/CORP-safe (no
// cross-origin fetch), so it's the correct substitute on web. Native keeps
// using NetInfo exactly as before.
// ----------------------------------------------------------------------------

async function isOnline(): Promise<boolean> {
  if (isWeb) {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
  const net = await NetInfo.fetch();
  return !!net.isConnected;
}

/** Subscribes `cb` to "connectivity (re)established" events and returns an
 * unsubscribe function. Web: `window`'s `online` event. Native: NetInfo's
 * addEventListener, firing only on transitions to connected — unchanged from
 * the prior behavior. */
function subscribeConnectivity(cb: () => void): () => void {
  if (isWeb) {
    const handler = () => cb();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) cb();
  });
}

// ----------------------------------------------------------------------------
// Sync Engine — implements ARCHITECTURE.md §4. This is the ONLY module in the
// app that talks to Supabase. Every screen reads/writes local SQLite only; this
// engine drains `sync_queue` in the background and is safe to call repeatedly.
//
// Direct-entity tables: the queue's entity_id IS the row's own primary key, so
// we simply re-read that row from SQLite and upsert it to the same-named cloud
// table (the local and cloud schemas are intentionally identical — see §5.2).
//
// Task-child tables: several repositories (remarks, links, emails, location,
// meeting, travel plan, contacts-on-task) queue the *task's* id rather than a
// child row's id, because "this task's related data changed" is what matters.
// For those we resync every child row for that task — small tables, so this is
// cheap and trivially idempotent.
// ----------------------------------------------------------------------------

// Values are typed as DirectCloudTable (./syncTables) — the single source of
// truth for the direct-entity cloud table names, shared with pull.ts's pull
// side. This doesn't force every DIRECT_CLOUD_TABLES entry to appear as a
// value here (entity_type keys are push-side/sync_queue routing, a separate
// concern), but it does mean a typo'd or stale value fails to compile.
const DIRECT_TABLES: Record<string, DirectCloudTable> = {
  task: 'tasks',
  contact: 'contacts',
  task_category: 'task_categories',
  attachment: 'attachments',
  calendar_event: 'calendar_events',
};

// Values are typed as TaskChildCloudTable (./syncTables) — the single source
// of truth for the task-child cloud table names, shared with pull.ts's
// `pullTaskChildren` (Task 9). Same compile-time guard as DIRECT_TABLES above.
const TASK_CHILD_TABLES: Record<string, TaskChildCloudTable> = {
  task_remark: 'task_remarks',
  task_link: 'task_links',
  task_email: 'task_emails',
  location: 'locations',
  meeting: 'meetings',
  travel_plan: 'travel_plans',
  task_contact: 'task_contacts',
};

let isRunning = false;
let timer: ReturnType<typeof setInterval> | null = null;
let stopRealtime: (() => void) | null = null;
let stopConnectivity: (() => void) | null = null;

export function startSyncEngine() {
  if (timer) return; // guards double-start: also prevents a duplicate Realtime channel below
  stopConnectivity = subscribeConnectivity(() => runSyncCycle());
  timer = setInterval(runSyncCycle, 30_000);
  runSyncCycle();

  // Realtime is purely an accelerator on top of the 30s poll above (which
  // remains the correctness backstop): on any Postgres change event it just
  // triggers an extra runSyncCycle() so a change made by one user surfaces on
  // the other within seconds. No-ops if Supabase isn't configured.
  stopRealtime = startRealtime(() => runSyncCycle());
}

export function stopSyncEngine() {
  if (timer) clearInterval(timer);
  timer = null;
  if (stopRealtime) stopRealtime();
  stopRealtime = null;
  if (stopConnectivity) stopConnectivity();
  stopConnectivity = null;
}

export async function runSyncCycle(): Promise<void> {
  if (isRunning) return;
  if (!isSupabaseConfigured()) return; // fully offline mode — nothing to do
  if (!(await isOnline())) return;

  isRunning = true;
  try {
    const db = await getDb();
    const items = await db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status IN ('queued','failed') ORDER BY created_at ASC LIMIT 25`
    );
    for (const item of items) {
      await processQueueItem(item).catch(async (err) => {
        await backoffItem(item, err);
      });
    }

    // Pull (Task 8/9) runs after the push drain above so a device's own
    // just-pushed writes are already up before it asks the cloud what's new.
    // Same guards as push (isRunning/isSupabaseConfigured/online, all checked
    // above) and the same `finally` below resets isRunning even if a pull
    // step throws.
    const changedTaskIds = await pullDirectTables();
    await pullTaskChildren(changedTaskIds);
  } finally {
    isRunning = false;
  }
}

async function processQueueItem(item: SyncQueueItem) {
  const db = await getDb();
  await db.runAsync(`UPDATE sync_queue SET status = 'in_flight' WHERE id = ?`, [item.id]);

  if (item.operation === 'UPLOAD_FILE') {
    await pushAttachmentFile(item.entity_id);
  } else if (item.operation === 'DELETE_FILE') {
    // Metadata row is already gone locally; nothing further to do without a
    // cloud row to point at (Phase 2: track storage_path before delete).
  } else if (DIRECT_TABLES[item.entity_type]) {
    await pushDirectRow(DIRECT_TABLES[item.entity_type], item.entity_id, item.operation);
  } else if (TASK_CHILD_TABLES[item.entity_type]) {
    await pushTaskChildren(TASK_CHILD_TABLES[item.entity_type], item.entity_id);
  }

  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
  notifyTablesChanged('sync_queue');
}

async function pushDirectRow(table: string, id: string, operation: SyncQueueItem['operation']) {
  const supabase = getSupabase();
  if (!supabase) return;
  const db = await getDb();

  if (operation === 'DELETE') {
    await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    return;
  }

  const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return;
  const { error } = await supabase.from(table).upsert(sanitizeRow(row, table));
  if (error) throw error;

  if (table === 'tasks' || table === 'attachments') {
    await db.runAsync(`UPDATE ${table} SET sync_status = 'synced' WHERE id = ?`, [id]);
    notifyTablesChanged(table === 'tasks' ? 'tasks' : 'attachments');
  }
}

async function pushTaskChildren(table: string, taskId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE task_id = ?`, [taskId]);
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows.map((row) => sanitizeRow(row, table)));
  if (error) throw error;
}

async function pushAttachmentFile(attachmentId: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string; task_id: string; local_path: string | null; file_name: string; mime_type: string | null }>(
    'SELECT id, task_id, local_path, file_name, mime_type FROM attachments WHERE id = ?',
    [attachmentId]
  );
  if (!row || !row.local_path) return;

  const bytes = await readFileBytes(row.local_path);
  const storagePath = `${getCurrentUserId()}/${row.task_id}/${row.id}_${row.file_name}`;
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: row.mime_type ?? undefined, upsert: true });
  if (uploadError) throw uploadError;

  await db.runAsync(`UPDATE attachments SET storage_path = ?, sync_status = 'synced' WHERE id = ?`, [storagePath, attachmentId]);
  const fullRow = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM attachments WHERE id = ?', [attachmentId]);
  if (fullRow) await supabase.from('attachments').upsert(sanitizeRow(fullRow, 'attachments'));
  notifyTablesChanged('attachments');
}

// Merged column whitelist across both direct-entity and task-child cloud
// tables, keyed by cloud table name — the same maps pull.ts uses to restrict
// what a cloud row may write into SQLite (./syncTables is the single source
// of truth shared by both sync directions).
const CLOUD_TABLE_COLUMNS: Record<string, readonly string[]> = { ...TABLE_COLUMNS, ...TASK_CHILD_COLUMNS };

/** Restricts `row` to the columns valid for `table` in the cloud schema
 * before an upsert, dropping SQLite-only columns that don't exist there.
 * Uses CLOUD_TABLE_COLUMNS (./syncTables) so push and pull agree on the cloud
 * column set per table. Falls back to a shallow clone (no filtering) for any
 * table not present in that whitelist. Exported for direct unit testing —
 * see __tests__/syncEngine.test.ts. */
export function sanitizeRow(row: Record<string, unknown>, table: string): Record<string, unknown> {
  const columns = CLOUD_TABLE_COLUMNS[table];
  if (!columns) return { ...row };

  const filtered: Record<string, unknown> = {};
  for (const column of columns) {
    filtered[column] = row[column];
  }
  return filtered;
}

/** Exponential backoff: 2s, 4s, 8s, 16s ... capped at 5 minutes (ARCHITECTURE.md §4.1). */
async function backoffItem(item: SyncQueueItem, err: unknown) {
  const db = await getDb();
  const nextRetry = Math.min(item.retry_count + 1, 20);
  await db.runAsync(`UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ? WHERE id = ?`, [
    nextRetry,
    String((err as Error)?.message ?? err),
    item.id,
  ]);
}
