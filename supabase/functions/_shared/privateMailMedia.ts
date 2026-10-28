import { privateMailStorage } from './r2Media.ts';

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function mailMediaPrefix(ownerId: string, account: string, messageId: string) {
  return `mail/${ownerId}/${await digest(account)}/${await digest(messageId)}/`;
}

/** Original bytes; no public URLs for personal mail. */
export async function cacheMailMedia(ownerId: string, account: string, messageId: string, attachmentId: string, bytes: Uint8Array, mimeType: string) {
  const storage = await privateMailStorage();
  const key = `${await mailMediaPrefix(ownerId, account, messageId)}${await digest(attachmentId)}`;
  const exists = await storage.client.fetch(new Request(`${storage.root}/${key}`, { method: 'HEAD' }));
  if (exists.ok) return;
  if (exists.status !== 404) throw new Error(`Cloudflare attachment read failed (${exists.status})`);
  const saved = await storage.client.fetch(new Request(`${storage.root}/${key}`, {
    method: 'PUT', headers: { 'Content-Type': mimeType }, body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType }),
  }));
  if (!saved.ok) throw new Error(`Cloudflare attachment upload failed (${saved.status})`);
}

/** Called only with an owner/account established by the existing mailbox authorization. */
export async function deleteMailMedia(ownerId: string, account: string, ids: string[]) {
  const storage = await privateMailStorage();
  for (const id of ids) {
    const prefix = await mailMediaPrefix(ownerId, account, id);
    let cursor = '';
    do {
      const url = new URL(storage.root);
      url.searchParams.set('list-type', '2'); url.searchParams.set('prefix', prefix);
      if (cursor) url.searchParams.set('continuation-token', cursor);
      const response = await storage.client.fetch(new Request(url));
      if (!response.ok) throw new Error(`Cloudflare attachment list failed (${response.status})`);
      const xml = await response.text();
      for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        const key = match[1];
        if (!key.startsWith(prefix) || !/^[a-zA-Z0-9/-]+$/.test(key)) continue;
        const gone = await storage.client.fetch(new Request(`${storage.root}/${key}`, { method: 'DELETE' }));
        if (!gone.ok && gone.status !== 404) throw new Error(`Cloudflare attachment delete failed (${gone.status})`);
      }
      cursor = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] || '' : '';
    } while (cursor);
  }
}