import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/** Where a file belongs; owner-only scopes are enforced on the server. */
export type R2MediaScope =
  | "brand" | "template-email" | "template-whatsapp" | "template-telegram"
  | "chat-email" | "chat-whatsapp" | "chat-instagram" | "chat-facebook" | "jobs";

const readError = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return body?.error || error.message;
  }
  return error instanceof Error ? error.message : "Upload failed";
};

/** Upload a file to Cloudflare exactly as-is (no WebP, no resizing). */
export async function uploadToR2(file: Blob, scope: R2MediaScope): Promise<{ url: string; key: string }> {
  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('egress-optimizer', { body: { ...body, scope } });
    if (error) throw new Error(await readError(error));
    if (!data?.success) throw new Error(data?.error || 'Upload failed');
    return data;
  };
  const init = await invoke({ action: 'r2-media-upload-init', size: file.size, contentType: file.type || 'application/octet-stream' });
  const parts: { partNumber: number; etag: string }[] = [];
  try {
    for (let offset = 0, partNumber = 1; offset < file.size; offset += init.partSize, partNumber++) {
      const signed = await invoke({ action: 'r2-media-upload-sign', path: init.path, uploadId: init.uploadId, partNumbers: [partNumber] });
      const response = await fetch(signed.urls[partNumber], { method: 'PUT', body: file.slice(offset, offset + init.partSize) });
      if (!response.ok) throw new Error(`Cloudflare upload failed (${response.status})`);
      const etag = response.headers.get('ETag');
      if (!etag) throw new Error('Cloudflare upload confirmation unavailable');
      parts.push({ partNumber, etag });
    }
    const saved = await invoke({ action: 'r2-media-upload-complete', path: init.path, uploadId: init.uploadId, parts });
    return { url: saved.url, key: saved.key };
  } catch (error) {
    await invoke({ action: 'r2-media-upload-abort', path: init.path, uploadId: init.uploadId }).catch(() => undefined);
    throw error;
  }
}

/** R2 object key from a public media URL, or null for any other URL. */
export const extractR2MediaKey = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const m = url.split("?")[0].match(/(media\/[a-z-]+\/[0-9a-f-]{36}\/[a-zA-Z0-9-]+\.[a-z0-9]{2,5})$/);
  return m ? m[1] : null;
};

/** Delete Cloudflare media for these URLs; non-Cloudflare URLs are ignored. */
export async function deleteR2Media(urls: (string | null | undefined)[]): Promise<void> {
  const keys = [...new Set(urls.map(extractR2MediaKey).filter(Boolean))] as string[];
  if (!keys.length) return;
  for (let offset = 0; offset < keys.length; offset += 50) {
    const batch = keys.slice(offset, offset + 50);
    const { data, error } = await supabase.functions.invoke('egress-optimizer', { body: { action: 'r2-delete-media', keys: batch } });
    if (error) throw new Error(await readError(error));
    if (!data?.ok || batch.some((key) => !data.deleted?.includes(key))) throw new Error(data?.error || 'Cloudflare files could not be deleted');
  }
}
