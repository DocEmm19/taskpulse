-- ============================================================================
-- TaskPulse (Gaurav's Task Manager) — ONE-SHOT Supabase (PostgreSQL) setup
-- ============================================================================
-- WHO THIS IS FOR: Gaurav. You do not need to be a database person to run
-- this. Just follow the steps below in order.
--
-- HOW TO RUN:
--   1. Open your Supabase project → SQL Editor → New query.
--   2. Paste this ENTIRE file.
--   3. Before clicking "Run", scroll to the very bottom section titled
--      "STEP 2: LINK THE TWO USERS INTO ONE WORKSPACE (EDIT THESE)" and follow
--      the instructions there FIRST (you'll need to create the two user
--      accounts in the dashboard and paste their two user-ids into this file).
--   4. Click "Run". The whole file executes top-to-bottom in one go.
--
-- WHAT THIS FILE IS: the same cloud schema that shipped in
-- reference-docs/supabase/schema.sql (tables, RLS policies, storage bucket),
-- PLUS two production fixes made for this handoff:
--   FIX 1 — three tables (task_categories, attachments, calendar_events) were
--           missing an `updated_at` column. The app's sync engine sends
--           `updated_at` for every row of these tables when it pushes to the
--           cloud, so without this column the push would fail with a
--           "column updated_at does not exist" error. Added below.
--   FIX 2 — a security hardening: four RLS policies (task_categories,
--           contacts, meetings, calendar_events) had an "... IS NULL OR ..."
--           clause that let ANY authenticated user read/write rows that
--           happened to have no owner/parent set — a cross-workspace
--           authorization bypass. Removed for task_categories, contacts and
--           meetings below (no legitimate null-owner rows exist for those);
--           replaced with a tighter (not fully open) check for
--           calendar_events, which has a genuine null-task_id use case — see
--           the comment above each policy for the specifics.
--
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE
-- / ADD COLUMN IF NOT EXISTS, so running this file twice against the same
-- project will not error and will not duplicate anything.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. USERS — mirrors auth.users; id MUST equal the Supabase Auth user id.
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  avatar_url text,
  role text not null default 'assistant', -- 'owner' | 'assistant' | 'viewer'
  created_at timestamptz not null default now()
);

-- Auto-create a public.users row whenever someone signs up via Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, created_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 2. WORKSPACE MEMBERS — this is how Gaurav and Abhay end up sharing a
--    workspace. See STEP 2 at the very bottom of this file for the actual
--    rows that link the two of them together.
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (owner_id, member_id)
);

-- ----------------------------------------------------------------------------
-- 3. DEVICES
-- ----------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  device_name text not null,
  platform text not null,
  push_token text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. TASK CATEGORIES
-- FIX 1: added `updated_at` (see header). The app's sync push sends
-- `updated_at` for task_categories rows, so the cloud column must exist.
-- ----------------------------------------------------------------------------
create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_hex text not null,
  icon text not null,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Belt-and-braces: if this table already existed (e.g. from a prior partial
-- run of an older version of this script) without updated_at, add it now.
-- Harmless no-op if the column is already there.
alter table public.task_categories add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 5. TASKS — the hub table (ARCHITECTURE.md §5.1)
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid not null references public.task_categories(id),
  priority text not null default 'P2' check (priority in ('P1','P2','P3')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','on_hold','cancelled','reassigned')),
  assigned_to_name text,
  assigned_to_contact_id uuid,
  created_by uuid not null references public.users(id),
  pending_since timestamptz not null default now(),
  due_date timestamptz,
  reminder_at timestamptz,
  is_starred boolean not null default false,
  completed_at timestamptz,
  version integer not null default 1,
  sync_status text not null default 'synced',
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_category on public.tasks(category_id);
create index if not exists idx_tasks_due on public.tasks(due_date);
create index if not exists idx_tasks_created_by on public.tasks(created_by);

-- ----------------------------------------------------------------------------
-- 6. TASK REASSIGNMENTS (append-only history — Req. #7)
-- ----------------------------------------------------------------------------
create table if not exists public.task_reassignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_name text,
  to_name text not null,
  reason text,
  remark text,
  changed_by uuid references public.users(id),
  changed_at timestamptz not null default now()
);
create index if not exists idx_reassign_task on public.task_reassignments(task_id);

-- ----------------------------------------------------------------------------
-- 7. TASK REMARKS (append-only timeline — Req. #8)
-- ----------------------------------------------------------------------------
create table if not exists public.task_remarks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  author_id uuid references public.users(id),
  original_language text not null default 'en',
  created_at timestamptz not null default now()
);
create index if not exists idx_remarks_task on public.task_remarks(task_id);

-- ----------------------------------------------------------------------------
-- 8. TASK ACTIVITY (auto-generated system log — Req. #40)
-- ----------------------------------------------------------------------------
create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null,
  description text not null,
  actor_device_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_task on public.task_activity(task_id);

-- ----------------------------------------------------------------------------
-- 9. CONTACTS
-- ----------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text,
  alternate_mobile text,
  email text,
  company text,
  designation text,
  remarks text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 10. TASK <-> CONTACT junction
create table if not exists public.task_contacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, contact_id)
);
create index if not exists idx_task_contacts_task on public.task_contacts(task_id);

