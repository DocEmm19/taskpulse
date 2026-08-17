/**
 * shouldApplyIncoming — pure last-write-wins reconcile decision
 *
 * Compares incoming and local row timestamps (ISO 8601 UTC).
 * Lexicographic comparison of ISO strings = chronological for UTC 'Z' timestamps.
 *
 * @param local Local row (with updated_at, nullable)
 * @param incoming Incoming row (with updated_at and optional deleted_at)
 * @returns true iff incoming should overwrite local
 */
export function shouldApplyIncoming(
  local: { updated_at?: string | null } | null,
  incoming: { updated_at?: string | null; deleted_at?: string | null }
): boolean {
  // No local row: always apply incoming
  if (local === null) {
    return true;
  }

  // Extract timestamps (treat undefined/null as missing)
  const localTime = local.updated_at ?? null;
  const incomingTime = incoming.updated_at ?? null;

  // If incoming has no timestamp, reject
  if (incomingTime === null) {
    return false;
  }

  // If local has no timestamp, apply incoming
  if (localTime === null) {
    return true;
  }

  // Lexicographic string comparison (works for UTC ISO 8601 'Z' timestamps)
  // Apply if incoming >= local (>=)
  return incomingTime >= localTime;
}
