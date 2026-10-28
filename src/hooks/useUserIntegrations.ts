import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IntegrationProvider = 'supabase' | 'vercel';

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number | null;
}

export interface VercelMetadata {
  username?: string | null;
  email?: string | null;
  name?: string | null;
  team?: { id: string; name?: string | null; slug?: string | null } | null;
  projects?: VercelProjectSummary[];
  project_count?: number;
  connected_at?: string;
}

export interface UserIntegration {
  id: string;
  provider: IntegrationProvider;
  label: string | null;
  /** 'pending' | 'connected' | 'needs_reconnect' | 'error' */
  status: string;
  metadata: VercelMetadata & Record<string, any>;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

const FUNCTION_NAME = 'unified-social-api';

async function callIntegrations(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: payload });
  if (error) {
    // supabase-js hides the real message behind "non-2xx status code" — read the body.
    let detail = '';
    try {
      const res = (error as any)?.context;
      if (res && typeof res.json === 'function') {
        const body = await res.clone().json();
        detail = body?.error || body?.message || '';
      }
    } catch { /* keep the generic message */ }
    throw new Error(detail || error.message);
  }
  if (data && data.success === false && data.error) throw new Error(data.error);
  if (['integrations_link', 'integrations_unlink'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export async function fetchUserIntegrations(): Promise<UserIntegration[]> {
  const res = await callIntegrations({ action: 'integrations_list' });
  return (res?.integrations || []) as UserIntegration[];
}

/** Manual credential link — Supabase only. Vercel uses OAuth. */
export async function linkUserIntegration(
  provider: 'supabase',
  config: { url: string; anon_key: string },
) {
  return callIntegrations({ action: 'integrations_link', provider, config });
}

export async function unlinkUserIntegration(provider: IntegrationProvider) {
  return callIntegrations({ action: 'integrations_unlink', provider });
}

export async function testUserIntegration(provider: IntegrationProvider) {
  return callIntegrations({ action: 'integrations_test', provider });
}

/**
 * Kicks off the official Vercel OAuth flow. The authorization code is
 * exchanged server-side inside the Edge Function — no token ever reaches
 * the browser.
 */
export async function startVercelOAuth() {
  const res = await callIntegrations({ action: 'integrations_vercel_auth_url' });
  const url = res?.url;
  if (!url) throw new Error('Could not start the Vercel authorization.');
  window.location.href = url;
}

/**
 * Kicks off the official Supabase OAuth flow — the user signs in on
 * supabase.com and authorizes the app. The code is exchanged server-side,
 * so no access token ever reaches the browser.
 */
export async function startSupabaseOAuth() {
  const res = await callIntegrations({ action: 'integrations_supabase_auth_url' });
  const url = res?.url;
  if (!url) throw new Error('Could not start the Supabase authorization.');
  window.location.href = url;
}

/** Read-only Vercel API access through the server-side proxy (AI use). */
export async function callVercelApi(path: string) {
  const res = await callIntegrations({ action: 'integrations_vercel_api', path });
  return res?.data;
}

export function useUserIntegrations(enabled = true) {
  const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await fetchUserIntegrations();
      setIntegrations(items);
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const get = useCallback(
    (provider: IntegrationProvider) => integrations.find((i) => i.provider === provider),
    [integrations],
  );

  useConnectionRefresh(refresh, enabled);

  return { integrations, loading, refresh, get };
}
