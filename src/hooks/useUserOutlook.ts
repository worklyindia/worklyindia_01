import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface OutlookSettings {
  enabled: boolean;
  tone: string;
  language: string;
  business_info: string;
  custom_instructions: string;
  signature: string;
  max_replies_per_run: number;
  only_unread: boolean;
  skip_promotions: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

export interface OutlookAccountInfo {
  account_id: string;
  email: string | null;
  is_default: boolean;
  enabled: boolean;
}

export interface OutlookStatus {
  connected: boolean;
  accountEmail?: string | null;
  clientConfigured?: boolean;
  settings?: OutlookSettings;
  accountId?: string;
  accounts?: OutlookAccountInfo[];
}

export interface OutlookReplyLogItem {
  id: string;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  reply_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

async function callOutlook(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-api/email-trigger', { body: payload });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const details = await error.context.clone().json();
        if (details?.error) throw new Error(String(details.error));
      } catch (detailsError) {
        if (detailsError instanceof Error && detailsError.name !== 'SyntaxError') throw detailsError;
      }
    }
    throw new Error(error.message);
  }
  if (data && data.success === false) throw new Error(data.error || 'Request failed');
  if (['outlook_connect_complete', 'outlook_disconnect', 'outlook_set_default'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export const getOutlookSettings = (accountId?: string) =>
  callOutlook({ action: 'outlook_settings_get', account_id: accountId || undefined });
export const saveOutlookSettings = (settings: Partial<OutlookSettings>, accountId?: string) =>
  callOutlook({ action: 'outlook_settings_save', settings, account_id: accountId || undefined });
export const runOutlookAutoReply = (dryRun = false, accountId?: string) =>
  callOutlook({ action: 'outlook_autoreply_run', dryRun, account_id: accountId || undefined });
export const getOutlookReplies = (limit = 20, accountId?: string) =>
  callOutlook({ action: 'outlook_replies', limit, account_id: accountId || undefined });
export const disconnectOutlook = (accountId?: string) =>
  callOutlook({ action: 'outlook_disconnect', account_id: accountId || undefined });
export const completeOutlookConnect = (code: string, scope?: string | null) =>
  callOutlook({ action: 'outlook_connect_complete', code, origin: window.location.origin, scope: scope || undefined });
export const getOutlookStatusFor = (scope?: string | null) =>
  callOutlook({ action: 'outlook_status', scope: scope || undefined });
export const disconnectOutlookFor = (scope?: string | null) =>
  callOutlook({ action: 'outlook_disconnect', scope: scope || undefined });

/** Lists every Outlook account the user has connected (not scoped templates). */
export const getOutlookAccounts = () =>
  callOutlook({ action: 'outlook_accounts' }) as Promise<{ success: boolean; accounts: OutlookAccountInfo[] }>;
/** Marks the given account as the default used when no account_id is specified. */
export const setOutlookDefault = (accountId: string) =>
  callOutlook({ action: 'outlook_set_default', account_id: accountId });

/** Opens a popup, runs the per-user Microsoft consent flow and resolves on success. */
export async function connectOutlook(scope?: string | null): Promise<void> {
  const popup = window.open('', 'outlook-oauth', 'width=600,height=720');
  if (!popup) throw new Error('Popup blocked. Please allow popups and try again.');

  try {
    const res = await callOutlook({ action: 'outlook_connect_start', origin: window.location.origin, scope: scope || undefined });
    const authorizationUrl = res?.authorizationUrl;
    if (!authorizationUrl) throw new Error('Could not start Microsoft sign-in');

    const completion = new Promise<void>((resolve, reject) => {
      let poll: number | undefined;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        if (poll !== undefined) window.clearInterval(poll);
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const type = event.data?.type;
        if (type !== 'outlookConnectComplete' && type !== 'outlookConnectFailed') return;
        cleanup();
        if (type === 'outlookConnectComplete') {
          resolve();
        } else {
          popup.close();
          reject(new Error(event.data?.reason || 'Outlook connection failed'));
        }
      };
      window.addEventListener('message', onMessage);
      const startedAt = Date.now();
      const readStored = () => {
        try {
          const r = JSON.parse(localStorage.getItem('outlookConnectResult') || 'null');
          if (r && r.t >= startedAt) return r as { type: string; reason?: string };
        } catch { /* ignore */ }
        return null;
      };
      const settle = (r: { type: string; reason?: string }) => {
        cleanup();
        if (r.type === 'outlookConnectComplete') resolve();
        else reject(new Error(r.reason || 'Outlook connection failed'));
      };
      poll = window.setInterval(() => {
        const r = readStored();
        if (r) return settle(r);
        if (!popup.closed) return;
        window.clearInterval(poll);
        // Give the storage signal a moment before treating a closed window as cancelled.
        window.setTimeout(() => {
          const late = readStored();
          if (late) settle(late);
          else { cleanup(); reject(new Error('Sign-in window closed before finishing')); }
        }, 800);
      }, 500);
    });

    popup.location.href = authorizationUrl;
    await completion;
  } catch (e) {
    popup.close();
    throw e;
  }
}

export function useUserOutlook(enabled = true, accountId?: string) {
  const [status, setStatus] = useState<OutlookStatus>({ connected: false });
  const [accounts, setAccounts] = useState<OutlookAccountInfo[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await callOutlook({ action: 'outlook_status', account_id: accountId || undefined });
      setStatus({
        connected: !!res?.connected,
        accountEmail: res?.accountEmail ?? null,
        clientConfigured: !!res?.clientConfigured,
        settings: res?.settings,
        accountId: res?.accountId,
        accounts: res?.accounts,
      });
      setAccounts(res?.accounts || []);
    } catch {
      setStatus({ connected: false });
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useConnectionRefresh(refresh, enabled);

  return { status, loading, refresh, accounts };
}
