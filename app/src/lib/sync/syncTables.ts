// syncTables.ts — single source of truth for the direct-entity CLOUD table
// names shared by both sync directions: syncEngine.ts (push) and pull.ts
// (pull). A table added to only one side would otherwise silently sync
// one-way with no error.
//
// Deliberately side-effect-free and dependency-free: no react-native,
// @react-native-async-storage/async-storage, @react-native-community/netinfo,
// or any other native-module-backed import. That's what lets pull.test.ts
// (and any future syncEngine test) import this under plain Jest with no
// native mocking required.

export const DIRECT_CLOUD_TABLES = ['tasks', 'contacts', 'task_categories', 'attachments', 'calendar_events'] as const;

export type DirectCloudTable = (typeof DIRECT_CLOUD_TABLES)[number];

// Task-child CLOUD table names (Task 9's pull side, syncEngine.ts's push side).
// These tables key off `task_id` rather than their own id being the thing the
// sync_queue tracks — see syncEngine.ts's TASK_CHILD_TABLES comment for why a
// per-task full resync (not per-row diffing) is the correct model for them.
export const TASK_CHILD_CLOUD_TABLES = [
  'task_remarks',
  'task_links',
  'task_emails',
  'locations',
  'meetings',
  'travel_plans',
  'task_contacts',
] as const;

export type TaskChildCloudTable = (typeof TASK_CHILD_CLOUD_TABLES)[number];

/** Explicit column whitelist per direct-entity cloud table, mirroring the
 * local SQLite schema in `db/database.ts` exactly (local and cloud schemas
 * are intentionally identical — see ARCHITECTURE.md §5.2). Keyed by
 * `DirectCloudTable` so a table added to/removed from DIRECT_CLOUD_TABLES
 * without a matching entry here is a compile error (missing or excess key)
 * instead of a silent one-way-sync gap.
 *
 * This is the single shared boundary for BOTH sync directions: pull.ts uses
 * it to restrict what an incoming cloud row can write into SQLite (so a
 * malformed/compromised cloud row can't inject unexpected columns into a
 * local INSERT), and syncEngine.ts's `sanitizeRow` uses the same map to
 * restrict what a local row can push to Supabase (so local-only bookkeeping
 * columns never leak into a cloud upsert). Keeping this in one place is what
 * makes push and cloud agree on the column set per table. */
export const TABLE_COLUMNS: Record<DirectCloudTable, readonly string[]> = {
  tasks: [
    'id',
    'title',
    'category_id',
    'priority',
    'status',
    'assigned_to_name',
    'assigned_to_email',
    'assigned_to_contact_id',
    'created_by',
    'pending_since',
    'due_date',
    'reminder_at',
    'is_starred',
    'completed_at',
    'version',
    'sync_status',
    'device_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  contacts: [
    'id',
    'name',
    'mobile',
    'alternate_mobile',
    'email',
    'company',
    'designation',
    'remarks',
    'created_by',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  task_categories: ['id', 'name', 'color_hex', 'icon', 'is_default', 'sort_order', 'created_by', 'created_at', 'updated_at', 'deleted_at'],
  attachments: [
    'id',
    'task_id',
    'file_type',
    'file_name',
    'file_size_bytes',
    'mime_type',
    'duration_seconds',
    // NOTE: local_path is intentionally NOT synced. On web it holds the file's
    // bytes as a base64 data: URL — shipping that through Postgres bloated the
    // (500MB free-tier) DB and would break on large videos. Files now travel
    // via Supabase Storage only: push uploads bytes + sets storage_path, and
    // each other device downloads them from Storage on pull (see syncEngine
    // pullAttachmentFile). local_path stays a per-device local pointer.
    'storage_path',
    'uploaded_by',
    'sync_status',
    'created_at',
    'updated_at',
  ],
  calendar_events: [
    'id',
    'task_id',
    'title',
    'start_time',
    'end_time',
    'location',
    'meeting_link',
    'participants',
    'remarks',
    'provider',
    'external_event_id',
    'created_at',
    'updated_at',
  ],
};

/** Explicit column whitelist per task-child cloud table — same
 * defense-in-depth rationale and shared-boundary role as TABLE_COLUMNS above,
 * for the TASK_CHILD_CLOUD_TABLES set. Keyed by `TaskChildCloudTable` so a
 * table added to/removed from TASK_CHILD_CLOUD_TABLES without a matching
 * entry here is a compile error. */
export const TASK_CHILD_COLUMNS: Record<TaskChildCloudTable, readonly string[]> = {
  task_remarks: ['id', 'task_id', 'body', 'author_id', 'original_language', 'created_at'],
  task_links: ['id', 'task_id', 'link_type', 'label', 'url', 'created_at'],
  task_emails: ['id', 'task_id', 'email_address', 'subject', 'body', 'created_at'],
  locations: ['id', 'task_id', 'label', 'address', 'maps_url', 'latitude', 'longitude', 'created_at'],
  meetings: [
    'id',
    'task_id',
    'title',
    'start_time',
    'end_time',
    'location',
    'meeting_link',
    'participants',
    'remarks',
    'created_at',
    'updated_at',
  ],
  travel_plans: [
    'id',
    'task_id',
    'city',
    'travel_date',
    'return_date',
    'purpose',
    'hotel_name',
    'hotel_address',
    'travel_booking_link',
    'created_at',
    'updated_at',
  ],
  task_contacts: ['id', 'task_id', 'contact_id', 'created_at'],
};
