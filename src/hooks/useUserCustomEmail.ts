import { useConnectionRefresh } from '@/hooks/useConnectionRefresh';
import { notifyConnectionUpdated } from '@/lib/connectionUpdates';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomEmailSettings {
  enabled: boolean;
  tone: string;
  language: string;
  business_info: string;
  custom_instructions: string;
  signature: string;
  max_replies_per_run: number;
  only_unread: boolean;
  skip_promotions?: boolean;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

export interface CustomEmailStatus {
  connected: boolean;
  accountEmail?: string | null;
  connectedAt?: string | null;
  settings?: CustomEmailSettings;
  account_id?: string;
}

export interface CustomEmailAccount {
  account_id: string;
  email: string | null;
  is_default: boolean;
  enabled: boolean;
}

export interface CustomEmailReplyLogItem {
  id: string;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  reply_text: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface MailboxCredentialsInput {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

async function call(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-api/email-trigger', { body: payload });
  if (error) throw new Error(error.message);
  if (data && data.success === false) throw new Error(data.error || 'Request failed');
  if (['custom_email_connect', 'custom_email_disconnect', 'custom_email_set_default'].includes(String(payload.action))) notifyConnectionUpdated();
  return data;
}

export const getCustomEmailStatus = (scope?: string | null, accountId?: string | null) =>
  call({ action: 'custom_email_status', scope: scope || undefined, account_id: accountId || undefined });
export const connectCustomEmail = (
  creds: MailboxCredentialsInput,
  scope?: string | null,
  accountId?: string | null,
) => call({ action: 'custom_email_connect', ...creds, scope: scope || undefined, account_id: accountId || undefined });
export const disconnectCustomEmail = (scope?: string | null, accountId?: string | null) =>
  call({ action: 'custom_email_disconnect', scope: scope || undefined, account_id: accountId || undefined });
export const saveCustomEmailSettings = (settings: Partial<CustomEmailSettings>, accountId?: string | null) =>
  call({ action: 'custom_email_settings_save', settings, account_id: accountId || undefined });
export const runCustomEmailAutoReply = (dryRun = false, accountId?: string | null) =>
  call({ action: 'custom_email_autoreply_run', dryRun, account_id: accountId || undefined });
export const getCustomEmailReplies = (limit = 20, accountId?: string | null) =>
  call({ action: 'custom_email_replies', limit, account_id: accountId || undefined });

/** Lists every mailbox connected to this feature for the current user. */
export const getCustomEmailAccounts = (): Promise<{ success: boolean; accounts: CustomEmailAccount[] }> =>
  call({ action: 'custom_email_accounts' });

/** Marks one connected mailbox as the default used when no account_id is passed. */
export const setCustomEmailDefault = (accountId: string) =>
  call({ action: 'custom_email_set_default', account_id: accountId });

/** Common mailbox provider presets (IMAP + SMTP over SSL). */
export const MAIL_PROVIDER_PRESETS: Record<
  string,
  { label: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number; hint?: string }
> = {
  workspace: {
    label: 'Google Workspace',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    hint: 'Use a Google App Password (2-step verification must be on).',
  },
  hostinger: {
    label: 'Hostinger',
    imapHost: 'imap.hostinger.com',
    imapPort: 993,
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 465,
    hint: 'Use your Hostinger email password.',
  },
  godaddy: {
    label: 'GoDaddy',
    imapHost: 'imap.secureserver.net',
    imapPort: 993,
    smtpHost: 'smtpout.secureserver.net',
    smtpPort: 465,
    hint: 'GoDaddy Microsoft 365 mailboxes use outlook.office365.com instead.',
  },
  namecheap: {
    label: 'Namecheap (Private Email)',
    imapHost: 'mail.privateemail.com',
    imapPort: 993,
    smtpHost: 'mail.privateemail.com',
    smtpPort: 465,
  },
  zoho: {
    label: 'Zoho Mail',
    imapHost: 'imap.zoho.in',
    imapPort: 993,
    smtpHost: 'smtp.zoho.in',
    smtpPort: 465,
    hint: 'Zoho requires an app-specific password.',
  },
  outlook: {
    label: 'Microsoft 365 / Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
  },
  cpanel: {
    label: 'cPanel / other host',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 465,
    hint: 'Usually mail.yourdomain.com for both IMAP and SMTP.',
  },
};

export function useUserCustomEmail(enabled = true, accountId?: string | null) {
  const [status, setStatus] = useState<CustomEmailStatus>({ connected: false });
  const [accounts, setAccounts] = useState<CustomEmailAccount[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [res, accountsRes] = await Promise.all([
        getCustomEmailStatus(null, accountId),
        getCustomEmailAccounts().catch(() => ({ success: false, accounts: [] as CustomEmailAccount[] })),
      ]);
      setStatus({
        connected: !!res?.connected,
        accountEmail: res?.accountEmail ?? null,
        connectedAt: res?.connectedAt ?? null,
        settings: res?.settings,
        account_id: res?.account_id,
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

  return { status, accounts, loading, refresh };
}
