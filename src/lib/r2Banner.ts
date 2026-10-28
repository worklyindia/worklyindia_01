import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const readError = async (error: unknown): Promise<string> => {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return body?.error || error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : "Upload failed";
};

/**
 * Upload a banner image to Cloudflare R2 via the existing egress-optimizer
 * edge function (action: r2-upload-banner). Preserves the original file bytes.
 * Returns the public URL and R2 object key.
 */
export const uploadBannerToR2 = async (
  file: File,
): Promise<{ url: string; key: string }> => {
  const dataUrl = await fileToDataUrl(file);

  const { data, error } = await supabase.functions.invoke("egress-optimizer", {
    body: { action: "r2-upload-banner", file: dataUrl },
  });

  if (error) throw new Error(await readError(error));
  if (!data?.ok || !data?.url || !data?.key) {
    throw new Error(data?.error || "Upload failed: no URL returned");
  }

  return { url: data.url as string, key: data.key as string };
};

/** Extract the R2 object key from a banner public URL, if it is an R2 URL. */
export const extractR2Key = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const clean = url.split("?")[0];
  const match = clean.match(/(hero-banners\/[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|gif|webp|avif|bmp))$/);
  return match ? match[1] : null;
};

/**
 * Delete a banner image from Cloudflare R2 (action: r2-delete-banner).
 * No-op for non-R2 URLs (legacy Supabase/Cloudinary images are handled by
 * their own cleanup).
 */
export const deleteBannerFromR2 = async (
  url: string | null | undefined,
): Promise<void> => {
  const key = extractR2Key(url);
  if (!key) return;

  const { error } = await supabase.functions.invoke("egress-optimizer", {
    body: { action: "r2-delete-banner", key },
  });
  if (error) {
    console.error("R2 banner delete failed:", await readError(error));
  }
};
