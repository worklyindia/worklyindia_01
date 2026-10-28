// Android draws the notification small icon from its alpha channel only, so a
// full-colour square becomes a solid blob. Turn light pixels transparent and
// thicken the shape so the logo outline stays readable at small sizes.
export async function toNotificationSilhouette(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const size = 144;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const alpha = new Uint8ClampedArray(size * size);
  for (let i = 0; i < size * size; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
    const dark = 255 - Math.min(r, g, b);
    alpha[i] = Math.min(255, dark * 1.8) * (a / 255);
  }
  // 1px dilation for bolder strokes
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < size && xx >= 0 && xx < size) m = Math.max(m, alpha[yy * size + xx]);
      }
      const p = (y * size + x) * 4;
      d[p] = 22; d[p + 1] = 70; d[p + 2] = 200; d[p + 3] = m;
    }
  }
  ctx.putImageData(img, 0, 0);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  return blob ? new File([blob], 'notification-badge.png', { type: 'image/png' }) : file;
}
