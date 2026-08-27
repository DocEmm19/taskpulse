import { getDb } from './database';
import { notifyTablesChanged } from './events';

/**
 * One-time reattribution run the first time a device signs in to Supabase.
 *
 * Tasks/contacts/categories created while fully offline are owned by a
 * locally-generated id (sessionStore's `userId`). Cloud RLS keys everything
 * off the real `auth.uid()` (ARCHITECTURE.md §5.3), so anything created
 * before sign-in would otherwise fail to sync (FK/RLS mismatch) and silently
 * never leave the device. This rewrites every `created_by`/`author_id`/etc.
 * column from the old local id to the new Supabase user id, and re-queues
 * every affected row so the Sync Engine picks it up on the next cycle.
 */
export async function claimLocalDataForUser(oldLocalUserId: string, newSupabaseUserId: string): Promise<void> {
  if (!oldLocalUserId || oldLocalUserId === newSupabaseUserId) return;
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE tasks SET created_by = ?, version = version + 1, sync_status = 'pending_update' WHERE created_by = ?`,
      [newSupabaseUserId, oldLocalUserId]
    );
    // task_categories/attachments also need updated_at bumped (Task 10 fix):
    // last-write-wins pull reconcile (reconcile.ts) and the cloud upsert both
    // key off updated_at, so a created_by/uploaded_by rewrite that doesn't
    // touch it can get silently dropped or never noticed as "changed".
    await db.runAsync(`UPDATE task_categories SET created_by = ?, updated_at = ? WHERE created_by = ?`, [
      newSupabaseUserId,
      now,
      oldLocalUserId,
    ]);
    // Legacy default categories (older builds seeded Personal/Official/Travel/
    // Urgent with created_by = NULL and never queued them) are owned by no one,
    // so the rewrite above — keyed on the old local id — misses them entirely.
    // Adopt those NULL-owned rows too, or they never reach the cloud and every
    // task's category foreign key keeps failing on push. The re-queue below
    // (WHERE created_by = newSupabaseUserId) then picks them up.
    await db.runAsync(`UPDATE task_categories SET created_by = ?, updated_at = ? WHERE created_by IS NULL`, [
      newSupabaseUserId,
      now,
    ]);
    await db.runAsync(`UPDATE contacts SET created_by = ? WHERE created_by = ?`, [newSupabaseUserId, oldLocalUserId]);
    await db.runAsync(`UPDATE task_remarks SET author_id = ? WHERE author_id = ?`, [newSupabaseUserId, oldLocalUserId]);
    await db.runAsync(`UPDATE task_reassignments SET changed_by = ? WHERE changed_by = ?`, [newSupabaseUserId, oldLocalUserId]);
    await db.runAsync(`UPDATE attachments SET uploaded_by = ?, updated_at = ? WHERE uploaded_by = ?`, [
      newSupabaseUserId,
      now,
      oldLocalUserId,
    ]);

    // Re-queue every task this device owns so the newly-valid rows actually sync up.
    const owned = await db.getAllAsync<{ id: string }>(`SELECT id FROM tasks WHERE created_by = ?`, [newSupabaseUserId]);
    for (const row of owned) {
      await db.runAsync(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at)
         VALUES (?, 'task', ?, 'CREATE', NULL, 0, 'queued', datetime('now'))`,
        [`claim_${row.id}`, row.id]
      );
    }

    // Same re-queue pattern for task_categories and attachments: their
    // created_by/uploaded_by reassignment above previously never re-entered
    // sync_queue, so these rows could silently never leave the device.
    const ownedCategories = await db.getAllAsync<{ id: string }>(`SELECT id FROM task_categories WHERE created_by = ?`, [
      newSupabaseUserId,
    ]);
    for (const row of ownedCategories) {
      await db.runAsync(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at)
         VALUES (?, 'task_category', ?, 'CREATE', NULL, 0, 'queued', datetime('now'))`,
        [`claim_cat_${row.id}`, row.id]
      );
    }

    const ownedAttachments = await db.getAllAsync<{ id: string }>(`SELECT id FROM attachments WHERE uploaded_by = ?`, [
      newSupabaseUserId,
    ]);
    for (const row of ownedAttachments) {
      await db.runAsync(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at)
         VALUES (?, 'attachment', ?, 'CREATE', NULL, 0, 'queued', datetime('now'))`,
        [`claim_att_${row.id}`, row.id]
      );
    }
  });

  notifyTablesChanged(['tasks', 'task_categories', 'contacts', 'task_remarks', 'task_reassignments', 'attachments', 'sync_queue']);
}

/**
 * Adopt orphaned (created_by IS NULL) default categories under the current
 * Supabase user and queue them to push.
 *
 * Must run on EVERY boot that has a Supabase session — not only on a fresh
 * sign-in. claimLocalDataForUser() (above) only runs from the sign-in gate, but
 * a device that already has a persisted session skips the gate entirely at
 * startup (App.tsx resolveCloudGate), so legacy NULL-owned default categories
 * on an already-signed-in device would otherwise never get adopted — leaving
 * every task push failing the category foreign key forever. Idempotent and
 * cheap: it early-returns once no NULL-owned rows remain, and the re-queue uses
 * INSERT OR REPLACE so running it on each boot can never hit a duplicate-id
 * (PRIMARY KEY) conflict in sync_queue.
 */
export async function adoptOrphanCategoriesForUser(supabaseUserId: string): Promise<void> {
  if (!supabaseUserId) return;
  const db = await getDb();
  const orphans = await db.getAllAsync<{ id: string }>(`SELECT id FROM task_categories WHERE created_by IS NULL`);
  if (orphans.length === 0) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE task_categories SET created_by = ?, updated_at = ? WHERE created_by IS NULL`, [supabaseUserId, now]);
    for (const row of orphans) {
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_queue (id, entity_type, entity_id, operation, payload, retry_count, status, created_at)
         VALUES (?, 'task_category', ?, 'CREATE', NULL, 0, 'queued', datetime('now'))`,
        [`adopt_cat_${row.id}`, row.id]
      );
    }
  });
  notifyTablesChanged(['task_categories', 'sync_queue']);
}
