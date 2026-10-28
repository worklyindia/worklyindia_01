// Shared image size presets + exact-size post-processing for AI image generation.
// Gemini/OpenAI image models don't accept arbitrary pixel sizes, so we hint the
// aspect ratio in the prompt and then resize/crop the result to the EXACT pixels.
import { decode as decodeImage, Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

export interface SizePreset {
  key: string;
  label: string;
  width: number;
  height: number;
}

export const IMAGE_SIZE_PRESETS: SizePreset[] = [
  { key: "website_banner", label: "🖥️ Website banner", width: 1920, height: 1080 },
  { key: "blog_image", label: "🖼️ Website/blog image", width: 1200, height: 675 },
  { key: "instagram_post", label: "📱 Instagram Post", width: 1080, height: 1080 },
  { key: "instagram_portrait", label: "📱 Instagram Portrait", width: 1080, height: 1350 },
  { key: "instagram_story", label: "📱 Instagram Story/Reel", width: 1080, height: 1920 },
  { key: "youtube_thumbnail", label: "▶️ YouTube Thumbnail", width: 1280, height: 720 },
  { key: "profile_picture", label: "👤 Profile picture", width: 400, height: 400 },
  { key: "mobile_app_banner", label: "📱 Mobile app banner", width: 1080, height: 1920 },
  { key: "facebook_post", label: "🟦 Facebook Post", width: 1200, height: 630 },
  { key: "twitter_post", label: "🐦 X/Twitter Post", width: 1600, height: 900 },
  { key: "linkedin_post", label: "💼 LinkedIn Post", width: 1200, height: 627 },
  { key: "whatsapp_status", label: "💬 WhatsApp Status", width: 1080, height: 1920 },
  { key: "pinterest_pin", label: "📌 Pinterest Pin", width: 1000, height: 1500 },
  { key: "presentation_slide", label: "📊 Presentation slide", width: 1920, height: 1080 },
  { key: "a4_poster", label: "📄 A4 Poster (150dpi)", width: 1240, height: 1754 },
  { key: "email_header", label: "✉️ Email header", width: 1200, height: 400 },
  { key: "square_hd", label: "⬛ Square HD", width: 1080, height: 1080 },
];

export const PRESET_KEYS = IMAGE_SIZE_PRESETS.map((p) => p.key);

const MIN_SIDE = 64;
const MAX_SIDE = 4096;

export function findPreset(key?: string): SizePreset | null {
  if (!key) return null;
  const k = String(key).toLowerCase().trim().replace(/[\s-]+/g, "_");
  return IMAGE_SIZE_PRESETS.find((p) => p.key === k) || null;
}

/** Resolve the final exact pixel size from a preset key and/or explicit width/height. */
export function resolveTargetSize(
  sizePreset?: string,
  width?: number,
  height?: number,
): SizePreset {
  const preset = findPreset(sizePreset);
  let w = Number(width) || preset?.width || 1080;
  let h = Number(height) || preset?.height || 1080;
  w = Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(w)));
  h = Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(h)));
  return {
    key: preset?.key || "custom",
    label: preset?.label || `${w} × ${h}`,
    width: w,
    height: h,
  };
}

/** Closest common aspect-ratio wording so the model composes for the right frame. */
export function aspectRatioHint(width: number, height: number): string {
  const ratio = width / height;
  const known: Array<[string, number]> = [
    ["1:1 perfect square", 1],
    ["16:9 wide landscape", 16 / 9],
    ["9:16 tall vertical (full-screen mobile)", 9 / 16],
    ["4:5 portrait", 4 / 5],
    ["2:3 tall portrait", 2 / 3],
    ["3:2 landscape", 3 / 2],
    ["4:3 landscape", 4 / 3],
    ["3:4 portrait", 3 / 4],
    ["1.91:1 wide social banner", 1.91],
    ["3:1 ultra-wide banner", 3],
    ["1:1.41 A4 portrait page", 1 / 1.4142],
  ];
  let best = known[0];
  for (const k of known) {
    if (Math.abs(k[1] - ratio) < Math.abs(best[1] - ratio)) best = k;
  }
  return `${best[0]} (exactly ${width}×${height} pixels)`;
}

/**
 * Resize the generated image bytes to the EXACT target size.
 * Uses cover-crop (fill the frame, centre-crop overflow) so nothing is squashed.
 * Returns the original bytes unchanged if decoding/encoding fails.
 */
export async function resizeToExact(
  bytes: Uint8Array,
  targetWidth: number,
  targetHeight: number,
): Promise<{ bytes: Uint8Array; width: number; height: number; resized: boolean }> {
  try {
    const decoded = await decodeImage(bytes);
    if (!(decoded instanceof Image)) {
      return { bytes, width: targetWidth, height: targetHeight, resized: false };
    }
    if (decoded.width === targetWidth && decoded.height === targetHeight) {
      return { bytes, width: targetWidth, height: targetHeight, resized: true };
    }

    const scale = Math.max(targetWidth / decoded.width, targetHeight / decoded.height);
    const scaledW = Math.max(targetWidth, Math.round(decoded.width * scale));
    const scaledH = Math.max(targetHeight, Math.round(decoded.height * scale));

    const img = decoded.resize(scaledW, scaledH);
    const offsetX = Math.max(0, Math.floor((scaledW - targetWidth) / 2));
    const offsetY = Math.max(0, Math.floor((scaledH - targetHeight) / 2));
    const cropped = img.crop(offsetX, offsetY, targetWidth, targetHeight);

    const out = await cropped.encode(1);
    return { bytes: out, width: targetWidth, height: targetHeight, resized: true };
  } catch (e) {
    console.warn("[imageSizes] resize failed, keeping original:", (e as Error)?.message);
    return { bytes, width: targetWidth, height: targetHeight, resized: false };
  }
}

/** Human readable list for prompts / UI. */
export const PRESET_LIST_TEXT = IMAGE_SIZE_PRESETS
  .map((p) => `${p.label} → ${p.key} (${p.width}×${p.height})`)
  .join("\n");
