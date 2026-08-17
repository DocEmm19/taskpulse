// TypeScript mirror of the data model in docs/ARCHITECTURE.md §5.
// Every syncable table shares the same 6 sync-metadata columns (version, sync_status,
// device_id, created_at, updated_at, deleted_at) so the sync engine can treat them uniformly.

export type SyncStatus = 'synced' | 'pending_upload' | 'pending_update' | 'pending_delete' | 'conflict';
export type Priority = 'P1' | 'P2' | 'P3';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled' | 'reassigned';
export type LinkType = 'website' | 'meeting_google_meet' | 'meeting_teams' | 'meeting_zoom' | 'meeting_other';
export type AttachmentType = 'image' | 'pdf' | 'audio' | 'video';

export interface SyncMeta {
  version: number;
  sync_status: SyncStatus;
  device_id: string | null;
  created_at: string; // ISO 8601
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskCategory {
  id: string;
  name: string;
  color_hex: string;
  icon: string;
  is_default: 0 | 1;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  // Task 6: added via EXTRA_COLUMNS migration; nullable because it wasn't in
  // the original CREATE TABLE, so pre-existing on-device rows have NULL until
  // next write. Always set on insert going forward.
  updated_at: string | null;
}

export interface Task extends SyncMeta {
  id: string;
  title: string;
  category_id: string;
  priority: Priority;
  status: TaskStatus;
  assigned_to_name: string | null;
  assigned_to_contact_id: string | null;
  created_by: string;
  pending_since: string;
  due_date: string | null;
  reminder_at: string | null;
  is_starred: 0 | 1;
  completed_at: string | null;
}

// Joined shape used throughout the UI (task + its category, for card rendering)
export interface TaskWithCategory extends Task {
  category_name: string;
  category_color: string;
  category_icon: string;
}

export interface TaskReassignment {
  id: string;
  task_id: string;
  from_name: string | null;
  to_name: string;
  reason: string | null;
  remark: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface TaskRemark {
  id: string;
  task_id: string;
  body: string;
  author_id: string | null;
  original_language: string;
  created_at: string;
}

export type ActivityEventType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'priority_changed'
  | 'remark_added'
  | 'attachment_added'
  | 'due_date_changed'
  | 'completed'
  | 'reminder_set'
  | 'conflict_resolved'
  | 'deleted'
  | 'shared'
  | 'reopened';

export interface TaskActivity {
  id: string;
  task_id: string;
  event_type: ActivityEventType;
  description: string;
  actor_device_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  mobile: string | null;
  alternate_mobile: string | null;
  email: string | null;
  company: string | null;
  designation: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskContact {
  id: string;
  task_id: string;
  contact_id: string;
  created_at: string;
}

export interface TaskEmail {
  id: string;
  task_id: string;
  email_address: string;
  subject: string | null;
  body: string | null;
  created_at: string;
}

export interface TaskLink {
  id: string;
  task_id: string;
  link_type: LinkType;
  label: string | null;
  url: string;
  created_at: string;
}

export interface TaskLocation {
  id: string;
  task_id: string;
  label: string | null;
  address: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  task_id: string | null;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  meeting_link: string | null;
  participants: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventRow {
  id: string;
  task_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_link: string | null;
  participants: string | null;
  remarks: string | null;
  provider: 'device' | 'google' | 'apple' | null;
  external_event_id: string | null;
  created_at: string;
  // Task 6: added via EXTRA_COLUMNS migration; see TaskCategory note.
  updated_at: string | null;
}

export interface TravelPlan {
  id: string;
  task_id: string;
  city: string;
  travel_date: string;
  return_date: string | null;
  purpose: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  travel_booking_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  file_type: AttachmentType;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  local_path: string | null;
  storage_path: string | null;
  uploaded_by: string | null;
  sync_status: SyncStatus;
  created_at: string;
  // Task 6: added via EXTRA_COLUMNS migration; see TaskCategory note.
  updated_at: string | null;
}

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string;
  message: string | null;
  is_sent: 0 | 1;
  created_at: string;
  notification_id: string | null;
}

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'UPLOAD_FILE' | 'DELETE_FILE';

export interface SyncQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload: string | null;
  retry_count: number;
  last_error: string | null;
  status: 'queued' | 'in_flight' | 'failed' | 'done';
  created_at: string;
}

// A fully "hydrated" task, i.e. everything the Task Detail screen needs in one shape.
export interface TaskFull {
  task: TaskWithCategory;
  remarks: TaskRemark[];
  activity: TaskActivity[];
  reassignments: TaskReassignment[];
  contacts: Contact[];
  emails: TaskEmail[];
  links: TaskLink[];
  location: TaskLocation | null;
  meeting: Meeting | null;
  calendarEvent: CalendarEventRow | null;
  travel: TravelPlan | null;
  attachments: Attachment[];
  reminders: Reminder[];
}

export const DEFAULT_CATEGORY_NAMES = ['Personal', 'Official', 'Travel', 'Urgent'] as const;

export const CITY_OPTIONS = [
  'Delhi',
  'Noida',
  'Gurgaon',
  'Mumbai',
  'Pune',
  'Bangalore',
  'Chennai',
  'Hyderabad',
  'Other',
];
