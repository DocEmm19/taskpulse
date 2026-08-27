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

  // Compare as parsed epoch millis, NOT as raw strings. The two sides can carry
  // the SAME instant in DIFFERENT ISO formats — a local row written by the
  // client uses `...Z` (Date.toISOString), while a row pulled from Supabase/
  // PostgREST comes back as `...+00:00`. Lexicographically `+`(0x2B) < `Z`(0x5A),
  // so a raw-string compare would wrongly reject an equal-or-newer incoming row
  // whenever only the suffix differs. Date.parse handles both forms.
  const localMs = Date.parse(localTime);
  const incomingMs = Date.parse(incomingTime);
  if (!Number.isNaN(localMs) && !Number.isNaN(incomingMs)) {
    return incomingMs >= localMs;
  }
  // Fallback for any unparseable value: original lexicographic behaviour.
  return incomingTime >= localTime;
}
