import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let openingPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens (once) the on-device SQLite database and makes sure every table from
 * ARCHITECTURE.md §5 exists. This file is the local source of truth — every
 * screen reads from here, never directly from the network (see §3 of the doc).
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (openingPromise) return openingPromise;

  openingPromise = (async () => {
    const db = await SQLite.openDatabaseAsync('taskmanager.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    dbInstance = db;
    return db;
  })();

  return openingPromise;
}

/** Columns introduced after a table's original CREATE TABLE IF NOT EXISTS.
 * runMigrations() ensures each of these exists on every app start, so devices
 * that already created the table before the column existed still get it. */
export const EXTRA_COLUMNS: { table: string; column: string; type: string }[] = [
  { table: 'task_activity', column: 'actor_name', type: 'TEXT' },
  // Task 6: DIRECT_TABLES (syncEngine.ts) need `updated_at` for last-write-wins
  // cloud sync. tasks/contacts already had it in their CREATE TABLE; these
  // three didn't, so they get it via the additive migration path instead.
  { table: 'task_categories', column: 'updated_at', type: 'TEXT' },
  { table: 'attachments', column: 'updated_at', type: 'TEXT' },
  { table: 'calendar_events', column: 'updated_at', type: 'TEXT' },
  // Remove-category: categories now soft-delete (deleted_at) like tasks, so the
  // removal syncs cross-device via the existing DELETE path. Cloud needs the
  // matching `alter table public.task_categories add column deleted_at timestamptz`.
  { table: 'task_categories', column: 'deleted_at', type: 'TEXT' },
  // Assignee email (for the later Gmail-send phase). Cloud needs the matching
  // `alter table public.tasks add column assigned_to_email text`.
  { table: 'tasks', column: 'assigned_to_email', type: 'TEXT' },
];

/** Additive, idempotent "add column if missing" migration — used for columns
 * introduced after a table's original CREATE TABLE IF NOT EXISTS, since that
 * statement is a no-op once the table already exists on a device. Never
 * touches existing columns/data. */
async function ensureColumn(db: SQLite.SQLiteDatabase, table: string, column: string, type: string): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
  }
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'assistant',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      push_token TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color_hex TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category_id TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'P2',
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_to_name TEXT,
      assigned_to_contact_id TEXT,
      created_by TEXT,
      pending_since TEXT NOT NULL,
      due_date TEXT,
      reminder_at TEXT,
      is_starred INTEGER DEFAULT 0,
      completed_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending_upload',
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

    CREATE TABLE IF NOT EXISTS task_reassignments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      from_name TEXT,
      to_name TEXT NOT NULL,
      reason TEXT,
      remark TEXT,
      changed_by TEXT,
      changed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reassign_task ON task_reassignments(task_id);

    CREATE TABLE IF NOT EXISTS task_remarks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      body TEXT NOT NULL,
      author_id TEXT,
      original_language TEXT DEFAULT 'en',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_remarks_task ON task_remarks(task_id);

    CREATE TABLE IF NOT EXISTS task_activity (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      actor_device_id TEXT,
      actor_name TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_task ON task_activity(task_id);

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT,
      alternate_mobile TEXT,
      email TEXT,
      company TEXT,
      designation TEXT,
      remarks TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_contacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_contacts_task ON task_contacts(task_id);

    CREATE TABLE IF NOT EXISTS task_emails (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      email_address TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_emails_task ON task_emails(task_id);

    CREATE TABLE IF NOT EXISTS task_links (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      label TEXT,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_links(task_id);

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      label TEXT,
      address TEXT,
      maps_url TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_locations_task ON locations(task_id);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT,
      meeting_link TEXT,
      participants TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_meetings_task ON meetings(task_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_start ON meetings(start_time);

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      meeting_link TEXT,
      participants TEXT,
      remarks TEXT,
      provider TEXT,
      external_event_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cal_events_task ON calendar_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_cal_events_start ON calendar_events(start_time);

    CREATE TABLE IF NOT EXISTS travel_plans (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      city TEXT NOT NULL,
      travel_date TEXT NOT NULL,
      return_date TEXT,
      purpose TEXT,
      hotel_name TEXT,
      hotel_address TEXT,
      travel_booking_link TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_travel_task ON travel_plans(task_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size_bytes INTEGER,
      mime_type TEXT,
      duration_seconds INTEGER,
      local_path TEXT,
      storage_path TEXT,
      uploaded_by TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending_upload',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      remind_at TEXT NOT NULL,
      message TEXT,
      is_sent INTEGER DEFAULT 0,
      notification_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      status TEXT DEFAULT 'queued',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  for (const { table, column, type } of EXTRA_COLUMNS) {
    await ensureColumn(db, table, column, type);
  }
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}
