import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GmailSettings {
  enabled: boolean;
  tone: string;
  language: string;
  business_info: string;
  custom_instructions: string;
  signature: string;
  max_replies_per_run: number;
  only_unread: boolean;
  skip_promotions: boolean;
  /** 'all' = reply to every sender, 'gmail_only' = only @gmail.com senders */
  reply_scope?: string;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

export interface GmailStatus {
  connected: boolean;
  accountEmail?: string | null;
  clientConfigured?: boolean;
  settings?: GmailSettings;
}

export interface GmailAccountInfo {
  account_id: string;
  email: string | null;
  is_default: boolean;
  enabled: boolean;
}

export interface GmailReplyLogItem {
  id: string;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  reply_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

async function callGmail(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-api/email-trigger', { body: payload });
  if (error) throw new Error(error.message);
  if (data && data.success === false) throw new Error(data.error || 'Request failed');
  if (['gmail_connect_complete', 'gmail_disconnect', 'gmail_set_default'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export const getGmailSettings = (accountId?: string) =>
  callGmail({ action: 'gmail_settings_get', account_id: accountId || undefined });
export const saveGmailSettings = (settings: Partial<GmailSettings>, accountId?: string) =>
  callGmail({ action: 'gmail_settings_save', settings, account_id: accountId || undefined });
export const runGmailAutoReply = (dryRun = false, accountId?: string) =>
  callGmail({ action: 'gmail_autoreply_run', dryRun, account_id: accountId || undefined });
export const getGmailReplies = (limit = 20, accountId?: string) =>
  callGmail({ action: 'gmail_replies', limit, account_id: accountId || undefined });
export const disconnectGmail = (accountId?: string) =>
  callGmail({ action: 'gmail_disconnect', account_id: accountId || undefined });
export const completeGmailConnect = (code: string, scope?: string | null) =>
  callGmail({ action: 'gmail_connect_complete', code, origin: window.location.origin, scope: scope || undefined });
export const getGmailStatusFor = (scope?: string | null) =>
  callGmail({ action: 'gmail_status', scope: scope || undefined });
export const disconnectGmailFor = (scope?: string | null) =>
  callGmail({ action: 'gmail_disconnect', scope: scope || undefined });
export const getGmailStatus = (accountId?: string) =>
  callGmail({ action: 'gmail_status', account_id: accountId || undefined });

/** Lists every Gmail mailbox connected by this user. */
export const getGmailAccounts = (): Promise<{ success: boolean; accounts: GmailAccountInfo[] }> =>
  callGmail({ action: 'gmail_accounts' });

/** Marks one connected mailbox as the default account for Gmail features. */
export const setGmailDefault = (accountId: string) =>
  callGmail({ action: 'gmail_set_default', account_id: accountId });

/** Opens a popup, runs the per-user Google consent flow and resolves on success.
 *  Connecting a different Google account than any already-connected one adds a
 *  new mailbox instead of replacing the existing connection. */
export async function connectGmail(scope?: string | null): Promise<void> {
  const popup = window.open('', 'gmail-oauth', 'width=600,height=720');
  if (!popup) throw new Error('Popup blocked. Please allow popups and try again.');

  try {
    const res = await callGmail({ action: 'gmail_connect_start', origin: window.location.origin, scope: scope || undefined });
    const authorizationUrl = res?.authorizationUrl;
    if (!authorizationUrl) throw new Error('Could not start Google sign-in');

    const startedAt = Date.now();
    const completion = new Promise<void>((resolve, reject) => {
      let poll: number | undefined;
      let done = false;
      const cleanup = () => {
        done = true;
        window.removeEventListener('message', onMessage);
        window.removeEventListener('storage', onStorage);
        if (poll !== undefined) window.clearInterval(poll);
      };
      const finish = (type: string, reason?: string) => {
        if (done) return;
        cleanup();
        if (type === 'gmailConnectComplete') resolve();
        else { try { popup.close(); } catch { /* ignore */ } reject(new Error(reason || 'Gmail connection failed')); }
      };
      const readStored = () => {
        try {
          const r = JSON.parse(localStorage.getItem('gmailConnectResult') || 'null');
          if (r && r.t >= startedAt) return r as { type: string; reason?: string };
        } catch { /* ignore */ }
        return null;
      };
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const type = event.data?.type;
        if (type !== 'gmailConnectComplete' && type !== 'gmailConnectFailed') return;
        finish(type, event.data?.reason);
      };
      const onStorage = (event: StorageEvent) => {
        if (event.key !== 'gmailConnectResult') return;
        const r = readStored();
        if (r) finish(r.type, r.reason);
      };
      window.addEventListener('message', onMessage);
      window.addEventListener('storage', onStorage);
      poll = window.setInterval(() => {
        const r = readStored();
        if (r) return finish(r.type, r.reason);
        if (!popup.closed) return;
        // Give the storage signal a moment before treating a closed window as cancelled.
        window.setTimeout(() => {
          const late = readStored();
          if (late) finish(late.type, late.reason);
          else finish('gmailConnectFailed', 'Sign-in window closed before finishing');
        }, 800);
        window.clearInterval(poll);
      }, 500);
    });

    popup.location.href = authorizationUrl;
    await completion;
  } catch (e) {
    popup.close();
    throw e;
  }
}

export function useUserGmail(enabled = true, accountId?: string) {
  const [status, setStatus] = useState<GmailStatus>({ connected: false });
  const [loading, setLoading] = useState(enabled);
  const [accounts, setAccounts] = useState<GmailAccountInfo[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [res, accountsRes] = await Promise.all([
        callGmail({ action: 'gmail_status', account_id: accountId || undefined }),
        getGmailAccounts().catch(() => ({ accounts: [] as GmailAccountInfo[] })),
      ]);
      setStatus({
        connected: !!res?.connected,
        accountEmail: res?.accountEmail ?? null,
        clientConfigured: !!res?.clientConfigured,
        settings: res?.settings,
      });
      setAccounts(accountsRes?.accounts || []);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [enabled, accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useConnectionRefresh(refresh, enabled);

  return { status, loading, accounts, refresh };
}
