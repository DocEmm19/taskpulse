import { getSupabase } from './supabaseClient';

/** Returns the active Supabase session's user id, or null if signed out /
 * Supabase isn't configured. Reads from the persisted session (AsyncStorage)
 * first — no network round-trip required, so this resolves instantly even
 * offline once a device has signed in before. */
export async function getSupabaseSessionUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** The signed-in user's id plus a best-effort display name — used to make
 * Activity History (Task 4) attribute actions to the right person instead of
 * the local device's default profile name. `name` prefers the `full_name`
 * set at sign-up (Supabase Auth `user_metadata`) and falls back to the
 * account's email; it's `null` only if neither is available. */
export interface SignedInUser {
  id: string;
  name: string | null;
}

export async function signInWithPassword(email: string, password: string): Promise<SignedInUser | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user?.id) return null;
  return {
    id: data.user.id,
    name: data.user.user_metadata?.full_name ?? data.user.email ?? null,
  };
}

export async function signOutSupabase() {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
