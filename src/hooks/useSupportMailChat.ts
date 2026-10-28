import { supabase } from '@/integrations/supabase/client';

export type MailProvider = 'domain' | 'outlook' | 'gmail';
export interface SupportAttachment { id: string; filename: string; mimeType: string; size: number; localUrl?: string }
export interface SupportMail {
  id: string;
  provider: MailProvider;
  mailbox: string;
  threadId?: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  html?: string;
  attachments?: SupportAttachment[];
  unread: boolean;
  hasAttachments: boolean;
}
export interface MailboxStatus { provider: MailProvider; connected: boolean; mailbox: string; error?: string }

export type MailScope = 'support' | 'personal';
let currentScope: MailScope = 'support';
/** 'personal' uses the signed-in user's own AI Connect mailboxes (employers). */
export const setSupportMailScope = (scope: MailScope) => { currentScope = scope; };

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  // Owner portal always uses the Customer Service mailboxes; everywhere else uses AI Connect.
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const scope: MailScope = path.startsWith('/owner-portal') ? 'support' : path.startsWith('/employer') ? 'personal' : currentScope;
  const body = scope === 'personal' ? { ...payload, scope: 'personal' } : { ...payload, scope: 'support' };
  const { data, error } = await supabase.functions.invoke('email-api', { body });
  if (error) throw new Error(error.message);
  if (!data || data.success !== true) throw new Error(data?.error || 'Email request failed');
  return data as T;
}

export const listSupportMail = (offset = 0, limit = 20) => call<{ items: SupportMail[]; mailboxes: MailboxStatus[]; hasMore: boolean }>({ action: 'support_mail_list', offset, limit });
export const getSupportThread = (provider: MailProvider, id: string) => call<{ items: SupportMail[] }>({ action: 'support_mail_thread', provider, id });
export type OutgoingFile = { name: string; mimeType: string; data: string };
export const replySupportMail = (provider: MailProvider, id: string, body: string, files: OutgoingFile[] = []) => call<{ sent: boolean }>({ action: 'support_mail_reply', provider, id, body, files });
export const sendSupportMail = (provider: MailProvider, to: string, subject: string, body: string) => call<{ sent: boolean }>({ action: 'support_mail_send', provider, to, subject, body });
export const getSupportAttachment = (provider: MailProvider, id: string, messageId: string, attachmentId: string) =>
  call<{ filename: string; mimeType: string; data: string }>({ action: 'support_mail_attachment', provider, id, messageId, attachmentId });
export const deleteSupportMail = (provider: MailProvider, ids: string[]) =>
  call<{ deleted: number }>({ action: 'support_mail_delete', provider, ids });
