let opened: Promise<IDBDatabase> | undefined;
function database() {
  if (!opened)
    opened = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('olb-pilot-photos-v1', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos');
      req.onerror = () => {
        opened = undefined;
        reject(new Error('Photo storage is unavailable on this device.'));
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          opened = undefined;
        };
        resolve(req.result);
      };
    });
  return opened;
}
export async function bytes(id: string): Promise<Blob | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const q = db.transaction('photos').objectStore('photos').get(id);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
export async function writeBytes(add: ReadonlyArray<[string, Blob]>, remove: string[] = []) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite'),
      s = tx.objectStore('photos');
    for (const key of remove) s.delete(key);
    for (const [key, blob] of add) s.put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Photo storage is full.'));
    tx.onerror = () => reject(tx.error);
  });
}
export function jpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode this photo.'))),
      'image/jpeg',
      quality,
    ),
  );
}
export async function sampleImage(index: number, label: string) {
  const pano = index === 4,
    canvas = document.createElement('canvas');
  canvas.width = pano ? 2048 : 768;
  canvas.height = pano ? 1024 : 420;
  const g = canvas.getContext('2d');
  if (!g) throw Error('Picture generation unavailable.');
  const { width: w, height: h } = canvas;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#9fcbd7');
  sky.addColorStop(0.53, '#d0ded1');
  sky.addColorStop(0.54, '#48664c');
  sky.addColorStop(1, '#294831');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (let row = 0; row < 9; row++)
    for (let col = -1; col < 28; col++) {
      const x = ((col + (row % 2) * 0.5) * w) / 25,
        y = h * 0.41 + row * h * 0.054;
      g.fillStyle =
        'hsl(' +
        (83 + 10 * Math.sin(col * 5 + row)) +
        ' ' +
        (14 + index * 2) +
        '% ' +
        (30 + 12 * Math.sin(col * 13 + row * 7) + (row % 3) * 3) +
        '%)';
      g.fillRect(x, y, w / 25 - 1, h * 0.054 - 1);
    }
  for (let j = 0; j < 150 * (1 + index); j++) {
    const frac = (n: number) => n - Math.floor(n),
      x = frac(Math.sin(j * 81 + 5) * 10000) * w,
      y = h * (0.42 + frac(Math.sin(j * 27 + 9) * 10000) * 0.47);
    g.fillStyle = 'rgba(113,153,74,.55)';
    g.beginPath();
    g.ellipse(x, y, 4 + index, 2 + index, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (!pano) {
    g.fillStyle = 'rgba(19,42,34,.8)';
    g.fillRect(0, h - 51, w, 51);
    g.fillStyle = 'white';
    g.font = '20px system-ui';
    g.fillText(label, 18, h - 18);
  }
  return jpeg(canvas, 0.82);
}
