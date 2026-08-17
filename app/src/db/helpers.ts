import type * as SQLite from 'expo-sqlite';
import { getDb } from './database';
import { newId } from '../lib/uuid';
import { notifyTablesChanged } from './events';
import { ActivityEventType, SyncOperation, TaskActivity } from '../types/models';
import { getDeviceId, getCurrentUserName } from '../store/sessionStore';

export function nowIso(): string {
  return new Date().toISOString();
}

/** Pure builder for a `task_activity` row — no DB access, so it's unit-testable
 * without a SQLite instance. Attributes the row to whoever is logged in right
 * now via `getCurrentUserName()` (never hard-code a name here). Kept in sync
 * with the `task_activity` schema/`TaskActivity` type. */
export function buildActivityRow(taskId: string, eventType: ActivityEventType, description: string): TaskActivity {
  return {
    id: newId(),
    task_id: taskId,
    event_type: eventType,
    description,
    actor_device_id: getDeviceId(),
    actor_name: getCurrentUserName(),
    created_at: nowIso(),
  };
}

/** Appends an immutable row to task_activity. Never call UPDATE on this table —
 * per ARCHITECTURE.md §5.2/#40, activity history is append-only. */
export async function logActivity(taskId: string, eventType: ActivityEventType, description: string) {
  const db = await getDb();
  const row = buildActivityRow(taskId, eventType, description);
  await db.runAsync(
    `INSERT INTO task_activity (id, task_id, event_type, description, actor_device_id, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.task_id, row.event_type, row.description, row.actor_device_id, row.actor_name, row.created_at]
  );
  notifyTablesChanged('task_activity');
}

/** Queues a row for the (stubbed) Sync Engine to push to Supabase later. Every
 * write to a syncable table should call this — see ARCHITECTURE.md §4.1. */
export async function enqueueSync(entityType: string, entityId: string, operation: SyncOperation, payload?: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at)
     VALUES (?, ?, ?, ?, ?, 0, 'queued', ?)`,
    [newId(), entityType, entityId, operation, payload ? JSON.stringify(payload) : null, nowIso()]
  );
  notifyTablesChanged('sync_queue');
}

/** Bumps the parent `tasks` row after any task-child mutation (remark, email,
 * link, location, meeting, calendar event, travel plan, contact-on-task).
 *
 * Root cause (final-fix-findings.md, FINDING 1): `pullTaskChildren` only ever
 * runs for tasks whose OWN `updated_at` advanced past the other device's
 * watermark (see sync/pull.ts's `pullDirectTables` → `changedTaskIds` →
 * `pullTaskChildren`). Child-mutation repo fns used to INSERT the child row +
 * `enqueueSync('<child>', taskId)` without touching the parent, so the other
 * device's `pullDirectTables` never saw this task as changed and the child
 * pull never fired — two-way sync was silently broken for every child table
 * in daily/incremental use.
 *
 * Mirrors `updateTask`'s own bump exactly (version/sync_status/updated_at),
 * then enqueues a `task` UPDATE the same way. The pull-side reconcile
 * (reconcile.ts) is monotonic on `updated_at`, so bumping the parent on every
 * child mutation is safe and can never create a reconcile loop. Takes an
 * already-open `db` handle so callers that already did `getDb()` don't pay
 * for a second call. */
export async function touchParentTask(db: SQLite.SQLiteDatabase, taskId: string): Promise<void> {
  const now = nowIso();
  await db.runAsync(
    `UPDATE tasks SET version = version + 1, sync_status = 'pending_update', updated_at = ? WHERE id = ?`,
    [now, taskId]
  );
  await enqueueSync('task', taskId, 'UPDATE', { touchedBy: 'child_mutation' });
  notifyTablesChanged('tasks');
}
