/**
 * Native Supabase passkey (WebAuthn) helpers.
 *
 * Uses the built-in `supabase.auth` passkey API that ships with
 * @supabase/supabase-js (experimental flag enabled in the client).
 *
 * The previous implementation used a custom `passkey-auth` edge function with
 * @simplewebauthn/browser. These helpers replace it and automatically report
 * when the native API is not (yet) enabled on the Supabase project, so callers
 * can fall back to the legacy flow.
 */
import { supabase } from '@/integrations/supabase/client';

export class NativePasskeyUnavailableError extends Error {
  constructor(message = 'Native Supabase passkeys are not enabled for this project') {
    super(message);
    this.name = 'NativePasskeyUnavailableError';
  }
}

type AuthWithPasskey = typeof supabase.auth & {
  signInWithPasskey?: (credentials?: { options?: { signal?: AbortSignal } }) => Promise<any>;
  registerPasskey?: (credentials?: { options?: { signal?: AbortSignal } }) => Promise<any>;
  passkey?: {
    list: () => Promise<any>;
    update: (params: { passkeyId: string; friendlyName: string }) => Promise<any>;
    delete: (params: { passkeyId: string }) => Promise<any>;
  };
};

const auth = () => supabase.auth as AuthWithPasskey;

/** True when the installed SDK exposes the native passkey API. */
export const isNativePasskeyApiAvailable = (): boolean =>
  typeof auth().signInWithPasskey === 'function' && typeof auth().registerPasskey === 'function';

/**
 * Detects errors that mean "the server side of native passkeys isn't on yet",
 * as opposed to a genuine user-facing failure (cancelled prompt, etc).
 */
export const isPasskeyServerUnavailable = (error: unknown): boolean => {
  if (error instanceof NativePasskeyUnavailableError) return true;
  const err = error as { message?: string; status?: number; code?: string } | null;
  if (!err) return false;
  if (err.status === 404 || err.status === 501) return true;
  const haystack = `${err.code ?? ''} ${err.message ?? ''}`.toLowerCase();
  return (
    haystack.includes('not enabled') ||
    haystack.includes('is experimental') ||
    haystack.includes('not found') ||
    haystack.includes('unsupported') ||
    haystack.includes('webauthn_not_enabled') ||
    haystack.includes('feature_not_enabled')
  );
};

// =============================================
// PASSKEY RELYING PARTY (DOMAIN) — FULLY DYNAMIC
// =============================================
// Resolution order (no code changes needed when the domain changes):
//   1. `passkey_rp_id` row in the `site_settings` table (set from admin/DB)
//   2. `VITE_PASSKEY_RP_ID` env value, if provided
//   3. The domain the app is currently served from (www. stripped)
// Keep this value equal to the "Relying Party ID" in Supabase Auth → Passkeys.

const RP_ID_STORAGE_KEY = 'passkey_rp_id';

let cachedRpId: string | null = null;

const stripWww = (host: string) => host.replace(/^www\./i, '').toLowerCase();

const currentHost = (): string =>
  typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();

