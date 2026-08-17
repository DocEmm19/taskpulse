// sessionStore.ts imports AsyncStorage (native, needs a Jest mock) and
// `../lib/uuid` (which pulls in expo-crypto -> expo-constants, whose real
// module chain doesn't resolve under plain Jest — same native-module
// constraint syncEngine.test.ts documents for its own dependencies). Neither
// is exercised by the setUserName/getCurrentUserName path under test here,
// so both are mocked purely to let sessionStore.ts load.
//
// auth.ts's only native-unsafe dependency is supabaseClient.ts (it pulls in
// react-native-url-polyfill + AsyncStorage transitively) — mocked here the
// same way src/lib/sync/__tests__/syncEngine.test.ts mocks it, so the REAL
// signInWithPassword (and its name-extraction logic) runs under test.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('../../lib/uuid', () => ({
  __esModule: true,
  newId: jest.fn(() => 'id-x'),
}));

const mockSignInWithPassword = jest.fn();
jest.mock('../../lib/sync/supabaseClient', () => ({
  __esModule: true,
  getSupabase: jest.fn(() => ({ auth: { signInWithPassword: mockSignInWithPassword } })),
  isSupabaseConfigured: jest.fn(() => true),
}));

import { useSessionStore, getCurrentUserName } from '../sessionStore';
import { signInWithPassword } from '../../lib/sync/auth';

describe('identity follows the signed-in account (Task 14)', () => {
  test('signing in with a full_name sets the display name used for attribution', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'abhay@example.com', user_metadata: { full_name: 'Abhay' } } },
      error: null,
    });

    const result = await signInWithPassword('abhay@example.com', 'pw');
    expect(result).toEqual({ id: 'user-1', name: 'Abhay' });

    useSessionStore.getState().setUserName(result!.name!);
    expect(getCurrentUserName()).toBe('Abhay');
  });

  test('falls back to email when full_name is missing from user_metadata', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-2', email: 'gaurav@example.com', user_metadata: {} } },
      error: null,
    });

    const result = await signInWithPassword('gaurav@example.com', 'pw');
    expect(result).toEqual({ id: 'user-2', name: 'gaurav@example.com' });

    useSessionStore.getState().setUserName(result!.name!);
    expect(getCurrentUserName()).toBe('gaurav@example.com');
  });

  test('name stays null (no attribution change) when neither full_name nor email is present', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-3', user_metadata: {} } },
      error: null,
    });

    const result = await signInWithPassword('noemail@example.com', 'pw');
    expect(result).toEqual({ id: 'user-3', name: null });
  });
});
