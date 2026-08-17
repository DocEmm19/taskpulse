// A tiny in-memory pub/sub. Every write to the local database announces which
// table(s) changed; `useLiveQuery` (see useLiveQuery.ts) subscribes per-table and
// re-runs its query when a relevant table changes. This is what gives the app
// Drift-style "reactive" screens (no pull-to-refresh, no manual re-fetch) while
// staying a plain SQLite database underneath.

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeTable(table: string, listener: Listener): () => void {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table)!.add(listener);
  return () => {
    listeners.get(table)?.delete(listener);
  };
}

/** Call after any INSERT/UPDATE/DELETE. Accepts one or more table names since a
 * single write (e.g. creating a task) often touches several tables at once
 * (tasks + task_activity + sync_queue). */
export function notifyTablesChanged(tables: string | string[]) {
  const list = Array.isArray(tables) ? tables : [tables];
  for (const table of list) {
    listeners.get(table)?.forEach((l) => l());
  }
}