-- 11. TASK EMAILS
create table if not exists public.task_emails (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  email_address text not null,
  subject text,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_emails_task on public.task_emails(task_id);

-- 12. TASK LINKS (web + meeting links)
create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  link_type text not null check (link_type in ('website','meeting_google_meet','meeting_teams','meeting_zoom','meeting_other')),
  label text,
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_links_task on public.task_links(task_id);

-- 13. LOCATIONS (Google Maps)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  label text,
  address text,
  maps_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index if not exists idx_locations_task on public.locations(task_id);

-- 14. MEETINGS (lightweight, tied to a task)
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  location text,
  meeting_link text,
  participants text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_meetings_task on public.meetings(task_id);
create index if not exists idx_meetings_start on public.meetings(start_time);

-- 15. CALENDAR EVENTS
-- FIX 1: added `updated_at` (see header). The app's sync push sends
-- `updated_at` for calendar_events rows, so the cloud column must exist.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  meeting_link text,
  participants text,
  remarks text,
  provider text default 'device' check (provider in ('device','google','apple')),
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Belt-and-braces, same reasoning as task_categories above.
alter table public.calendar_events add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_cal_events_task on public.calendar_events(task_id);
create index if not exists idx_cal_events_start on public.calendar_events(start_time);

-- 16. TRAVEL PLANS
create table if not exists public.travel_plans (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  city text not null,
  travel_date timestamptz not null,
  return_date timestamptz,
  purpose text,
  hotel_name text,
  hotel_address text,
  travel_booking_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_travel_task on public.travel_plans(task_id);

-- 17. ATTACHMENTS — metadata only; bytes live in Storage (see §5.4 below)
-- FIX 1: added `updated_at` (see header). The app's sync push sends
-- `updated_at` for attachments rows, so the cloud column must exist.
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_type text not null check (file_type in ('image','pdf','audio','video')),
  file_name text not null,
  file_size_bytes bigint,
  mime_type text,
  duration_seconds integer,
  local_path text, -- meaningful on-device only; harmless to keep in the cloud row
  storage_path text, -- path inside the attachments-private bucket, set once uploaded
  uploaded_by uuid references public.users(id),
  sync_status text not null default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Belt-and-braces, same reasoning as task_categories above.
alter table public.attachments add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_attachments_task on public.attachments(task_id);

-- 18. REMINDERS
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  remind_at timestamptz not null,
  message text,
  is_sent boolean not null default false,
  notification_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reminders_task on public.reminders(task_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- v1 policy: a user can read/write their own rows, or rows belonging to a
-- workspace owner who has added them as a member (ARCHITECTURE.md §5.3).
-- ============================================================================

create or replace function public.in_same_workspace(row_owner uuid)
returns boolean as $$
  select auth.uid() = row_owner
     or exists (
       select 1 from public.workspace_members wm
       where wm.owner_id = row_owner and wm.member_id = auth.uid()
     )
     or exists (
       select 1 from public.workspace_members wm
       where wm.owner_id = auth.uid() and wm.member_id = row_owner
     );
$$ language sql stable security definer;

alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.task_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_reassignments enable row level security;
alter table public.task_remarks enable row level security;
alter table public.task_activity enable row level security;
alter table public.contacts enable row level security;
alter table public.task_contacts enable row level security;
alter table public.task_emails enable row level security;
alter table public.task_links enable row level security;
alter table public.locations enable row level security;
alter table public.meetings enable row level security;
alter table public.calendar_events enable row level security;
alter table public.travel_plans enable row level security;
alter table public.attachments enable row level security;
alter table public.reminders enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "self" on public.users;
create policy "self" on public.users for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own devices" on public.devices;
create policy "own devices" on public.devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- FIX 2 (SECURITY HARDENING): the original policy here was
--   using (created_by is null or public.in_same_workspace(created_by))
-- The "created_by is null or ..." branch meant that ANY authenticated user
-- (from ANY workspace) could read/write a task_categories row that happened
-- to have no owner set — an authorization bypass across workspaces.
-- This is safe to remove because the app ALWAYS sets created_by to a real
-- user id when it creates a category (including the built-in default
-- categories, which are created with the signed-in user as owner), and any
-- category created offline before sign-in gets reattributed to the real
-- auth uid on first sign-in via the app's claimOwnership step. So there is
-- no legitimate owner-less category row that needs cross-workspace visibility.
drop policy if exists "workspace categories" on public.task_categories;
create policy "workspace categories" on public.task_categories for all
  using (public.in_same_workspace(created_by))
  with check (public.in_same_workspace(created_by));

drop policy if exists "workspace tasks" on public.tasks;
create policy "workspace tasks" on public.tasks for all
  using (public.in_same_workspace(created_by))
  with check (public.in_same_workspace(created_by));

-- Child tables inherit access through their parent task's workspace.
drop policy if exists "workspace task_reassignments" on public.task_reassignments;
create policy "workspace task_reassignments" on public.task_reassignments for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace task_remarks" on public.task_remarks;
create policy "workspace task_remarks" on public.task_remarks for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace task_activity" on public.task_activity;
create policy "workspace task_activity" on public.task_activity for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

-- FIX 2 (SECURITY HARDENING): same "created_by is null or ..." bypass as
-- task_categories above, removed for the same reason — the app always sets
-- created_by on contacts, and offline-created contacts get reattributed to
-- the real auth uid on first sign-in via claimOwnership.
drop policy if exists "workspace contacts" on public.contacts;
create policy "workspace contacts" on public.contacts for all
  using (public.in_same_workspace(created_by))
  with check (public.in_same_workspace(created_by));

drop policy if exists "workspace task_contacts" on public.task_contacts;
create policy "workspace task_contacts" on public.task_contacts for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace task_emails" on public.task_emails;
create policy "workspace task_emails" on public.task_emails for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace task_links" on public.task_links;
create policy "workspace task_links" on public.task_links for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace locations" on public.locations;
create policy "workspace locations" on public.locations for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

-- FIX 2 (SECURITY HARDENING): the original policy here was
--   using (task_id is null or exists (... public.in_same_workspace(t.created_by)))
-- The "task_id is null or ..." branch meant that ANY authenticated user could
-- read/write a meetings row that happened to have no parent task set — an
-- authorization bypass across workspaces. meetings has no owner column of
-- its own, so workspace membership can only ever be established via its
-- parent task; a null task_id row cannot be safely attributed to any
-- workspace and must not be readable by anyone.
-- This is safe to remove: the app's only meeting-create path
-- (setTaskMeeting(taskId: string, ...) in app/src/db/repositories/taskExtras.ts)
-- takes task_id as a required, non-optional parameter, and meetings is synced
-- as a TASK_CHILD_CLOUD_TABLE (keyed off task_id, per-task full resync — see
-- syncEngine.ts) — there is no code path, local or cloud, that produces a
-- meetings row without a task_id. If a future version of the app introduces
-- standalone (task-less) meetings, this table will need a real
-- created_by/owner column added first — do not re-add "task_id is null or
-- ..." as a shortcut, since that reopens the cross-workspace bypass.
drop policy if exists "workspace meetings" on public.meetings;
create policy "workspace meetings" on public.meetings for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

-- FIX 2 (SECURITY HARDENING) — calendar_events is DIFFERENT from the other
-- three: it has a GENUINE null-task_id case, so we do NOT fully remove the
-- null-allowance here (that would silently break a real feature). Details:
--   - addCalendarEvent(data: { taskId?: string | null; ... }) in
--     app/src/db/repositories/taskExtras.ts genuinely allows a null task_id
--     (device-calendar-sync events that aren't tied to any TaskPulse task).
--   - calendar_events is a DIRECT_CLOUD_TABLE (synced by its own id, not
--     scoped per-task like meetings), and its TABLE_COLUMNS whitelist in
--     app/src/lib/sync/syncEngine.ts's syncTables.ts includes task_id as a
--     nullable column — so null-task_id rows really do get pushed to the
--     cloud table this policy protects.
--   - calendar_events has no created_by/owner column of its own, so a
--     null-task_id row cannot be attributed to a specific workspace from the
--     row alone.
-- The original "task_id is null or ..." clause made these rows readable and
-- writable by ANY authenticated user in the project, regardless of workspace
-- — that's the bypass. Since we can't scope by workspace for these rows, the
-- tighter (but still functional) replacement below requires the requester to
-- at least be a linked member of SOME workspace (i.e. one of the two
-- provisioned accounts set up in STEP 2 at the bottom of this file), which
-- rules out a stray/unlinked Supabase Auth signup that was never added to
-- workspace_members. For this 2-user (Gaurav + Abhay) deployment this means
-- only the two of you can ever see task-less calendar events, which matches
-- intent. If per-workspace isolation of standalone events is ever required,
-- add a real created_by column to calendar_events (and have the app populate
-- it) in a future migration — do not just delete this comment and re-widen
-- the policy back to "task_id is null or true".
drop policy if exists "workspace calendar_events" on public.calendar_events;
create policy "workspace calendar_events" on public.calendar_events for all
  using (
    exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by))
    or (
      task_id is null
      and exists (select 1 from public.workspace_members wm where wm.owner_id = auth.uid() or wm.member_id = auth.uid())
    )
  )
  with check (
    exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by))
    or (
      task_id is null
      and exists (select 1 from public.workspace_members wm where wm.owner_id = auth.uid() or wm.member_id = auth.uid())
    )
  );

