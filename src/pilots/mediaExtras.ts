import type { Photo, Pilot } from './contract';
import { photoBytes } from './store';

export function siteFrames(p: Pilot, site: string): Photo[] {
  return p.photos
    .filter((ph) => ph.site === site && !ph.hidden && ph.kind === 'photo')
    .sort((a, b) => a.date.localeCompare(b.date));
}
export async function exportLapse(p: Pilot, frames: Photo[], signal: AbortSignal) {
  const mime =
    typeof MediaRecorder !== 'undefined' &&
    ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m),
    );
  const canvas = document.createElement('canvas');
  if (!mime || !canvas.captureStream) throw Error('WebM export is unavailable in this browser.');
  canvas.width = 960;
  canvas.height = 540;
  const g = canvas.getContext('2d');
  if (!g || !frames.length) throw Error('Add a dated photo first.');
  const feed = canvas.captureStream(10),
    rec = new MediaRecorder(feed, { mimeType: mime }),
    chunks: BlobPart[] = [];
  let failed = false;
  const stopped = new Promise<void>((done, reject) => {
    rec.onstop = () => done();
    rec.onerror = () => {
      failed = true;
      reject(Error('Recording failed.'));
    };
  });
  void stopped.catch(() => {});
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  try {
    for (const ph of frames) {
      signal.throwIfAborted();
      const bmp = await createImageBitmap(await photoBytes(ph, p));
      try {
        signal.throwIfAborted();
        const k = Math.min(canvas.width / bmp.width, canvas.height / bmp.height);
        g.fillStyle = '#16201e';
        g.fillRect(0, 0, 960, 540);
        g.drawImage(
          bmp,
          (960 - bmp.width * k) / 2,
          (540 - bmp.height * k) / 2,
          bmp.width * k,
          bmp.height * k,
        );
        g.fillStyle = '#15221ddd';
        g.fillRect(18, 481, 165, 43);
        g.font = '24px sans-serif';
        g.fillStyle = 'white';
        g.fillText(ph.date, 30, 511);
        if (rec.state === 'inactive' && !failed) rec.start();
        // Repaint the date while the still is on screen so captureStream emits timed frames.
        for (let n = 0; n < 6; n++) {
          await new Promise((done) => setTimeout(done, 100));
          signal.throwIfAborted();
          g.fillText(ph.date, 30, 511);
        }
        if (failed) throw Error('Recording failed.');
      } finally {
        bmp.close();
      }
    }
    rec.stop();
    await stopped;
    signal.throwIfAborted();
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (!blob.size) throw Error('The recording was empty.');
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'wall-time-lapse.webm';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } finally {
    if (rec.state !== 'inactive') rec.stop();
    feed.getTracks().forEach((t) => t.stop());
  }
}
