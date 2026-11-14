import { create } from 'zustand';
import { z } from 'zod';
import { pilotSchema, type Pilot, type Photo } from './contract';
import { kindsToCollection, type ItemKind } from './sharedContract';

export const isShared = (slug?: string) =>
  !!slug && /^shared-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug);
const parsed = z.object({
  pilot: pilotSchema,
  owner: z.boolean(),
  revision: z.number().int().positive(),
  memberId: z.string(),
  role: z.string(),
  editable: z.string().array(),
});
type Doc = z.infer<typeof parsed>;
type State = {
  slug: string;
  doc?: Doc;
  busy: boolean;
  message: string;
  denied: boolean;
  offline: boolean;
};
const fresh = { slug: '', busy: false, message: '', denied: false, offline: false };
export const useRemote = create<State>(() => fresh);
export function permissions(p: Pilot) {
  const d = useRemote.getState().doc;
  return isShared(p.slug)
    ? {
        owner: d?.pilot.slug === p.slug && d.owner,
        write: d?.pilot.slug === p.slug && d.role !== 'viewer',
        by: d?.memberId,
      }
    : { owner: true, write: true, by: undefined };
}
class ReplyError extends Error {
  constructor(
    readonly status: number,
    msg: string,
  ) {
    super(msg);
  }
}
export async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await fetch('/api/pilots' + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(data === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  });
  if (!res.ok) {
    const message =
      res.status === 403
        ? 'Ask the owner for your link.'
        : res.status === 409
          ? 'Someone updated this pilot. Review the latest record and try again.'
          : res.status === 429
            ? 'Too many attempts. Try again later.'
            : res.status === 400
              ? 'Check the fields and try again.'
              : 'Shared pilot storage is unavailable. Try again.';
    throw new ReplyError(res.status, message);
  }
  return res.json();
}
let epoch = 0;
export function closeShared() {
  epoch++;
  useRemote.setState({ ...fresh, doc: undefined });
}
export async function refresh(slug: string) {
  const e = epoch;
  const data = parsed.parse(await request('/' + slug));
  if (e === epoch && useRemote.getState().slug === slug) {
    const current = useRemote.getState().doc;
    if (!current || data.revision > current.revision)
      useRemote.setState({ doc: data, denied: false, offline: false });
    else if (useRemote.getState().offline) useRemote.setState({ offline: false, message: '' });
  }
  return data;
}
function fail(err: unknown) {
  const denied = err instanceof ReplyError && err.status === 403;
  useRemote.setState({
    message: err instanceof Error ? err.message : 'Could not save.',
    denied,
    offline: !denied,
    ...(denied ? { doc: undefined } : {}),
  });
}
const joins = new Map<string, Promise<unknown>>();
export function enterShared(slug: string) {
  closeShared();
  const e = epoch;
  useRemote.setState({ slug });
  const hash = location.hash.slice(1),
    invite = new URLSearchParams(hash).get('join');
  let joining = joins.get(slug);
  if (invite !== null) {
    history.replaceState(null, '', location.pathname + location.search);
    joining = request('/' + slug + '/join', 'POST', { invite });
    joins.set(slug, joining);
    void joining.finally(() => joins.delete(slug)).catch(() => {});
  }
  const load = async () => {
    try {
      if (joining) await joining;
      if (epoch === e) await refresh(slug);
    } catch (err) {
      if (epoch === e) fail(err);
    }
  };
  void load();
  const timer = window.setInterval(() => {
    if (
      document.visibilityState === 'visible' &&
      !useRemote.getState().busy &&
      !useRemote.getState().denied
    )
      void refresh(slug).catch((err) => {
        if (epoch === e) fail(err);
      });
  }, 6000);
  return () => {
    clearInterval(timer);
    closeShared();
  };
}
async function save<T>(slug: string, job: (d: Doc) => Promise<T>) {
  const s = useRemote.getState();
  if (!s.doc || s.slug !== slug || s.busy) {
    useRemote.setState({ message: 'Wait for the current save, then try again.' });
    throw Error('Wait for the current save.');
  }
  const e = epoch;
  useRemote.setState({ busy: true, message: 'Saving…' });
  try {
    const result = await job(s.doc);
    if (e === epoch) {
      await refresh(slug);
      if (epoch === e) useRemote.setState({ message: 'Saved.', offline: false });
    }
    return result;
  } catch (err) {
    if (e === epoch) {
      try {
        await refresh(slug);
      } catch {
        /* original failure is actionable */
      }
      if (e === epoch) fail(err);
    }
    throw err;
  } finally {
    if (e === epoch) useRemote.setState({ busy: false });
  }
}
type Item = { id?: string; site?: string };
const key = (x: Item) => x.id ?? 'cam-' + x.site;
export function editShared(slug: string, change: (p: Pilot) => void) {
  const current = useRemote.getState().doc;
  if (!current) return false;
  const next = structuredClone(current.pilot);
  change(next);
  pilotSchema.parse(next);
  return save(slug, async (d) => {
    if (d.revision !== current.revision) throw Error('The pilot changed. Try again.');
    const before = d.pilot;
    if (next.name !== before.name || next.state !== before.state || next.summary !== before.summary)
      return request('/' + slug, 'PUT', {
        name: next.name,
        state: next.state,
        summary: next.summary,
        revision: d.revision,
      });
    for (const [kind, col] of Object.entries(kindsToCollection)) {
      const a = before[col as (typeof kindsToCollection)[ItemKind]] as Item[],
        b = next[col as (typeof kindsToCollection)[ItemKind]] as Item[];
      const old = new Map(a.map((x) => [key(x), x])),
        after = new Map(b.map((x) => [key(x), x]));
      for (const item of b) {
        const id = key(item),
          prior = old.get(id);
        if (JSON.stringify(prior) !== JSON.stringify(item))
          return request(
            '/' + slug + '/items' + (prior ? '/' + id : ''),
            prior ? 'PATCH' : 'POST',
            { revision: d.revision, id, kind, payload: item },
          );
      }
      for (const item of a) {
        const id = key(item);
        if (!after.has(id))
          return request('/' + slug + '/items/' + id, 'PATCH', {
            revision: d.revision,
            id,
            kind,
            payload: item,
            hidden: true,
          });
      }
    }
  })
    .then(() => true)
    .catch(() => false);
}
export async function uploadShared(slug: string, entries: [Photo, Blob][]) {
  for (const [photo, jpeg] of entries) {
    const data = await new Promise<string>((res, rej) => {
      const f = new FileReader();
      f.onload = () => res(String(f.result).split(',')[1]);
      f.onerror = () => rej(Error('Could not open the picture.'));
      f.readAsDataURL(jpeg);
    });
    await save(slug, (d) =>
      request('/' + slug + '/photos', 'POST', {
        revision: d.revision,
        photo,
        mime: jpeg.type,
        data,
      }),
    );
  }
}
export function inviteMember(
  slug: string,
  value: { role: string; name: string; organisation: string },
) {
  return save(slug, (d) =>
    request<{ join: string }>('/' + slug + '/members', 'POST', { ...value, revision: d.revision }),
  );
}
