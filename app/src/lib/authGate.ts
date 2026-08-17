// Pure decision for App.tsx's cloud sign-in gate. Kept side-effect-free so it
// can be unit-tested without React/AsyncStorage/Supabase.
//
// Rules:
// - Not configured (no Supabase creds) -> always show the app (zero-config offline mode).
// - An existing Supabase session -> show the app.
// - WEB with Supabase configured -> REQUIRE sign-in: never honor the offline "skip"
//   flag, because the whole point on web is the shared cloud workspace.
// - NATIVE with Supabase configured but no session -> honor the offline "skip" flag.
export function shouldShowAppAfterGate(input: {
  isWeb: boolean;
  configured: boolean;
  hasSession: boolean;
  skipped: boolean;
}): boolean {
  const { isWeb, configured, hasSession, skipped } = input;
  if (!configured) return true;
  if (hasSession) return true;
  if (isWeb) return false; // web must sign in — skip is ignored
  return skipped;
}
