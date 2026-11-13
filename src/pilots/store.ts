import { create } from 'zustand';
import { z } from 'zod';
import { exampleSlug, pilotSchema, type Pilot, type Photo } from './contract';
import { samplePilot } from './example';
import { bytes, writeBytes, sampleImage } from './photos';
import { isShared, editShared, uploadShared } from './remote';
const key = 'olb-pilots-v1',
  saved = z.array(pilotSchema).max(100);
const initial = () => [samplePilot()];
function read() {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    const seed = initial();
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return saved.parse(JSON.parse(raw));
}
let initialError = '';
let pilots: Pilot[] = [];
try {
  pilots = read();
} catch {
  initialError = 'This device could not open its pilot records. Check browser storage and reload.';
}
export const usePilots = create<{ pilots: Pilot[]; error: string }>(() => ({
  pilots,
  error: initialError,
}));
window.addEventListener('storage', (e) => {
  if (e.key === key)
    try {
      usePilots.setState({ pilots: read(), error: '' });
    } catch {
      usePilots.setState({ error: 'Could not read the updated pilot records.' });
    }
});
function save(next: Pilot[]) {
  const data = saved.parse(next);
  localStorage.setItem(key, JSON.stringify(data));
  usePilots.setState({ pilots: data, error: '' });
}
export function update(slug: string, change: (p: Pilot) => void) {
  if (isShared(slug)) return editShared(slug, change);
  const next = read(),
    p = next.find((p) => p.slug === slug);
  if (!p) throw Error('Pilot no longer exists.');
  change(p);
  save(next);
  return true;
}
export function createPilot(p: Pilot) {
  const next = read();
  if (next.some((x) => x.slug === p.slug)) throw Error('This pilot already exists.');
  save([...next, p]);
}
export async function resetExample() {
  const next = read(),
    old = next.find((p) => p.slug === exampleSlug);
  save([...next.filter((p) => p.slug !== exampleSlug), samplePilot()]);
  await writeBytes([], old?.photos.map((p) => p.id) ?? []);
  localStorage.removeItem('ppw-pilot-plan-example-wall');
}
const pending = new Map<string, Promise<Blob>>();
export async function photoBytes(photo: Photo, p: Pilot) {
  if (isShared(p.slug)) {
    const res = await fetch('/api/pilots/' + p.slug + '/photos/' + photo.id, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) throw Error('Photo unavailable.');
    return res.blob();
  }
  const b = await bytes(photo.id);
  if (b) return b;
  if (p.slug !== exampleSlug || !/^sample-photo-[0-4]$/.test(photo.id))
    throw Error('Photo unavailable on this device.');
  const inflight = pending.get(photo.id);
  if (inflight) return inflight;
  const job = sampleImage(
    Number(photo.id.slice(-1)[0]),
    p.sites.find((s) => s.id === photo.site)?.name ?? 'Example wall',
  )
    .then(async (blob) => {
      await writeBytes([[photo.id, blob]]);
      return blob;
    })
    .finally(() => pending.delete(photo.id));
  pending.set(photo.id, job);
  return job;
}
export async function addPhotos(slug: string, added: Array<[Photo, Blob]>) {
  if (isShared(slug)) return uploadShared(slug, added);
  const action = async () => {
    const all = read();
    const rows = all.flatMap((p) => p.photos);
    const need = Math.max(0, rows.length + added.length - 200),
      evict = rows
        .filter((p) => p.hidden)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, need)
        .map((p) => p.id);
    if (evict.length < need)
      throw Error('This device holds 200 photos. Hide older photos to make space.');
    await writeBytes(added.map(([p, b]) => [p.id, b]));
    try {
      const latest = read(),
        p = latest.find((p) => p.slug === slug);
      if (!p) throw Error('Pilot unavailable.');
      for (const rec of latest) {
        rec.photos = rec.photos.filter((ph) => !evict.includes(ph.id));
        for (const rd of rec.readings) if (rd.photo && evict.includes(rd.photo)) delete rd.photo;
      }
      p.photos.push(...added.map((a) => a[0]));
      save(latest);
    } catch (e) {
      await writeBytes(
        [],
        added.map((a) => a[0].id),
      );
      throw e;
    }
    await writeBytes([], evict);
  };
  if (navigator.locks) await navigator.locks.request('olb-pilot-photos', action);
  else await action();
}
