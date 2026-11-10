/**
 * Safe, best-effort browser-side image compression.
 *
 * Used before uploading images to Storage so large photos do not inflate
 * bandwidth (cached egress) later. Every failure path returns the ORIGINAL
 * file unchanged, so uploads can never break because of compression.
 */

export interface CompressOptions {
  /** Max width/height in pixels (aspect ratio is preserved). */
  maxDimension?: number;
  /** WebP/JPEG quality between 0 and 1. */
  quality?: number;
  /** Files smaller than this are left untouched. */
  skipBelowBytes?: number;
}

const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const compressImageFile = async (
  file: File,
  options: CompressOptions = {},
): Promise<File> => {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.82;
  const skipBelowBytes = options.skipBelowBytes ?? 200 * 1024;

  try {
    if (typeof document === "undefined") return file;
    if (!SUPPORTED.has(file.type)) return file; // svg / gif etc.
    if (file.size <= skipBelowBytes) return file;

    const bitmap = await loadBitmap(file);
    if (!bitmap) return file;

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    if ("close" in bitmap && typeof (bitmap as ImageBitmap).close === "function") {
      (bitmap as ImageBitmap).close();
    }

    // WebP keeps transparency and is far smaller than PNG for photos.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", quality),
    );
    if (!blob || blob.size < 1024) return file;
    // Only use the compressed version when it is clearly smaller.
    if (blob.size >= file.size * 0.9) return file;

    const newName = file.name.replace(/\.[a-z0-9]+$/i, "") + ".webp";
    return new File([blob], newName, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
};

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement | null> => {
  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file);
    }
  } catch {
    /* fall through to <img> decoding */
  }
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
};