const readStoredRpId = (): string | null => {
  try {
    return localStorage.getItem(RP_ID_STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Resolved Relying Party ID for passkeys (synchronous, best-known value). */
export const getPasskeyRpId = (): string => {
  if (cachedRpId) return cachedRpId;
  const stored = readStoredRpId();
  if (stored) {
    cachedRpId = stored;
    return stored;
  }
  const fromEnv = (import.meta.env.VITE_PASSKEY_RP_ID as string | undefined)?.trim();
  if (fromEnv) return stripWww(fromEnv);
  return stripWww(currentHost());
};

/**
 * Loads the Relying Party ID from `site_settings` (key: `passkey_rp_id`) and
 * caches it. Safe to call repeatedly; failures fall back to the current domain.
 */
export const loadPasskeyRpId = async (): Promise<string> => {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', RP_ID_STORAGE_KEY)
      .maybeSingle();

    const raw = data?.value as unknown;
    const value =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? ((raw as Record<string, unknown>).rp_id as string | undefined) ??
            ((raw as Record<string, unknown>).domain as string | undefined)
          : undefined;

    if (value && value.trim()) {
      const resolved = stripWww(value.trim());
      cachedRpId = resolved;
      try {
        localStorage.setItem(RP_ID_STORAGE_KEY, resolved);
      } catch {
        /* storage unavailable — in-memory cache still works */
      }
      return resolved;
    }
  } catch {
    /* ignore — fall back below */
  }
  return getPasskeyRpId();
};

// Warm the value up as soon as the module is used, without blocking anything.
if (typeof window !== 'undefined') {
  void loadPasskeyRpId();
}

/**
 * Passkeys only work on the registered domain. On preview / other domains the
 * browser or server rejects the ceremony — that is not a real failure.
 */
export const isPasskeyDomainMismatch = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = currentHost();
  if (host === 'localhost' || host === '127.0.0.1') return false;
  const base = stripWww(getPasskeyRpId());
  if (!base) return false;
  return stripWww(host) !== base && !host.endsWith(`.${base}`);
};

/** Human readable domain-mismatch message for the resolved passkey domain. */
export const getPasskeyDomainMessage = (): string =>
  `Passkeys only work on ${getPasskeyRpId()}. Please open the app on that address to set up or use your passkey.`;

/** Human readable message for a passkey failure. */
export const describePasskeyError = (error: unknown, fallback = 'Passkey failed'): string => {
  const err = error as { name?: string; message?: string } | null;
  if (isPasskeyDomainMismatch()) return getPasskeyDomainMessage();
  if (!err) return fallback;
  if (err.name === 'NotAllowedError') return 'The passkey prompt was cancelled or timed out. Please try again.';
  if (err.name === 'InvalidStateError') return 'A passkey for this device already exists.';
  if (err.name === 'NotSupportedError') return 'This device does not support passkeys.';
  if (err.name === 'SecurityError') return getPasskeyDomainMessage();
  return err.message || fallback;
};



const unwrap = <T,>(result: { data?: T; error?: unknown } | undefined): T => {
  if (!result) throw new NativePasskeyUnavailableError();
  if (result.error) throw result.error;
  return result.data as T;
};

// =============================================
// SAVED PASSKEY IDENTITY (what the password manager shows)
// =============================================
// The browser / Google Password Manager saves the passkey under the
// `user.name` value sent to the authenticator during registration — which is
// not always the account email. We capture that exact value while the
// ceremony runs and remember it, so the UI can show the same identity.

const PASSKEY_IDENTITY_KEY = 'passkey_saved_identity';

export const getSavedPasskeyIdentity = (): string => {
  try {
    return localStorage.getItem(PASSKEY_IDENTITY_KEY) || '';
  } catch {
    return '';
  }
};

const setSavedPasskeyIdentity = (value: string) => {
  try {
    if (value) localStorage.setItem(PASSKEY_IDENTITY_KEY, value);
  } catch {
    /* storage unavailable */
  }
};

export const clearSavedPasskeyIdentity = () => {
  try {
    localStorage.removeItem(PASSKEY_IDENTITY_KEY);
  } catch {
    /* ignore */
  }
};

/** Registers a new passkey for the currently signed-in user. */
export const registerNativePasskey = async (signal?: AbortSignal) => {
  if (!isNativePasskeyApiAvailable()) throw new NativePasskeyUnavailableError();

  // Capture the identity that will actually be stored by the password manager.
  let captured = '';
  const creds = typeof navigator !== 'undefined' ? navigator.credentials : undefined;
  const originalCreate = creds?.create?.bind(creds);
  if (creds && originalCreate) {
    creds.create = ((options?: CredentialCreationOptions) => {
      const user = (options as any)?.publicKey?.user;
      captured = String(user?.name || user?.displayName || '').trim();
      return originalCreate(options);
    }) as typeof creds.create;
  }

  try {
    const result = unwrap<any>(
      await auth().registerPasskey!({ options: signal ? { signal } : undefined })
    );
    if (captured) {
      setSavedPasskeyIdentity(captured);
      // Keep the server-side label in sync so other devices show it too.
      const passkeyId = result?.id || result?.passkey?.id;
      if (passkeyId) {
        try {
          await renameNativePasskey(passkeyId, captured);
        } catch {
          /* labelling is best-effort */
        }
      }
    }
    return result;
  } finally {
    if (creds && originalCreate) creds.create = originalCreate;
  }
};

/** Signs the user in with a passkey (discoverable credential, no email needed). */
export const signInWithNativePasskey = async (signal?: AbortSignal) => {
  if (!isNativePasskeyApiAvailable()) throw new NativePasskeyUnavailableError();
  const data = unwrap<{ session: unknown | null; user: unknown | null }>(
    await auth().signInWithPasskey!({ options: signal ? { signal } : undefined })
  );
  if (!data?.session) throw new Error('Passkey sign-in did not return a session');
  return data;
};

export type NativePasskey = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

/** Lists the signed-in user's registered passkeys. */
export const listNativePasskeys = async (): Promise<NativePasskey[]> => {
  const api = auth().passkey;
  if (!api) throw new NativePasskeyUnavailableError();
  return unwrap<NativePasskey[]>(await api.list()) ?? [];
};

/** Renames a passkey. */
export const renameNativePasskey = async (passkeyId: string, friendlyName: string) => {
  const api = auth().passkey;
  if (!api) throw new NativePasskeyUnavailableError();
  return unwrap(await api.update({ passkeyId, friendlyName }));
};

/** Deletes a single passkey. */
export const deleteNativePasskey = async (passkeyId: string) => {
  const api = auth().passkey;
  if (!api) throw new NativePasskeyUnavailableError();
  return unwrap(await api.delete({ passkeyId }));
};

/** Deletes every passkey registered for the signed-in user. */
export const deleteAllNativePasskeys = async () => {
  const passkeys = await listNativePasskeys();
  for (const passkey of passkeys) {
    await deleteNativePasskey(passkey.id);
  }
  return passkeys.length;
};

/** Device label used as the passkey friendly name. */
export const getPasskeyDeviceName = (): string => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'This Device';
};
