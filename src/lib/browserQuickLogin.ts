// Client-side helper: browser-token-based Quick Login storage + edge-function calls.
// Tokens are stored in localStorage as an array of raw opaque strings; only their
// SHA-256 hash is stored server-side. Clearing localStorage / cookies removes all
// recommendation ability — which is the intended privacy behaviour.

import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';

const STORAGE_KEY = 'wfh_browser_tokens_v1';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';

export type BrowserUserType = 'job_seeker' | 'employer';

export interface StoredBrowserToken {
  token: string;
  user_type: BrowserUserType;
}

export interface BrowserAccount {
  token: string;
  email: string;
  full_name: string;
  image_url: string;
}

function readStore(): StoredBrowserToken[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t &&
        typeof t.token === 'string' &&
        (t.user_type === 'job_seeker' || t.user_type === 'employer')
    );
  } catch {
    return [];
  }
}

function writeStore(items: StoredBrowserToken[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-10)));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function getStoredTokens(userType: BrowserUserType): string[] {
  return readStore()
    .filter((t) => t.user_type === userType)
    .map((t) => t.token);
}

export function addStoredToken(token: string, userType: BrowserUserType) {
  const items = readStore().filter((t) => t.token !== token);
  items.push({ token, user_type: userType });
  writeStore(items);
}

export function removeStoredTokens(tokens: string[]) {
  if (!tokens.length) return;
  const set = new Set(tokens);
  writeStore(readStore().filter((t) => !set.has(t.token)));
}

export function removeStoredTokensForType(userType: BrowserUserType) {
  writeStore(readStore().filter((t) => t.user_type !== userType));
}

export async function issueBrowserToken(accessToken: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/verify-browser-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'issue' }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data?.tokens)) {
      for (const t of data.tokens) {
        if (t?.token && (t.user_type === 'job_seeker' || t.user_type === 'employer')) {
          addStoredToken(t.token, t.user_type);
        }
      }
      return;
    }
    if (data?.issued && data.token && (data.user_type === 'job_seeker' || data.user_type === 'employer')) {
      addStoredToken(data.token, data.user_type);
    }
  } catch (err) {
    console.warn('issueBrowserToken failed:', err);
  }
}

export async function verifyBrowserTokens(
  userType: BrowserUserType
): Promise<BrowserAccount[]> {
  const tokens = getStoredTokens(userType);
  if (!tokens.length) return [];
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/verify-browser-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'verify', tokens, user_type: userType }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data?.invalid_tokens) && data.invalid_tokens.length) {
      removeStoredTokens(data.invalid_tokens);
    }
    return Array.isArray(data?.accounts) ? data.accounts : [];
  } catch (err) {
    console.warn('verifyBrowserTokens failed:', err);
    return [];
  }
}

export async function quickLoginWithBrowserToken(
  token: string,
  userType: BrowserUserType
): Promise<
  | { ok: true; email: string; token_hash: string; new_token: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/verify-browser-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'login', token, user_type: userType }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      // Stale token: drop it locally.
      removeStoredTokens([token]);
      return { ok: false, error: data?.error || 'quick_login_failed' };
    }
    // Rotate: swap old token for new one under same user_type.
    removeStoredTokens([token]);
    addStoredToken(data.new_token, userType);
    return { ok: true, email: data.email, token_hash: data.token_hash, new_token: data.new_token };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'quick_login_failed' };
  }
}

export async function revokeAllBrowserTokens(): Promise<void> {
  const all = readStore();
  if (!all.length) return;
  try {
    await fetch(`${SUPABASE_FUNCTIONS_URL}/verify-browser-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'revoke', tokens: all.map((t) => t.token) }),
    });
  } catch (err) {
    console.warn('revokeAllBrowserTokens failed:', err);
  } finally {
    writeStore([]);
  }
}