drop policy if exists "workspace travel_plans" on public.travel_plans;
create policy "workspace travel_plans" on public.travel_plans for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace attachments" on public.attachments;
create policy "workspace attachments" on public.attachments for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "workspace reminders" on public.reminders;
create policy "workspace reminders" on public.reminders for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.in_same_workspace(t.created_by)));

drop policy if exists "own workspace_members rows" on public.workspace_members;
create policy "own workspace_members rows" on public.workspace_members for all
  using (owner_id = auth.uid() or member_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- STORAGE — private bucket for images/PDF/audio/video (ARCHITECTURE.md §5.4)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attachments-private', 'attachments-private', false)
on conflict (id) do nothing;

drop policy if exists "workspace can read own attachment files" on storage.objects;
create policy "workspace can read own attachment files" on storage.objects for select
  using (bucket_id = 'attachments-private' and public.in_same_workspace((storage.foldername(name))[1]::uuid));

drop policy if exists "workspace can upload own attachment files" on storage.objects;
create policy "workspace can upload own attachment files" on storage.objects for insert
  with check (bucket_id = 'attachments-private' and public.in_same_workspace((storage.foldername(name))[1]::uuid));

drop policy if exists "workspace can update own attachment files" on storage.objects;
create policy "workspace can update own attachment files" on storage.objects for update
  using (bucket_id = 'attachments-private' and public.in_same_workspace((storage.foldername(name))[1]::uuid));

drop policy if exists "workspace can delete own attachment files" on storage.objects;
create policy "workspace can delete own attachment files" on storage.objects for delete
  using (bucket_id = 'attachments-private' and public.in_same_workspace((storage.foldername(name))[1]::uuid));

-- The app uploads to storage paths shaped like {user_id}/{task_id}/{attachment_id}_{filename}
-- (see app/src/lib/sync/syncEngine.ts), so (storage.foldername(name))[1] is always the owner's user id.

-- ============================================================================
-- Schema + RLS + storage are done. Everything above this line can run
-- unattended. The section below needs your input before it can run.
--
-- IMPORTANT — transaction boundary: when the SQL Editor runs a pasted script
-- with multiple statements, Postgres treats the whole batch as ONE implicit
-- transaction. Without the `commit;` immediately below, forgetting to edit
-- the two placeholder uuids in STEP 2 (which makes the block below
-- deliberately fail with `raise exception`, so you can't miss the step)
-- would roll back everything above too — every table, policy and the storage
-- bucket you just created. This `commit;` closes that off: everything above
-- this line is saved permanently before STEP 2 even starts, so a mistake or
-- a skipped edit down there can only affect STEP 2, never the schema.
-- ============================================================================
commit;

-- ============================================================================
-- ===== STEP 2: LINK THE TWO USERS INTO ONE WORKSPACE (EDIT THESE) =========
-- ============================================================================
-- Gaurav — do this part by hand, in order:
--
--   1. In the Supabase Dashboard, go to Authentication → Users → Add user,
--      and create TWO accounts (one for yourself, one for Abhay). Use
--      "Add user" with an email + password (or "Auto Confirm User" checked
--      so no confirmation email is required) — either works.
--
--   2. For EACH of the two users you just created, click into their row and
--      copy their "User UID" (a uuid that looks like
--      3fa85f64-5717-4562-b3fc-2c963f66afa6).
--
--   3. Paste GAURAV's uuid and ABHAY's uuid into the two `replace ...` lines
--      directly below, replacing the all-zero placeholder uuids. Do this
--      BEFORE running this file, or re-run just this bottom section
--      afterwards (it's safe to re-run — see ON CONFLICT DO NOTHING below).
--
--   4. Run the whole file (or just this bottom section, if you're re-running
--      only this part).
--
-- Why two rows, both directions? workspace_members is a directed link
-- (owner_id "has added" member_id). in_same_workspace() checks BOTH
-- directions, but inserting both rows here makes the relationship obviously
-- symmetric to anyone reading this table later, and matches how the app's
-- own "add workspace member" flow would create it if either of you added
-- the other from within the app.
-- ============================================================================

do $$
declare
  gaurav_id uuid := '9dc4f4bb-aa6e-4972-8c8d-1dd5ac630879'; -- replace with GAURAV's user id
  abhay_id  uuid := 'd26ab05a-aeeb-4d44-9731-50d9ac944143'; -- replace with ABHAY's user id
begin
  if gaurav_id = '00000000-0000-0000-0000-000000000000' or abhay_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'STEP 2 not configured yet: replace the gaurav_id / abhay_id placeholders above with the two real user UUIDs from Authentication -> Users before running this block.';
  end if;

  -- Gaurav's workspace includes Abhay as a member.
  insert into public.workspace_members (owner_id, member_id, role)
  values (gaurav_id, abhay_id, 'member')
  on conflict (owner_id, member_id) do nothing;

  -- Abhay's workspace includes Gaurav as a member (the reverse direction).
  insert into public.workspace_members (owner_id, member_id, role)
  values (abhay_id, gaurav_id, 'member')
  on conflict (owner_id, member_id) do nothing;
end $$;

-- ============================================================================
-- All done. Next: copy your Project URL + anon key (Project Settings → API)
-- into EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in the app's
-- environment — see SUPABASE_SETUP.md. Gaurav and Abhay should now each be
-- able to sign in and see each other's tasks/categories/contacts/etc.
-- ============================================================================
