import { getDb } from '../database';
import { newId } from '../../lib/uuid';
import { notifyTablesChanged } from '../events';
import { nowIso, logActivity, enqueueSync, touchParentTask } from '../helpers';
import { getCurrentUserId, getDeviceId } from '../../store/sessionStore';
import { Priority, Task, TaskStatus, TaskWithCategory } from '../../types/models';

/** Matches expo-sqlite's SQLiteBindValue union — used for dynamically-built
 * WHERE/SET parameter arrays where TypeScript can't infer a literal tuple. */
type SqlBindValue = string | number | null;

/** Format a stored due-date ISO instant as its LOCAL calendar day (YYYY-MM-DD).
 * The due date is stored as local-midnight-as-UTC (DateTimeField.web builds it
 * with `new Date(y, m-1, d)`), so slicing the raw UTC ISO string was one day
 * early in any timezone ahead of UTC — e.g. in IST a due date of 30-Nov was
 * logged as "2026-11-29". Formatting the instant back in local time matches
 * what the task detail / list screens already display for the same value. */
function localYmd(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface NewTaskInput {
  title: string;
  categoryId: string;
  priority: Priority;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  dueDate?: string | null;
  reminderAt?: string | null;
  initialRemark?: string | null;
}

const TASK_SELECT = `
  SELECT t.*,
         COALESCE(c.name, 'Task') as category_name,
         COALESCE(c.color_hex, '#8E8E93') as category_color,
         COALESCE(c.icon, 'pricetag-outline') as category_icon
  FROM tasks t
  LEFT JOIN task_categories c ON c.id = t.category_id
`;
// LEFT JOIN, not INNER: a task synced from another device can arrive slightly
// before its category row does. An inner join dropped such a task from every
// list (while the category-less COUNT tiles still counted it — the "1 P2 shown
// but no task visible" bug), making synced tasks look lost. With the left join
// the task always shows; category_name/color fall back until the category syncs.

export async function createTask(input: NewTaskInput): Promise<TaskWithCategory> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  const userId = getCurrentUserId();
  const deviceId = getDeviceId();

  await db.runAsync(
    `INSERT INTO tasks (
      id, title, category_id, priority, status, assigned_to_name, assigned_to_email, assigned_to_contact_id,
      created_by, pending_since, due_date, reminder_at, is_starred, completed_at,
      version, sync_status, device_id, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, NULL, ?, ?, ?, ?, 0, NULL, 1, 'pending_upload', ?, ?, ?, NULL)`,
    [
      id,
      input.title.trim(),
      input.categoryId,
      input.priority,
      input.assignedToName?.trim() || null,
      input.assignedToEmail?.trim() || null,
      userId,
      now,
      input.dueDate ?? null,
      input.reminderAt ?? null,
      deviceId,
      now,
      now,
    ]
  );

  await logActivity(id, 'created', `Task created${input.assignedToName ? ` and assigned to ${input.assignedToName}` : ''}`);
  if (input.assignedToName) {
    await logActivity(id, 'assigned', `Assigned to ${input.assignedToName}`);
  }
  if (input.initialRemark && input.initialRemark.trim()) {
    await db.runAsync(
      `INSERT INTO task_remarks (id, task_id, body, author_id, original_language, created_at) VALUES (?, ?, ?, ?, 'en', ?)`,
      [newId(), id, input.initialRemark.trim(), userId, now]
    );
    notifyTablesChanged('task_remarks');
  }

  await enqueueSync('task', id, 'CREATE', input);
  notifyTablesChanged(['tasks', 'task_activity']);

  const created = await getTaskById(id);
  return created!;
}

