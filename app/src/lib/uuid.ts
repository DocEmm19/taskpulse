import * as Crypto from 'expo-crypto';

/** Generate a client-side UUID v4. Used for every primary key in the app (see
 * ARCHITECTURE.md §4.2) so records created offline are already permanently and
 * globally identified before they ever reach the server. */
export function newId(): string {
  return Crypto.randomUUID();
}
