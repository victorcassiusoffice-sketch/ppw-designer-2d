import { useSyncExternalStore } from 'react';
export interface Pin {
  id: string;
  name: string;
  kind: string;
  lanes: string[];
  lat: number;
  lon: number;
  place: string;
  state: string;
  note: string;
}
export function parseProgramme(text: string): Pin[] {
  if (text.length > 512_000) throw Error('Choose a JSON file under 500 KB.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error('This is not a JSON file.');
  }
  const rows = Array.isArray(data) ? data : (data as { sites?: unknown } | null)?.sites;
  if (!Array.isArray(rows) || rows.length > 500)
    throw Error('The file needs a sites list with at most 500 entries.');
  const ids = new Set<string>();
  return rows.map((p, i) => {
    if (!p || typeof p !== 'object') throw Error('Invalid entry ' + (i + 1) + '.');
    const str = (x: unknown, n: number, empty = false) =>
      typeof x === 'string' && x.length <= n && (empty || x.trim().length > 0);
    if (
      !str(p.id, 100) ||
      ids.has(p.id) ||
      !str(p.name, 160) ||
      !str(p.kind, 100) ||
      !str(p.state, 100) ||
      !Array.isArray(p.lanes) ||
      p.lanes.length > 30 ||
      !p.lanes.every((x: unknown) => str(x, 100)) ||
      !Number.isFinite(p.lat) ||
      Math.abs(p.lat) > 90 ||
      !Number.isFinite(p.lon) ||
      Math.abs(p.lon) > 180 ||
      !str(p.place ?? '', 160, true) ||
      !str(p.note ?? '', 2000, true)
    )
      throw Error('Check the fields and coordinates in entry ' + (i + 1) + '.');
    ids.add(p.id);
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      lanes: [...p.lanes],
      lat: p.lat,
      lon: p.lon,
      place: p.place ?? '',
      state: p.state,
      note: p.note ?? '',
    };
  });
}
// Tab memory only. Never attach the file to a saved/shared property, analytics or requests.
const perPlan = new Map<string, readonly Pin[]>(),
  empty: readonly Pin[] = [],
  listeners = new Set<() => void>();
export function replacePins(planId: string, pins: readonly Pin[]) {
  if (pins.length) perPlan.set(planId, pins);
  else perPlan.delete(planId);
  listeners.forEach((fn) => fn());
}
export function usePins(planId: string) {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => perPlan.get(planId) ?? empty,
    () => empty,
  );
}
