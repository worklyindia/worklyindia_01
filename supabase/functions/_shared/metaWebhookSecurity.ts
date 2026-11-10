/** Select the signing credential by verified payload source, never cross-fallback. */
export async function validMetaSignature(raw: string, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const expected = `sha256=${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

export function metaSubscriptionTarget(platform: 'facebook' | 'instagram', instagramLogin: boolean, pageId: string, instagramId?: string | null) {
  if (platform === 'instagram' && instagramLogin) {
    if (!instagramId) throw new Error('Instagram account ID missing');
    return { instagram: true, path: `/${instagramId}/subscribed_apps`, fields: 'comments,messages,message_reactions' };
  }
  if (!pageId) throw new Error('Facebook Page ID missing');
  return { instagram: false, path: `/${pageId}/subscribed_apps`, fields: 'feed,messages,message_reactions,message_echoes' };
}