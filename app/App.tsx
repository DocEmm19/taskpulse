import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';

import { getDb } from './src/db/database';
import { ensureDefaultCategories } from './src/db/repositories/categories';
import { purgeSeedDataOnce } from './src/db/seed';
import { useSessionStore } from './src/store/sessionStore';
import { startSyncEngine } from './src/lib/sync/syncEngine';
import { isSupabaseConfigured, getSupabase } from './src/lib/sync/supabaseClient';
import { getSupabaseSessionUserId } from './src/lib/sync/auth';
import { shouldShowAppAfterGate } from './src/lib/authGate';
import { isWeb } from './src/lib/platform';
import { claimLocalDataForUser, adoptOrphanCategoriesForUser } from './src/db/claimOwnership';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthGateScreen } from './src/screens/AuthGateScreen';
import { colors } from './src/theme/theme';

const SKIP_FLAG = 'session.skippedCloudSetup';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = still checking; true = show the app; false = show the sign-in gate.
  const [showApp, setShowApp] = useState<boolean | null>(null);
  const hydrate = useSessionStore((s) => s.hydrate);
  const setSupabaseUserId = useSessionStore((s) => s.setSupabaseUserId);

  useEffect(() => {
    (async () => {
      try {
        await hydrate(); // local user/device identity (AsyncStorage) — see sessionStore.ts
        await getDb(); // opens SQLite + runs CREATE TABLE migrations — see db/database.ts
        await ensureDefaultCategories(); // Personal/Official/Travel/Urgent (Req. #4)
        await purgeSeedDataOnce(); // one-time clean slate (replaces demo seeding)
        await resolveCloudGate();
        startSyncEngine(); // no-op until Supabase credentials are configured — see SUPABASE_SETUP.md
        setReady(true);
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
      }
    })();
  }, [hydrate]);

  // When the Supabase session ends (the Sign Out button on Home calls
  // supabase.auth.signOut()), drop straight back to the sign-in gate. Centralised
  // here so the button itself only has to end the session — it doesn't need
  // access to this component's showApp state.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSupabaseUserId(null);
        setShowApp(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [setSupabaseUserId]);

  async function resolveCloudGate() {
    if (!isSupabaseConfigured()) {
      setShowApp(true); // fully offline mode — no gate at all (default, zero-config experience)
      return;
    }
    const existingUserId = await getSupabaseSessionUserId();
    if (existingUserId) {
      setSupabaseUserId(existingUserId);
      // Already-signed-in devices skip the sign-in gate (and thus
      // claimLocalDataForUser), so legacy NULL-owned default categories would
      // never get adopted here — and every task push would keep failing the
      // category foreign key. Run the idempotent orphan-adoption sweep on every
      // such boot so those categories reach the cloud and tasks can sync.
      await adoptOrphanCategoriesForUser(existingUserId).catch(() => {});
      setShowApp(true);
      return;
    }
    // No session: on WEB require sign-in (skip ignored); on native honor the skip flag.
    const skipped = (await AsyncStorage.getItem(SKIP_FLAG)) === 'true';
    setShowApp(shouldShowAppAfterGate({ isWeb, configured: true, hasSession: false, skipped }));
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Could not start the app</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!ready || showApp === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!showApp) {
    return (
      <AuthGateScreen
        onSignedIn={async (userId, name) => {
          const localUserId = useSessionStore.getState().userId;
          await claimLocalDataForUser(localUserId, userId).catch(() => {});
          // Attribute Activity History (Task 4) to the actual signed-in
          // person, not whatever local device profile name was set before.
          if (name) useSessionStore.getState().setUserName(name);
          setSupabaseUserId(userId);
          setShowApp(true);
        }}
        onSkip={() => {
          AsyncStorage.setItem(SKIP_FLAG, 'true').catch(() => {});
          setShowApp(true);
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: colors.danger, marginBottom: 8 },
  errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
