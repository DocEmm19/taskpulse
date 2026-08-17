import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { newId } from '../lib/uuid';

// v1 works fully offline with a local-only profile — no login screen, no
// network required (Req. list #43 treats "Login/profile" as a lightweight
// local identity, not multi-tenant auth). `userId` below is that local id and
// is what every repository uses as `created_by` by default.
//
// If Supabase IS configured (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY set — see
// SUPABASE_SETUP.md), App.tsx additionally requires a real Supabase Auth
// sign-in before showing the app, and `supabaseUserId` below takes over as
// the effective user id. This matters because the cloud RLS policies key
// everything off `auth.uid()` (ARCHITECTURE.md §5.3) — a locally-generated
// random id could never satisfy those policies, so once cloud sync is turned
// on, rows must be created under the real authenticated id from the start.

interface SessionState {
  userId: string;
  supabaseUserId: string | null;
  userName: string;
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  hydrated: boolean;
  setOnline: (v: boolean) => void;
  setUserName: (name: string) => void;
  setSupabaseUserId: (id: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  userId: '',
  supabaseUserId: null,
  userName: 'Gaurav',
  deviceId: '',
  deviceName: Platform.OS === 'ios' ? "Gaurav's iPhone" : Platform.OS === 'android' ? "Gaurav's Android" : 'Gaurav (Web)',
  isOnline: true,
  hydrated: false,
  setOnline: (v) => set({ isOnline: v }),
  setUserName: (name) => {
    set({ userName: name });
    AsyncStorage.setItem('session.userName', name).catch(() => {});
  },
  setSupabaseUserId: (id) => set({ supabaseUserId: id }),
  hydrate: async () => {
    if (get().hydrated) return;
    let [userId, userName, deviceId] = await Promise.all([
      AsyncStorage.getItem('session.userId'),
      AsyncStorage.getItem('session.userName'),
      AsyncStorage.getItem('session.deviceId'),
    ]);
    if (!userId) {
      userId = newId();
      await AsyncStorage.setItem('session.userId', userId);
    }
    if (!deviceId) {
      deviceId = newId();
      await AsyncStorage.setItem('session.deviceId', deviceId);
    }
    set({
      userId,
      userName: userName ?? 'Gaurav',
      deviceId,
      hydrated: true,
    });
  },
}));

/** Non-hook accessors for use in plain (non-component) modules like db/helpers.ts. */
export function getDeviceId(): string {
  return useSessionStore.getState().deviceId || 'unknown-device';
}
export function getCurrentUserId(): string {
  const { supabaseUserId, userId } = useSessionStore.getState();
  return supabaseUserId || userId || 'local-user';
}
/** The display name of whoever is using the app on this device right now —
 * same identity already shown on Home/More screens (`userName` in this
 * store). Used to attribute Activity History entries to a person, not just
 * a device id. */
export function getCurrentUserName(): string {
  return useSessionStore.getState().userName || 'Unknown';
}
