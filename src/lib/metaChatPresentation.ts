const REACTIONS: Record<string, string> = {
  heart: '❤️', love: '❤️', like: '👍', haha: '😂', wow: '😮', sad: '😢', angry: '😡', smile: '😊',
};
export function metaReactionEmoji(value: string): string {
  const raw = value.trim();
  if (/^[❤♥][\uFE0E\uFE0F]?$/.test(raw)) return raw[0] + '\uFE0F';
  return REACTIONS[raw.toLowerCase()] || raw;
}
export interface MetaAttachment { type: string; url: string; name?: string }
export function metaMessageMedia(message: { text: string; attachments?: MetaAttachment[]; attachment?: string | null }) {
  const attachments = [...(message.attachments || [])];
  if (!attachments.length && message.attachment) attachments.push({ type: 'image', url: message.attachment });
  let text = message.text;
  // Recover legacy attachment-only link sends, not ordinary website links.
  for (const url of text.match(/https?:\/\/[^\s<>]+/g) || []) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { continue; }
    let path: string;
    try { path = decodeURIComponent(parsed.pathname); } catch { path = parsed.pathname; }
    const ext = path.split('.').pop()?.toLowerCase();
    const type = ext && /^(png|jpe?g|gif|webp)$/.test(ext) ? 'image'
      : ext && /^(mp4|webm|mov)$/.test(ext) ? 'video'
      : ext && /^(mp3|ogg|wav|m4a)$/.test(ext) ? 'audio'
      : ext && /^(pdf|docx?|xlsx?|pptx?|csv|zip|txt)$/.test(ext) ? 'file' : null;
    if (!type) continue;
    if (!attachments.some((a) => a.url === url)) attachments.push({ type, url, name: path.split('/').pop() });
    text = text.replace(url, '').trim();
  }
  return { attachments, text };
}
