import { supabase } from '@/integrations/supabase/client';

export interface SupportDeskSettings {
  enabled: boolean;
  brand_name: string;
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

export const SUPPORT_DESK_DEFAULTS: SupportDeskSettings = {
  enabled: false,
  brand_name: 'Workly India',
  tone: 'friendly',
  language: 'auto',
  business_info: '',
  custom_instructions: '',
  signature: '',
  max_replies_per_run: 5,
  only_unread: true,
  skip_promotions: true,
};

async function call(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-api', { body: payload });
  if (error) throw new Error(error.message);
  if (data && data.success === false) throw new Error(data.error || 'Request failed');
  return data;
}

export const getSupportSettings = () =>
  call({ action: 'support_settings_get' }) as Promise<{ settings: SupportDeskSettings }>;

export const saveSupportSettings = (settings: Partial<SupportDeskSettings>) =>
  call({ action: 'support_settings_save', settings }) as Promise<{ settings: SupportDeskSettings }>;

export const runSupportAutoReply = (dryRun = false) =>
  call({ action: 'support_autoreply_run', dryRun }) as Promise<{
    scanned: number;
    replied: number;
    runs: { provider: string; result: { success?: boolean; error?: string; replied?: number } }[];
  }>;

export type SupportChannel = 'gmail' | 'outlook' | 'custom_email' | 'whatsapp';
export type SupportAccountSettings = Pick<SupportDeskSettings, 'enabled' | 'tone' | 'language' | 'business_info' | 'custom_instructions' | 'signature'>;
export const getSupportAccountSettings = (channel: SupportChannel, accountId = '') =>
  call({ action: 'support_account_settings_get', channel, account_id: accountId }) as Promise<{ settings: SupportAccountSettings }>;
export const saveSupportAccountSettings = (channel: SupportChannel, accountId: string, settings: SupportAccountSettings) =>
  call({ action: 'support_account_settings_save', channel, account_id: accountId, settings }) as Promise<{ settings: SupportAccountSettings }>;