export interface TaskPatch {
  title?: string;
  categoryId?: string;
  priority?: Priority;
  status?: TaskStatus;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  dueDate?: string | null;
  reminderAt?: string | null;
  isStarred?: boolean;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<void> {
  const db = await getDb();
  const before = await getTaskById(id);
  if (!before) return;
  const now = nowIso();

  const sets: string[] = [];
  const params: SqlBindValue[] = [];
  const activityLines: string[] = [];

  if (patch.title !== undefined && patch.title !== before.title) {
    sets.push('title = ?');
    params.push(patch.title);
    activityLines.push(`Title changed to "${patch.title}"`);
  }
  if (patch.categoryId !== undefined && patch.categoryId !== before.category_id) {
    sets.push('category_id = ?');
    params.push(patch.categoryId);
    activityLines.push('Category changed');
  }
  if (patch.priority !== undefined && patch.priority !== before.priority) {
    sets.push('priority = ?');
    params.push(patch.priority);
    activityLines.push(`Priority changed ${before.priority} → ${patch.priority}`);
  }
  if (patch.status !== undefined && patch.status !== before.status) {
    sets.push('status = ?');
    params.push(patch.status);
    if (before.status === 'completed' && patch.status !== 'completed') {
      // Un-completing a task (via the "Reopen" toggle on the Complete button,
      // or any other status change away from completed) is its own required
      // activity event, distinct from the generic status-change line below.
      activityLines.push('Task reopened');
    } else {
      activityLines.push(`Status changed to ${patch.status.replace('_', ' ')}`);
    }
    if (patch.status === 'completed') {
      sets.push('completed_at = ?');
      params.push(now);
    }
  }
  if (patch.assignedToName !== undefined && patch.assignedToName !== before.assigned_to_name) {
    sets.push('assigned_to_name = ?');
    params.push(patch.assignedToName);
    activityLines.push(patch.assignedToName ? `Assigned to ${patch.assignedToName}` : 'Assignee removed');
  }
  if (patch.assignedToEmail !== undefined && patch.assignedToEmail !== before.assigned_to_email) {
    sets.push('assigned_to_email = ?');
    params.push(patch.assignedToEmail);
  }
  if (patch.dueDate !== undefined && patch.dueDate !== before.due_date) {
    sets.push('due_date = ?');
    params.push(patch.dueDate);
    activityLines.push(patch.dueDate ? `Due date set to ${localYmd(patch.dueDate)}` : 'Due date removed');
  }
  if (patch.reminderAt !== undefined && patch.reminderAt !== before.reminder_at) {
    sets.push('reminder_at = ?');
    params.push(patch.reminderAt);
    activityLines.push('Reminder updated');
  }
  if (patch.isStarred !== undefined) {
    sets.push('is_starred = ?');
    params.push(patch.isStarred ? 1 : 0);
  }

  if (sets.length === 0) return;

  sets.push('version = version + 1', "sync_status = 'pending_update'", 'updated_at = ?');
  params.push(now);
  params.push(id);

  await db.runAsync(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);

  for (const line of activityLines) {
    const eventType = line.startsWith('Priority')
      ? 'priority_changed'
      : line.startsWith('Task reopened')
      ? 'reopened'
      : line.startsWith('Status')
      ? 'status_changed'
      : line.startsWith('Due date')
      ? 'due_date_changed'
      : line.startsWith('Reminder')
      ? 'reminder_set'
      : line.startsWith('Assigned to') || line === 'Assignee removed'
      ? 'assigned'
      : 'status_changed';
    await logActivity(id, eventType as any, line);
  }
  if (patch.status === 'completed') {
    await logActivity(id, 'completed', 'Task marked complete');
  }

  await enqueueSync('task', id, 'UPDATE', patch);
  notifyTablesChanged(['tasks', 'task_activity']);
}

export interface ReassignInput {
  toName: string;
  reason?: string | null;
  remark?: string | null;
}

export async function reassignTask(id: string, input: ReassignInput): Promise<void> {
  const db = await getDb();
  const task = await getTaskById(id);
  if (!task) return;
  const now = nowIso();
  const fromName = task.assigned_to_name;

  await db.runAsync(
    `INSERT INTO task_reassignments (id, task_id, from_name, to_name, reason, remark, changed_by, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), id, fromName, input.toName, input.reason ?? null, input.remark ?? null, getCurrentUserId(), now]
  );

  await db.runAsync(
    `UPDATE tasks SET assigned_to_name = ?, status = 'pending', pending_since = ?, version = version + 1,
     sync_status = 'pending_update', updated_at = ? WHERE id = ?`,
    [input.toName, now, now, id]
  );

  await logActivity(
    id,
    'reassigned',
    fromName ? `Reassigned ${fromName} → ${input.toName}${input.reason ? ` (${input.reason})` : ''}` : `Assigned to ${input.toName}`
  );
  if (input.remark && input.remark.trim()) {
    await db.runAsync(
      `INSERT INTO task_remarks (id, task_id, body, author_id, original_language, created_at) VALUES (?, ?, ?, ?, 'en', ?)`,
      [newId(), id, input.remark.trim(), getCurrentUserId(), now]
    );
    notifyTablesChanged('task_remarks');
  }

  await enqueueSync('task', id, 'UPDATE', { assigned_to_name: input.toName });
  notifyTablesChanged(['tasks', 'task_reassignments', 'task_activity']);
}

export async function addRemark(taskId: string, body: string): Promise<void> {
  if (!body.trim()) return;
  const db = await getDb();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO task_remarks (id, task_id, body, author_id, original_language, created_at) VALUES (?, ?, ?, ?, 'en', ?)`,
    [newId(), taskId, body.trim(), getCurrentUserId(), now]
  );
  await logActivity(taskId, 'remark_added', 'Remark added');
  await enqueueSync('task_remark', taskId, 'CREATE', { body });
  await touchParentTask(db, taskId);
  notifyTablesChanged(['task_remarks', 'task_activity']);
}

export async function softDeleteTask(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.runAsync(
    `UPDATE tasks SET deleted_at = ?, version = version + 1, sync_status = 'pending_delete', updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
  await logActivity(id, 'deleted', 'Task deleted');
  await enqueueSync('task', id, 'DELETE');
  notifyTablesChanged(['tasks', 'task_activity']);
}

export async function getTaskById(id: string): Promise<TaskWithCategory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TaskWithCategory>(`${TASK_SELECT} WHERE t.id = ?`, [id]);
  return row ?? null;
}

export interface TaskFilters {
  category?: string | null; // category name, null/'All' = no filter
  priority?: Priority | null;
  status?: TaskStatus | 'all' | null;
  assignedTo?: string | null;
  dateFilter?: 'today' | 'tomorrow' | 'this_week' | 'overdue' | null;
  search?: string | null;
  includeCompleted?: boolean;
}

export async function listTasks(filters: TaskFilters = {}): Promise<TaskWithCategory[]> {
  const db = await getDb();
  const where: string[] = ['t.deleted_at IS NULL'];
  const params: SqlBindValue[] = [];

  if (!filters.includeCompleted && (!filters.status || filters.status === 'all')) {
    where.push("t.status NOT IN ('completed', 'cancelled')");
  }
  if (filters.category && filters.category !== 'All') {
    where.push('c.name = ?');
    params.push(filters.category);
  }
  if (filters.priority) {
    where.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.status && filters.status !== 'all') {
    where.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.assignedTo) {
    where.push('t.assigned_to_name = ?');
    params.push(filters.assignedTo);
  }
  if (filters.dateFilter) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    if (filters.dateFilter === 'today') {
      const start = new Date(y, m, d).toISOString();
      const end = new Date(y, m, d + 1).toISOString();
      where.push('t.due_date >= ? AND t.due_date < ?');
      params.push(start, end);
    } else if (filters.dateFilter === 'tomorrow') {
      const start = new Date(y, m, d + 1).toISOString();
      const end = new Date(y, m, d + 2).toISOString();
      where.push('t.due_date >= ? AND t.due_date < ?');
      params.push(start, end);
    } else if (filters.dateFilter === 'this_week') {
      const start = new Date(y, m, d).toISOString();
      const end = new Date(y, m, d + 7).toISOString();
      where.push('t.due_date >= ? AND t.due_date < ?');
      params.push(start, end);
    } else if (filters.dateFilter === 'overdue') {
      where.push("t.due_date < ? AND t.status NOT IN ('completed', 'cancelled')");
      params.push(new Date(y, m, d).toISOString());
    }
  }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    where.push(`(
      t.title LIKE ? OR t.assigned_to_name LIKE ? OR c.name LIKE ? OR t.priority LIKE ? OR t.status LIKE ?
      OR t.id IN (SELECT task_id FROM task_remarks WHERE body LIKE ?)
      OR t.id IN (SELECT task_id FROM task_emails WHERE email_address LIKE ? OR subject LIKE ?)
      OR t.id IN (SELECT task_id FROM travel_plans WHERE city LIKE ?)
      OR t.id IN (
        SELECT tc.task_id FROM task_contacts tc JOIN contacts co ON co.id = tc.contact_id
        WHERE co.name LIKE ? OR co.company LIKE ? OR co.mobile LIKE ? OR co.email LIKE ?
      )
    )`);
    params.push(q, q, q, q, q, q, q, q, q, q, q, q, q);
  }

  const sql = `${TASK_SELECT} WHERE ${where.join(' AND ')} ORDER BY
    CASE t.priority WHEN 'P1' THEN 0 WHEN 'P2' THEN 1 ELSE 2 END ASC,
    t.due_date IS NULL, t.due_date ASC,
    t.pending_since ASC`;

  return db.getAllAsync<TaskWithCategory>(sql, params);
}

export interface SmartCounts {
  p1: number;
  p2: number;
  p3: number;
  overdue: number;
  today: number;
  travel: number;
  meetings: number;
}

export async function getSmartCounts(): Promise<SmartCounts> {
  const db = await getDb();
  const active = "t.deleted_at IS NULL AND t.status NOT IN ('completed','cancelled')";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const [p1, p2, p3, overdue, dueToday, travel, meetings] = await Promise.all([
    db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM tasks t WHERE ${active} AND t.priority = 'P1'`),
    db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM tasks t WHERE ${active} AND t.priority = 'P2'`),
    db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM tasks t WHERE ${active} AND t.priority = 'P3'`),
    db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM tasks t WHERE ${active} AND t.due_date < ?`, [startToday]),
    db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM tasks t WHERE ${active} AND t.due_date >= ? AND t.due_date < ?`, [startToday, endToday]),
    db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) c FROM tasks t JOIN task_categories c ON c.id = t.category_id WHERE ${active} AND c.name = 'Travel'`
    ),
    db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM meetings WHERE start_time >= ? AND start_time < ?`, [startToday, endToday]),
  ]);

  return {
    p1: p1?.c ?? 0,
    p2: p2?.c ?? 0,
    p3: p3?.c ?? 0,
    overdue: overdue?.c ?? 0,
    today: dueToday?.c ?? 0,
    travel: travel?.c ?? 0,
    meetings: meetings?.c ?? 0,
  };
}

export function isOverdue(task: Pick<Task, 'due_date' | 'status'>): boolean {
  if (!task.due_date) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.due_date).getTime() < Date.now();
}

export function daysOverdue(dueDate: string): number {
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function daysPending(pendingSince: string): number {
  const diff = Date.now() - new Date(pendingSince).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
