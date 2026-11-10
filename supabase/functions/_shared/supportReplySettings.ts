import { type SupportChannel } from './supportReplyScope.ts';
export type SupportSettingsClient = { from: (table: string) => any };

export interface SupportAccountSettings {
  enabled: boolean;
  tone: string;
  language: string;
  business_info: string;
  custom_instructions: string;
  signature: string;
}
export async function loadSupportAccountSettings(admin: SupportSettingsClient, userId: string, channel: SupportChannel, accountId = ''): Promise<SupportAccountSettings> {
  const [{ data: common, error: commonError }, { data: row, error }] = await Promise.all([
    admin.from('owner_support_settings').select('enabled,tone,language,business_info,custom_instructions,signature').eq('user_id', userId).maybeSingle(),
    admin.from('support_account_reply_settings').select('settings').eq('user_id', userId).eq('channel', channel).eq('account_id', accountId).maybeSingle(),
  ]);
  if (error || commonError) throw new Error(error?.message || commonError?.message);
  const saved = row?.settings || {};
  return { tone: 'friendly', language: 'auto', business_info: '', custom_instructions: '', signature: '', enabled: saved.enabled === true };
}