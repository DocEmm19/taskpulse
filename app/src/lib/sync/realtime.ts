import { DIRECT_CLOUD_TABLES, TASK_CHILD_CLOUD_TABLES } from './syncTables';
import type { getSupabase as GetSupabaseFn } from './supabaseClient';

// ----------------------------------------------------------------------------
// realtime.ts — Realtime acceleration (Task 11). Supabase Realtime is an
// ACCELERATOR on top of the existing poll: it subscribes to Postgres change
// events on the workspace's cloud tables so a change made by one user
// surfaces on the other within seconds, instead of waiting for the 30s poll
// (syncEngine.ts's `runSyncCycle`). The poll remains the correctness backstop
// — this module never reads or writes rows itself; on any event it just
// triggers `onChange` (wired to `runSyncCycle` by syncEngine.ts), which does
// the actual pull.
//
// Subscribes to every cloud table both sync directions already know about
// (DIRECT_CLOUD_TABLES + TASK_CHILD_CLOUD_TABLES from ./syncTables — the same
// single source of truth shared by syncEngine.ts's push side and pull.ts's
// pull side) on ONE channel, so a change to any workspace table triggers the
// same accelerated resync. Cheap at the 2-user scale this app targets.
//
// `./supabaseClient` is deliberately NOT imported at module scope — same
// rationale as pull.ts: it eagerly pulls in `react-native-url-polyfill/auto`
// and `@react-native-async-storage/async-storage`, neither of which resolve
// under plain Jest (no native modules). It's `require()`d lazily inside
// `getDefaultGetSupabase()`, which only runs when `startRealtime()` is called
// with no injected deps (i.e. real app usage) — never from
// `realtime.test.ts`, which always injects a fake client.
// ----------------------------------------------------------------------------

const WATCHED_TABLES: readonly string[] = [...DIRECT_CLOUD_TABLES, ...TASK_CHILD_CLOUD_TABLES];

/** Minimal shape this module needs from a Supabase Realtime channel —
 * structurally matches `@supabase/supabase-js`'s `RealtimeChannel` (`.on(...)`
 * returns the channel itself for chaining; `.subscribe()` starts it), so
 * production passes the real channel untouched while tests inject a
 * plain-object fake with no network and no mocking library. */
export interface RealtimeChannelLike {
  on(
    event: 'postgres_changes',
    filter: { event: '*'; schema: 'public'; table: string },
    callback: (payload: unknown) => void
  ): RealtimeChannelLike;
  subscribe(): unknown;
}

/** Minimal shape this module needs from a Supabase client. */
export interface RealtimeSupabaseClient {
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): void;
}

export interface RealtimeDeps {
  getSupabase: () => RealtimeSupabaseClient | null;
}

/** Lazily builds the real-app dependency set. Only invoked when
 * `startRealtime()` is called with no injected deps — see the module-level
 * comment for why `./supabaseClient` must not be imported eagerly. */
function getDefaultDeps(): RealtimeDeps {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const supabaseClient = require('./supabaseClient') as { getSupabase: typeof GetSupabaseFn };
  return {
    // Structurally compatible: supabase-js's real client's `.channel().on().subscribe()`
    // chain is a (superset) match for `RealtimeSupabaseClient`.
    getSupabase: supabaseClient.getSupabase as unknown as () => RealtimeSupabaseClient | null,
  };
}

/**
 * Subscribes to Postgres change events on the workspace's cloud tables and
 * calls `onChange` whenever any row on any of them changes. Returns an
 * unsubscribe function that removes the channel.
 *
 * No-op (does nothing, returns a no-op unsubscribe) when Supabase isn't
 * configured — matches the rest of the sync engine's fully-offline posture.
 */
export function startRealtime(onChange: () => void, deps?: RealtimeDeps): () => void {
  const d = deps ?? getDefaultDeps();
  const supabase = d.getSupabase();
  if (!supabase) return () => {};

  let channel = supabase.channel('taskpulse-workspace-changes');
  for (const table of WATCHED_TABLES) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange());
  }
  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
