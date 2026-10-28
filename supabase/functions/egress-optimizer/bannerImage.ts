const extensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp',
};
/** Decode only: never resize, crop or re-encode the original image. */
export function decodeBannerImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || !extensions[match[1]]) throw new Error('Use a JPG, PNG, GIF, WebP, AVIF or BMP image');
  const binary = atob(match[2]);
  if (!binary.length || binary.length > 10 * 1024 * 1024) throw new Error('Image must be under 10MB');
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: match[1], extension: extensions[match[1]] };
}
export function isBannerKey(key: string): boolean {
  return /^hero-banners\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|gif|webp|avif|bmp)$/.test(key);
}
