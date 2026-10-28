/** Stable, isolated identity for Customer Service Meta connections. */
export async function supportOwnerId(userId: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`support:${userId}`))).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export const SUPPORT_CHANNELS = ['gmail', 'outlook', 'custom_email', 'whatsapp'] as const;
export type SupportChannel = typeof SUPPORT_CHANNELS[number];
export function supportSettingsKey(userId: string, channel: SupportChannel, accountId = '') {
  return `support_reply:${userId}:${channel}:${accountId}`;
}
export function metaReplyPatch(kind: 'comments' | 'messages', enabled: boolean) {
  return kind === 'comments' ? { ai_reply_comments: enabled } : { ai_reply_messages: enabled };
}