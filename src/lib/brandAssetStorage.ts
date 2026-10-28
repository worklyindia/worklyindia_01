import { uploadToR2 } from "@/lib/r2Media";

const MAX_BRAND_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

/**
 * Brand images are stored on Cloudflare byte-for-byte (cropped output kept
 * as PNG/JPG, never shrunk or converted to WebP) so logos stay sharp.
 */
export const uploadBrandAsset = async (file: File, _fieldName: string): Promise<string> => {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Please choose a PNG, JPG, WebP, or SVG image.");
  }
  if (file.size > MAX_BRAND_ASSET_BYTES) {
    throw new Error("Image is larger than 10MB. Please choose a smaller image.");
  }
  const { url } = await uploadToR2(file, "brand");
  return url;
};
