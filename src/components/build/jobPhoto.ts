import type { Photo } from '../../designer/link/vendor/tradefolder/lib/jobPack/types';
/** Re-encode locally: send only pixels, never the source's EXIF/location fields. */
export async function jobPhoto(file: File): Promise<Photo> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12_000_000)
    throw new Error('Choose a JPEG, PNG or WebP image under 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('This photo could not be read. Choose another image.');
    }
    if (
      !img.naturalWidth ||
      !img.naturalHeight ||
      img.naturalWidth * img.naturalHeight > 60_000_000
    )
      throw new Error('Choose a smaller photo.');
    const canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo processing is unavailable in this browser.');
    for (const side of [900, 640, 480, 320, 160]) {
      const r = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * r));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * r));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const ref = canvas.toDataURL('image/jpeg', 0.72),
        sizeBytes = atob(ref.slice(ref.indexOf(',') + 1)).length;
      if (sizeBytes > 0 && sizeBytes <= 60000 && ref.length <= 80000) return { ref, sizeBytes };
    }
    throw new Error('This photo does not fit the work file. Choose a smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
