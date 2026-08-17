import { getDb } from '../database';
import { newId } from '../../lib/uuid';
import { notifyTablesChanged } from '../events';
import { nowIso, enqueueSync } from '../helpers';
import { TaskCategory } from '../../types/models';
import { colors } from '../../theme/theme';

const DEFAULTS: Array<Omit<TaskCategory, 'id' | 'created_by' | 'created_at' | 'updated_at'>> = [
  { name: 'Personal', color_hex: colors.categoryPersonal, icon: 'person-circle-outline', is_default: 1, sort_order: 0 },
  { name: 'Official', color_hex: colors.categoryOfficial, icon: 'briefcase-outline', is_default: 1, sort_order: 1 },
  { name: 'Travel', color_hex: colors.categoryTravel, icon: 'airplane-outline', is_default: 1, sort_order: 2 },
  { name: 'Urgent', color_hex: colors.categoryUrgent, icon: 'alert-circle-outline', is_default: 1, sort_order: 3 },
];

/** Idempotent — safe to call on every app start. Seeds the 4 required default
 * categories (Req. #4) exactly once. */
export async function ensureDefaultCategories(): Promise<void> {
  const db = await getDb();
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM task_categories');
  if (count && count.c > 0) return;
  const now = nowIso();
  for (const cat of DEFAULTS) {
    await db.runAsync(
      `INSERT INTO task_categories (id, name, color_hex, icon, is_default, sort_order, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [newId(), cat.name, cat.color_hex, cat.icon, cat.is_default, cat.sort_order, now, now]
    );
  }
  notifyTablesChanged('task_categories');
}

export async function listCategories(): Promise<TaskCategory[]> {
  const db = await getDb();
  return db.getAllAsync<TaskCategory>('SELECT * FROM task_categories ORDER BY sort_order ASC, name ASC');
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
