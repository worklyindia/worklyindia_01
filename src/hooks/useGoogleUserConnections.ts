import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const GOOGLE_PRODUCTS = ['adsense', 'search_console', 'analytics', 'drive', 'business_profile'] as const;
export type GoogleProduct = (typeof GOOGLE_PRODUCTS)[number];

export interface GoogleConnection {
  product: GoogleProduct;
  google_email: string | null;
  scopes: string[] | null;
  status: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
}

interface StatusResponse {
  configured: boolean;
  connections: GoogleConnection[];
}

async function callFn<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('unified-google-api', {
    body: { service: 'user_connect', ...body },
  });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
    throw new Error(String((data as Record<string, unknown>).error));
  }
  if (['disconnect'].includes(String(body.action))) notifyConnectionUpdated();
  return data as T;
}

/** Per-user Google connections (AdSense, Search Console, Analytics, Drive). */
export function useGoogleUserConnections(enabled: boolean, audience?: 'support') {
  const aud = audience ? { audience } : {};
  const [connections, setConnections] = useState<GoogleConnection[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<GoogleProduct | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setConnections([]);
      return;
    }
    setLoading(true);
    try {
      const data = await callFn<StatusResponse>({ action: 'status', ...aud });
      setConnections(data?.connections ?? []);
      setConfigured(data?.configured !== false);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, audience]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useConnectionRefresh(refresh, enabled);

  const get = useCallback(
    (product: GoogleProduct) => connections.find((c) => c.product === product) ?? null,
    [connections],
  );

  const connect = useCallback(async (product: GoogleProduct) => {
    setBusy(product);
    try {
      const data = await callFn<{ authorizationUrl: string }>({
        action: 'start',
        ...aud,
        product,
        origin: window.location.origin,
      });
      if (!data?.authorizationUrl) throw new Error('Could not start Google authorization.');
      window.location.href = data.authorizationUrl;
    } finally {
      setBusy(null);
    }
  }, [audience]);

  const disconnect = useCallback(
    async (product: GoogleProduct) => {
      setBusy(product);
      try {
        await callFn({ action: 'disconnect', ...aud, product });
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [refresh, audience],
  );

  return { connections, configured, loading, busy, get, connect, disconnect, refresh };
}
