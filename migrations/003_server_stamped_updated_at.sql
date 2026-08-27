-- ============================================================================
-- Migration 003 — Server-authoritative `updated_at` (fixes cross-device sync)
-- ============================================================================
-- RUN THIS ONCE in the Supabase SQL editor (Project → SQL Editor → New query).
-- Safe to re-run (idempotent: it drops+recreates the trigger).
--
-- WHY
-- The app pushes each row's `updated_at` from the writing DEVICE's wall clock,
-- and the pull filter is `select ... where updated_at > <device watermark>`.
-- The watermark is the max `updated_at` a device has ever pulled — including
-- its own writes. If one device's clock runs ahead, its watermark climbs past
-- the OTHER device's genuinely-later updates, so those updates are filtered out
-- of every pull, permanently. Symptom: "I edited a task on my phone and it
-- never showed up on the other person's screen." Creates worked early only
-- because watermarks were still low.
--
-- FIX
-- Stamp `updated_at = now()` server-side on every INSERT/UPDATE, so ALL
-- timestamps across all devices come from ONE clock (the database's). The
-- client-sent value is ignored. With a single clock, the watermark can never
-- outrun a real update, and last-write-wins is consistent.
--
-- After running this, deploy the app build that ships `resetSyncWatermarksOnce`
-- (App.tsx / pull.ts) — it clears each device's stale watermark once so the
-- next sync rebuilds it from these server timestamps. Then hard-reload the app
-- on each device.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Apply to every direct-synced table that carries `updated_at` and is pulled by
-- watermark (see DIRECT_CLOUD_TABLES in app/src/lib/sync/syncTables.ts).
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'contacts', 'task_categories', 'attachments', 'calendar_events']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before insert or update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Optional sanity check (uncomment to run): after this migration, touch a task
-- on one device and confirm its updated_at jumps to ~server-now regardless of
-- that device's clock:
--   select id, title, updated_at, now() - updated_at as age from public.tasks
--   order by updated_at desc limit 5;
