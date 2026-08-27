import { getDb } from '../database';
import { newId } from '../../lib/uuid';
import { notifyTablesChanged } from '../events';
import { getMeta, setMeta } from '../database';
import { nowIso, enqueueSync } from '../helpers';
import { getCurrentUserId } from '../../store/sessionStore';
import { TaskCategory } from '../../types/models';
import { colors } from '../../theme/theme';

const DEFAULTS: Array<Omit<TaskCategory, 'id' | 'created_by' | 'created_at' | 'updated_at'>> = [
  { name: 'Personal', color_hex: colors.categoryPersonal, icon: 'person-circle-outline', is_default: 1, sort_order: 0 },
  { name: 'Official', color_hex: colors.categoryOfficial, icon: 'briefcase-outline', is_default: 1, sort_order: 1 },
  { name: 'Travel', color_hex: colors.categoryTravel, icon: 'airplane-outline', is_default: 1, sort_order: 2 },
  { name: 'Urgent', color_hex: colors.categoryUrgent, icon: 'alert-circle-outline', is_default: 1, sort_order: 3 },
  { name: 'Network', color_hex: '#0EA5E9', icon: 'people-outline', is_default: 1, sort_order: 4 },
];

/** Idempotent — safe to call on every app start. Seeds the 4 required default
 * categories (Req. #4) exactly once. */
export async function ensureDefaultCategories(): Promise<void> {
  const db = await getDb();
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM task_categories');
  if (count && count.c > 0) return;
  const now = nowIso();
  // Own the defaults with this device's current user id (local id pre-sign-in;
  // reattributed to the real Supabase id by claimLocalDataForUser on sign-in)
  // and queue them to sync. Previously these were seeded with created_by = NULL
  // and never enqueued, so they never reached the cloud — and since
  // tasks.category_id is a NOT NULL foreign key to task_categories, EVERY task
  // push was rejected by the cloud (FK violation) and silently retried forever,
  // which is why nothing synced once cloud sync was turned on.
  const ownerId = getCurrentUserId();
  for (const cat of DEFAULTS) {
    const id = newId();
    await db.runAsync(
      `INSERT INTO task_categories (id, name, color_hex, icon, is_default, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cat.name, cat.color_hex, cat.icon, cat.is_default, cat.sort_order, ownerId, now, now]
    );
    await enqueueSync('task_category', id, 'CREATE', { name: cat.name, color_hex: cat.color_hex, icon: cat.icon });
  }
  notifyTablesChanged('task_categories');
}

const NETWORK_MIGRATION_FLAG = 'category_network_v1';

/** One-time backfill of the "Network" default category for devices that were
 * seeded before it existed (new installs get it via ensureDefaultCategories).
 * Flag-gated so it runs exactly once — it will NOT re-add Network if the user
 * later deletes it (unlike the initial seed's all-or-nothing guard). Owned by
 * the current user and enqueued so it syncs like any other category. */
export async function ensureNetworkCategoryOnce(): Promise<void> {
  if (await getMeta(NETWORK_MIGRATION_FLAG)) return;
  const db = await getDb();
  const existing = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM task_categories WHERE name = 'Network'`);
  if (!existing || existing.c === 0) {
    const now = nowIso();
    const id = newId();
    await db.runAsync(
      `INSERT INTO task_categories (id, name, color_hex, icon, is_default, sort_order, created_by, created_at, updated_at)
       VALUES (?, 'Network', '#0EA5E9', 'people-outline', 1, 4, ?, ?, ?)`,
      [id, getCurrentUserId(), now, now]
    );
    await enqueueSync('task_category', id, 'CREATE', { name: 'Network', color_hex: '#0EA5E9', icon: 'people-outline' });
    notifyTablesChanged('task_categories');
  }
  await setMeta(NETWORK_MIGRATION_FLAG, new Date().toISOString());
}

export async function listCategories(): Promise<TaskCategory[]> {
  const db = await getDb();
  // Collapse duplicate DEFAULT categories by name to a single chip. Each device
  // seeds its own Personal/Official/Travel/Urgent with a random id, so once the
  // shared workspace syncs, every member pulls the others' four defaults and
  // would otherwise see two of each ("Personal", "Personal", ...). Keeping one
  // row per default name (deterministically, the smallest id) hides the visual
  // duplication without a data migration — tasks still resolve their own
  // category_id by id, and category chips filter by name, so nothing breaks.
  // Custom (non-default) categories are never deduped.
  return db.getAllAsync<TaskCategory>(
    `SELECT * FROM task_categories
     WHERE is_default = 0
        OR id IN (SELECT MIN(id) FROM task_categories WHERE is_default = 1 GROUP BY name)
     ORDER BY sort_order ASC, name ASC`
  );
}

/** Map a (possibly duplicate) default category id to the one listCategories()
 * actually shows for that name — the smallest id among same-named defaults.
 * Custom categories and already-canonical ids are returned unchanged. Used on
 * task edit so the selected category chip highlights correctly even when the
 * task references a synced duplicate default that the deduped picker hides. */
export async function canonicalCategoryId(id: string): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ name: string; is_default: number }>(
    'SELECT name, is_default FROM task_categories WHERE id = ?',
    [id]
  );
  if (!row || !row.is_default) return id;
  const canon = await db.getFirstAsync<{ id: string | null }>(
    'SELECT MIN(id) as id FROM task_categories WHERE is_default = 1 AND name = ?',
    [row.name]
  );
  return canon?.id ?? id;
}

export async function createCategory(name: string, colorHex: string, icon: string): Promise<TaskCategory> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  const maxSort = await db.getFirstAsync<{ m: number }>('SELECT MAX(sort_order) as m FROM task_categories');
  const sortOrder = (maxSort?.m ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO task_categories (id, name, color_hex, icon, is_default, sort_order, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)`,
    [id, name, colorHex, icon, sortOrder, now, now]
  );
  await enqueueSync('task_category', id, 'CREATE', { name, color_hex: colorHex, icon });
  notifyTablesChanged('task_categories');
  return { id, name, color_hex: colorHex, icon, is_default: 0, sort_order: sortOrder, created_by: null, created_at: now, updated_at: now };
}
