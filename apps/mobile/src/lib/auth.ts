import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { uuidv7 } from '@rua/core';
import { getSetting, setSetting } from '../db/repo';
import { nowIso } from './clock';

/**
 * Authentication, shaped exactly like the Clerk integration that replaces it
 * (TODO.md: "Clerk integration"). The interface mirrors Clerk's semantics so
 * the swap is a provider change, not a rewrite:
 *
 * - signUp/signIn return a session with a short-lived JWT (Clerk: ~60s-30m
 *   session tokens via getToken()).
 * - refresh(oldToken) exchanges a REMEMBERED token for a fresh one (Clerk:
 *   the client SDK holds the session; getToken() silently mints a new JWT
 *   while the session lives). LocalAuthProvider reproduces that contract:
 *   it remembers the last token it issued and exchanges it even after
 *   expiry, exactly the "send the old jwt, get a new jwt" silent path.
 * - The SILENT RE-LOGIN rule (product decision): when the stored token is
 *   past expiry, the caregiver re-enters via Face ID, not a password form.
 *   ensureFreshSession() gates the refresh behind biometrics when enrolled.
 *
 * Today's provider is LOCAL: the account lives on this device (settings
 * table + Keychain token), no server, which keeps the privacy label intact
 * until P29. Nothing outside this file knows which provider is active.
 */

export type AuthUser = { id: string; name: string; email: string };
export type AuthSession = { user: AuthUser; token: string; expiresAt: string };

export interface AuthProvider {
  signUp(input: { name: string; email: string }): Promise<AuthSession>;
  signIn(input: { email: string }): Promise<AuthSession>;
  /** Exchange a remembered (possibly expired) token for a fresh session. */
  refresh(oldToken: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

/** Session tokens live this long before a silent refresh is required. */
export const TOKEN_TTL_MINUTES = 30;

const TOKEN_KEY = 'rua.auth.token.v1';

/* ---------- token storage: Keychain on device, localStorage on web ---------- */

async function storeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/* ---------- the local provider ---------- */

type StoredAuth = {
  user: AuthUser;
  /** The last token this "server" issued; refresh exchanges exactly this. */
  rememberedToken: string;
  expiresAt: string;
};

function minutesFromNow(m: number): string {
  return new Date(Date.now() + m * 60_000).toISOString();
}

async function mintToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(24);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readStoredAuth(): StoredAuth | null {
  return getSetting<StoredAuth | null>('auth.local', null);
}

class LocalAuthProvider implements AuthProvider {
  async signUp(input: { name: string; email: string }): Promise<AuthSession> {
    const user: AuthUser = { id: uuidv7(), name: input.name.trim(), email: input.email.trim().toLowerCase() };
    return this.issue(user);
  }

  async signIn(input: { email: string }): Promise<AuthSession> {
    const stored = readStoredAuth();
    if (!stored || stored.user.email !== input.email.trim().toLowerCase()) {
      throw new Error('No account with that email exists on this device.');
    }
    return this.issue(stored.user);
  }

  async refresh(oldToken: string): Promise<AuthSession | null> {
    const stored = readStoredAuth();
    // The provider remembers the token it issued and exchanges it even after
    // expiry (Clerk keeps the session; only the JWT goes stale).
    if (!stored || stored.rememberedToken !== oldToken) return null;
    return this.issue(stored.user);
  }

  async signOut(): Promise<void> {
    setSetting('auth.local', null);
    await clearToken();
  }

  private async issue(user: AuthUser): Promise<AuthSession> {
    const token = await mintToken();
    const expiresAt = minutesFromNow(TOKEN_TTL_MINUTES);
    setSetting('auth.local', { user, rememberedToken: token, expiresAt } satisfies StoredAuth);
    await storeToken(token);
    return { user, token, expiresAt };
  }
}

export const authProvider: AuthProvider = new LocalAuthProvider();
// TODO(clerk): swap to ClerkAuthProvider (same interface) and delete the
// local minting; refresh() becomes clerk session.getToken({ skipCache }).

/* ---------- session state the app consumes ---------- */

export type SessionState =
  | { kind: 'signed-out' }
  | { kind: 'active'; session: AuthSession }
  | { kind: 'locked' }; // account exists, biometric gate not yet passed

export function currentUser(): AuthUser | null {
  return readStoredAuth()?.user ?? null;
}

export function hasAccount(): boolean {
  return currentUser() !== null;
}

function isExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

async function biometricGate(): Promise<boolean> {
  if (Platform.OS === 'web') return true; // test surface: no biometrics
  const enrolled =
    (await LocalAuthentication.hasHardwareAsync()) &&
    (await LocalAuthentication.isEnrolledAsync());
  if (!enrolled) return true; // no Face ID on device: do not lock the user out
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock RUA',
    cancelLabel: 'Cancel',
  });
  return res.success;
}

/**
 * The silent re-login: valid token -> active; expired token -> Face ID, then
 * exchange the remembered token for a fresh one. Only a failed biometric or
 * a token the provider no longer remembers lands on 'locked'/'signed-out'.
 */
export async function ensureFreshSession(): Promise<SessionState> {
  const stored = readStoredAuth();
  if (!stored) return { kind: 'signed-out' };

  const token = await readToken();
  if (!token) return { kind: 'signed-out' };

  if (!isExpired(stored.expiresAt) && token === stored.rememberedToken) {
    return {
      kind: 'active',
      session: { user: stored.user, token, expiresAt: stored.expiresAt },
    };
  }

  // Expired: Face ID first, then the silent token exchange.
  const passed = await biometricGate();
  if (!passed) return { kind: 'locked' };
  const fresh = await authProvider.refresh(token);
  if (!fresh) return { kind: 'signed-out' };
  return { kind: 'active', session: fresh };
}
