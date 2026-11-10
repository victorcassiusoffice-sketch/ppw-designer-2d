/** Private pilot. Store checked actions, not editable computed totals: restoration replays
 * the same transitions at their original dates, so historic expired files remain readable.
 * One bad event rejects the whole import before it can replace the last good dashboard. */
import { create } from 'zustand';
import { z } from 'zod';
import {
  applyLinkEvent,
  type LinkEvent,
  type LinkPackage,
  type AnswerPack,
  type PackageDraft,
  type Actor,
  type Choice,
} from '../designer/link/exchange';
import type { WorkPackage } from '../designer/link/planView';

export const LINK_STORAGE_KEY = 'olb_link_packages_v1';
const TYPE = 'olb-build-dashboard';
const MAX_BYTES = 4_000_000;
const MAX_EVENTS = 10_000;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const envelope = z
  .object({ type: z.literal(TYPE), v: z.literal(1), events: z.array(z.unknown()).max(MAX_EVENTS) })
  .strict();
const at = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v);
const opaque = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const by = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.enum(['owner', 'engineer', 'contractor']),
  })
  .strict();
const eventShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('draft'), at, draft: z.unknown() }).strict(),
  z.object({ kind: z.literal('send'), at, work: z.unknown() }).strict(),
  z.object({ kind: z.literal('answer'), at, pack: z.unknown() }).strict(),
  z
    .object({
      kind: z.literal('decide'),
      at,
      requestId: opaque,
      answerId: opaque,
      by,
      choice: z.enum(['approved', 'declined', 'accepted', 'rejected']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('pay'),
      at,
      requestId: opaque,
      answerId: opaque,
      by,
      on: z.string(),
      method: z.string(),
      reference: z.string().max(120),
    })
    .strict(),
]);
function checkedEvent(value: unknown): LinkEvent {
  const parsed = eventShape.safeParse(value);
  if (!parsed.success)
    throw new Error('This dashboard contains an invalid action or a newer format.');
  // Raw drafts and signed-file contents are validated by applyLinkEvent before use.
  return parsed.data as LinkEvent;
}
const utf8 = (text: string) => new TextEncoder().encode(text).byteLength;
function serialise(events: LinkEvent[]): string {
  const text = JSON.stringify({ type: TYPE, v: 1, events });
  if (events.length > MAX_EVENTS || utf8(text) > MAX_BYTES)
    throw new Error('This dashboard is too large for the browser pilot. Export a backup.');
  return text;
}
export async function readDashboardBackup(
  text: string,
  now: string,
): Promise<{ events: LinkEvent[]; packages: LinkPackage[] }> {
  if (!at.safeParse(now).success)
    throw new Error('Check the date and time before restoring a backup.');
  if (text.length > MAX_BYTES || utf8(text) > MAX_BYTES)
    throw new Error('This dashboard backup is too large.');
  let raw: unknown;
  try {
    raw = JSON.parse(text, (key, value) => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor')
        throw new Error('Reserved key');
      return value;
    });
  } catch {
    throw new Error('This dashboard backup is not readable. Choose a dashboard JSON file.');
  }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) throw new Error('Choose a One Live Build dashboard backup, version 1.');
  let packages: LinkPackage[] = [];
  const events: LinkEvent[] = [];
  for (let idx = 0; idx < parsed.data.events.length; idx++) {
    try {
      const e = checkedEvent(parsed.data.events[idx]);
      if (e.at > now || (idx > 0 && e.at < events[idx - 1].at))
        throw new Error('Its action dates are out of order or in the future.');
      packages = await applyLinkEvent(packages, e);
      events.push(e);
    } catch (error) {
      throw new Error(
        'Backup action ' +
          (idx + 1) +
          ': ' +
          (error instanceof Error ? error.message : 'Unsupported entry.'),
      );
    }
  }
  return { events, packages };
}
type State = {
  packages: LinkPackage[];
  hydrated: boolean;
  loadError: string | null;
  hydrate: () => Promise<void>;
  saveDraft: (draft: PackageDraft, at?: string) => Promise<void>;
  send: (work: WorkPackage, at?: string) => Promise<void>;
  addAnswer: (pack: AnswerPack, at?: string) => Promise<void>;
  decide: (
    requestId: string,
    answerId: string,
    choice: Choice,
    by: Actor,
    at?: string,
  ) => Promise<void>;
  pay: (
    requestId: string,
    invoiceId: string,
    by: Actor,
    on: string,
    method: string,
    reference: string,
    at?: string,
  ) => Promise<void>;
  backup: () => string;
  restoreBackup: (text: string) => Promise<void>;
};
export function createLinkStore(
  port: () => StoragePort = () => window.localStorage,
  clock: () => string = () => new Date().toISOString(),
) {
  let events: LinkEvent[] = [],
    diskSnapshot: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(action: () => Promise<T>) => {
    const next = queue.then(action);
    queue = next.catch(() => undefined);
    return next;
  };
  return create<State>((set, get) => {
    async function hydrate() {
      if (get().hydrated) return;
      try {
        diskSnapshot = port().getItem(LINK_STORAGE_KEY);
        const restored =
          diskSnapshot === null
            ? { events: [], packages: [] }
            : await readDashboardBackup(diskSnapshot, clock());
        events = restored.events;
        set({ packages: restored.packages, hydrated: true, loadError: null });
      } catch (e) {
        set({
          hydrated: true,
          loadError: e instanceof Error ? e.message : 'Cannot open this browser dashboard.',
        });
      }
    }
    function write(nextEvents: LinkEvent[], packages: LinkPackage[]) {
      const data = serialise(nextEvents);
      const storage = port();
      if (storage.getItem(LINK_STORAGE_KEY) !== diskSnapshot)
        throw new Error('This dashboard changed in another tab. Reload before saving.');
      try {
        storage.setItem(LINK_STORAGE_KEY, data);
      } catch {
        throw new Error(
          'This browser could not save the dashboard. Export a backup or free local storage.',
        );
      }
      diskSnapshot = data;
      events = nextEvents;
      set({ packages, hydrated: true, loadError: null });
    }
    function append(input: LinkEvent) {
      // Own the value immediately; editing form fields while a hash is checked cannot mutate a recorded send.
      const e = checkedEvent(JSON.parse(JSON.stringify(input)));
      return serial(async () => {
        await hydrate();
        if (get().loadError)
          throw new Error(
            'Stored dashboard data could not be loaded. Restore a checked backup before saving.',
          );
        if (events.length && events[events.length - 1].at > e.at)
          throw new Error('This action predates the dashboard history. Check the clock.');
        if (e.at > clock()) throw new Error('This action is in the future. Check the clock.');
        const current = get().packages,
          next = await applyLinkEvent(current, e);
        if (current !== next) write([...events, e], next);
      });
    }
    return {
      packages: [],
      hydrated: false,
      loadError: null,
      hydrate: () => serial(hydrate),
      saveDraft: (draft, at = clock()) => append({ kind: 'draft', draft, at }),
      send: (work, at = clock()) => append({ kind: 'send', work, at }),
      addAnswer: (pack, at = clock()) => append({ kind: 'answer', pack, at }),
      decide: (requestId, answerId, choice, by, at = clock()) =>
        append({ kind: 'decide', requestId, answerId, choice, by, at }),
      pay: (requestId, answerId, by, on, method, reference, at = clock()) =>
        append({ kind: 'pay', requestId, answerId, by, on, method, reference, at }),
      backup: () => {
        if (!get().hydrated || get().loadError)
          throw new Error('Load a valid dashboard before backing it up.');
        return serialise(events);
      },
      restoreBackup: (text) =>
        serial(async () => {
          await hydrate();
          const data = await readDashboardBackup(text, clock());
          write(data.events, data.packages);
        }),
    };
  });
}
export const useLinkStore = createLinkStore();
