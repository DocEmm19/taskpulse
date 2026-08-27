import { getDb, getMeta } from '../../db/database';

export interface SyncHealth {
  stuck: number; // queue items past normal backoff
  lastError: string | null;
  lastOkAt: string | null; // ISO of last fully-successful cycle
}

/**
 * Reads sync health from the existing sync_queue + a meta timestamp — no new
 * state machine. Surfaces the case that silently bit us before: pushes failing
 * and backing off with no user-visible signal.
 *
 * ponytail: "stuck" = failed rows with retry_count >= 3 (past the first few
 * normal backoff retries). Coarse but enough; tighten only if it false-alarms.
 */
export async function getSyncHealth(): Promise<SyncHealth> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number; err: string | null }>(
    `SELECT COUNT(*) AS n, MAX(last_error) AS err FROM sync_queue WHERE status = 'failed' AND retry_count >= 3`
  );
  return { stuck: row?.n ?? 0, lastError: row?.err ?? null, lastOkAt: await getMeta('sync.lastOkAt') };
}

/** Pure label for the header pill — split out so it's the one runnable check. */
export function syncHealthLabel(
  h: Pick<SyncHealth, 'stuck' | 'lastOkAt'>,
  nowMs: number
): { text: string; tone: 'ok' | 'warn' } {
  if (h.stuck > 0) return { text: 'Sync issue', tone: 'warn' };
  if (!h.lastOkAt) return { text: 'Syncing…', tone: 'ok' };
  const mins = Math.floor((nowMs - Date.parse(h.lastOkAt)) / 60000);
  const rel = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  return { text: `Synced ${rel}`, tone: 'ok' };
}
