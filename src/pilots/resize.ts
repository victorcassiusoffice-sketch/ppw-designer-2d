import { jpeg } from './photos';
export const MAX_BYTES = 400000,
  MAX_SIDE = 1600;
export function dimensions(w: number, h: number, limit = MAX_SIDE) {
  if (!Number.isFinite(w + h) || Math.min(w, h) <= 0) throw Error('Invalid image size.');
  const scale = Math.min(1, limit / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))] as const;
}
export async function resizePhoto(file: Blob): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size > 40_000_000)
    throw Error('Choose an image smaller than 40 MB.');
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    let [width, height] = dimensions(image.naturalWidth, image.naturalHeight);
    for (;;) {
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Could not prepare the image.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      for (const quality of [0.86, 0.73, 0.57, 0.4]) {
        const b = await jpeg(canvas, quality);
        if (b.size < MAX_BYTES && b.type === 'image/jpeg') return b;
      }
      width = Math.max(1, Math.floor(width * 0.75));
      height = Math.max(1, Math.floor(height * 0.75));
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
