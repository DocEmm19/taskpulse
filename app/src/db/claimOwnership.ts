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
