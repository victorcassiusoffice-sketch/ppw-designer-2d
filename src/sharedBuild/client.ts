import { usePropertyStore, normaliseLoadedProperty, type Property } from '../store/propertyStore';
import { DRAFT_ID, useDesignsStore } from '../store/designsStore';
import { createPage, currentPageId, switchToPage } from '../lib/pages';
import { isDrawTransactionActive, applySharedSnapshot } from '../store/historyStore';
import {
  applyChanges,
  buildChanges,
  sharedProperty,
  type Build,
  type Change,
  type Player,
  type Pose,
} from './contract';

const key = 'olb-live-build-v1';
interface Credentials {
  roomId: string;
  actorId: string;
  session: string;
  page: string;
  avatar: string;
  trade: string;
}
interface State {
  revision: number;
  model?: Build;
  players: Player[];
}
interface Admission extends State {
  roomId: string;
  actorId: string;
  session: string;
  invite?: string;
}
interface Pending {
  id: string;
  revision: number;
  changes: Change[];
  submitted: Build;
}
interface View {
  joined: boolean;
  busy: boolean;
  message: string;
  players: Player[];
  invite?: string;
  conflict: boolean;
  avatar?: string;
  actorId?: string;
}
let view: View = { joined: false, busy: false, message: '', players: [], conflict: false };
let session: Credentials | null = null,
  base: Build | null = null,
  revision = 0,
  pose: Pose | null = null,
  pending: Pending | null = null;
let deferred: { state: State; reference: Build } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined,
  epoch = 0,
  conflict: State | null = null;
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const snapshot = () => view;
function publish(patch: Partial<View>) {
  view = { ...view, ...patch };
  for (const cb of listeners) cb();
}
function save() {
  try {
    if (session && base)
      sessionStorage.setItem(key, JSON.stringify({ session, base, revision, pending }));
    else sessionStorage.removeItem(key);
  } catch {
    /* The active tab can continue without reload recovery. */
  }
}
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api<T>(path: string, body: unknown, sessionKey?: string): Promise<T> {
  const res = await fetch('/api/shared-projects/live/' + path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionKey ? { Authorization: 'Bearer ' + sessionKey } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError(result.error || 'Shared build request failed.', res.status);
  return result as T;
}
function local() {
  return sharedProperty(usePropertyStore.getState().property);
}
function install(model: Build, remoteChanges: Change[]) {
  const localProperty = usePropertyStore.getState().property;
  const property = normaliseLoadedProperty({
    ...model,
    activeRoomId: localProperty.activeRoomId,
    activeLevelId: localProperty.activeLevelId,
  } as unknown as Property);
  applySharedSnapshot(property, (old) => {
    try {
      const next = applyChanges(sharedProperty(old), remoteChanges);
      return normaliseLoadedProperty({
        ...next,
        activeRoomId: old.activeRoomId,
        activeLevelId: old.activeLevelId,
      } as unknown as Property);
    } catch {
      return null;
    }
  });
}
function peers(players: Player[]) {
  const others = players.filter((p) => p.id !== session?.actorId);
  publish({ players: others });
  window.dispatchEvent(new CustomEvent('olb:live-peers', { detail: others }));
}
function accept(state: State, reference: Build) {
  if (!session || currentPageId() !== session.page) return;
  if (isDrawTransactionActive()) {
    deferred = { state, reference };
    return;
  }
  peers(state.players);
  if (!state.model) {
    revision = state.revision;
    return;
  }
  const model = sharedProperty(state.model),
    mine = local(),
    later = buildChanges(reference, mine);
  let merged: Build;
  try {
    merged = applyChanges(model, later);
  } catch {
    conflict = { ...state, model };
    publish({
      conflict: true,
      message: 'Another player edited the same part. Choose which change to keep.',
    });
    return;
  }
  const remoteChanges = buildChanges(mine, merged);
  if (remoteChanges.length) install(merged, remoteChanges);
  base = model;
  revision = state.revision;
  save();
}
let activeTick: Promise<void> | null = null;
function schedule(ms: number, current: number) {
  if (timer) clearTimeout(timer);
  if (current === epoch && session)
    timer = setTimeout(() => {
      activeTick = tick(current).finally(() => {
        activeTick = null;
      });
    }, ms);
}
async function tick(current: number) {
  if (current !== epoch || !session || !base) return;
  if (currentPageId() !== session.page) {
    const secret = session.session;
    clear();
    void api('leave', {}, secret).catch(() => {});
    return;
  }
  if (isDrawTransactionActive()) {
    schedule(200, current);
    return;
  }
  if (deferred) {
    const d = deferred;
    deferred = null;
    accept(d.state, d.reference);
  }
  const auth = session.session;
  let delay = document.hidden ? 3000 : 550;
  try {
    if (!conflict && !pending) {
      const submitted = local(),
        changes = buildChanges(base, submitted);
      if (changes.length) {
        pending = { id: crypto.randomUUID(), revision, changes, submitted };
        save();
      }
    }
    if (pending && !conflict) {
      const item = pending;
      try {
        const state = await api<State>(
          'edit',
          { requestId: item.id, revision: item.revision, changes: item.changes },
          auth,
        );
        if (current !== epoch) return;
        pending = null;
        accept(state, item.submitted);
      } catch (e) {
        if (!(e instanceof RequestError) || e.status !== 409) throw e;
        const state = await api<State>('sync', { revision: 0, pose }, auth);
        if (current !== epoch) return;
        pending = null;
        accept(state, base);
      }
    } else {
      const result = await api<State>('sync', { revision: conflict ? 0 : revision, pose }, auth);
      if (current !== epoch) return;
      if (conflict) {
        conflict = result;
        peers(result.players);
      } else accept(result, base);
    }
    if (!conflict) publish({ message: 'Connected', conflict: false });
  } catch (e) {
    if (current !== epoch) return;
    const expired = e instanceof RequestError && e.status === 401;
    publish({
      message: expired
        ? 'Session expired. Keep this local copy and join again.'
        : e instanceof Error
          ? e.message
          : 'Connection interrupted. Retrying.',
    });
    if (expired) {
      clear();
      return;
    }
    delay = 2500;
  } finally {
    schedule(delay, current);
  }
}
function clear() {
  epoch++;
  if (timer) clearTimeout(timer);
  session = null;
  base = null;
  pending = null;
  deferred = null;
  pose = null;
  conflict = null;
  save();
  peers([]);
  publish({
    joined: false,
    busy: false,
    conflict: false,
    invite: undefined,
    avatar: undefined,
    actorId: undefined,
  });
}
export async function joinOrHost(
  action: 'join' | 'host',
  profile: { avatar: string; trade: string },
  code = '',
) {
  if (view.busy || session) return;
  publish({ busy: true, message: '' });
  try {
    const response = await api<Admission>(
      action,
      action === 'join' ? { ...profile, code: code.trim() } : { ...profile, model: local() },
    );
    if (!response.model) throw Error('The shared build did not load.');
    const model = sharedProperty(response.model);
    if (action === 'join') {
      createPage('Shared build');
      install(model, []);
    }
    session = {
      roomId: response.roomId,
      actorId: response.actorId,
      session: response.session,
      page: currentPageId(),
      ...profile,
    };
    base = model;
    revision = response.revision;
    localStorage.setItem('olb-world-character-v1', profile.avatar);
    save();
    window.dispatchEvent(new CustomEvent('olb:live-avatar', { detail: profile.avatar }));
    publish({
      joined: true,
      invite: response.invite,
      avatar: profile.avatar,
      actorId: response.actorId,
      message: 'Connected',
    });
    peers(response.players);
    schedule(0, ++epoch);
  } catch (e) {
    publish({ message: e instanceof Error ? e.message : 'Could not connect.' });
  } finally {
    publish({ busy: false });
  }
}
export async function leave(keepLocal = false) {
  if (!session || view.busy) return;
  const current = epoch,
    secret = session.session;
  publish({ busy: true });
  try {
    if (!keepLocal) {
      if (timer) clearTimeout(timer);
      if (activeTick) await activeTick;
      if (current !== epoch || !session) return;
      if (timer) clearTimeout(timer);
      if (isDrawTransactionActive()) {
        publish({ message: 'Finish the active edit before leaving.' });
        schedule(200, current);
        return;
      }
      if (!conflict && base && (pending || buildChanges(base, local()).length)) await tick(current);
      if (current !== epoch || !session) return;
      if (conflict || pending || (base && buildChanges(base, local()).length)) {
        publish({
          message:
            'Changes are still local. Resolve the conflict, reconnect, or leave with a local copy.',
        });
        schedule(550, current);
        return;
      }
    }
    clear();
    publish({ message: 'Left shared build. Your design is saved on this device.' });
    await api('leave', {}, secret).catch(() => {});
  } finally {
    publish({ busy: false });
  }
}
export function resolveOverlap(keepMine: boolean) {
  if (!conflict?.model || !base) return;
  const server = sharedProperty(conflict.model),
    mine = local();
  let merged = server;
  for (const change of buildChanges(base, mine)) {
    try {
      merged = applyChanges(merged, [change]);
    } catch {
      if (keepMine) {
        // Reapply only this explicit choice against the latest version of its field.
        const current = readField(merged, change.path);
        try {
          merged = applyChanges(merged, [
            { ...change, had: current !== undefined, before: current ?? null },
          ]);
        } catch {
          publish({
            message: 'The target was removed. Keep a local copy or accept the team edit.',
          });
          return;
        }
      }
    }
  }
  install(merged, buildChanges(mine, merged));
  base = server;
  revision = conflict.revision;
  conflict = null;
  pending = null;
  publish({ conflict: false, message: 'Connected' });
  save();
}
function readField(model: Build, path: Change['path']) {
  let value: import('./contract').Json | undefined = model;
  for (const p of path) {
    if (typeof p === 'string' && value && typeof value === 'object' && !Array.isArray(value))
      value = value[p];
    else if (typeof p !== 'string' && Array.isArray(value))
      value = value.find((v) => v && typeof v === 'object' && !Array.isArray(v) && v.id === p.id);
    else return undefined;
  }
  return value;
}
// An intentional plan switch leaves this room immediately. A reloaded tab
// can then distinguish a genuine switch from another tab saving its own page.
useDesignsStore.subscribe(state => {
  if (!session || (state.currentId ?? DRAFT_ID) === session.page) return;
  const secret = session.session;
  clear();
  void api('leave', {}, secret).catch(() => {});
});
window.addEventListener('olb:local-pose', (event) => {
  pose = (event as CustomEvent<Pose | null>).detail;
});
window.addEventListener('olb:request-peers', () => {
  window.dispatchEvent(new CustomEvent('olb:live-peers', { detail: view.players }));
});
export function resume() {
  if (session) return;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data.session?.session || !data.session.page || !data.base) return;
    const restored = sharedProperty(data.base);
    // Tabs have independent room credentials but the device's last-opened
    // plan is shared. Restore only this invitation's saved working copy.
    if (data.session.page !== currentPageId() || usePropertyStore.getState().property.id !== restored.id) {
      if (data.session.page === currentPageId() || !switchToPage(data.session.page))
        data.session.page = createPage('Shared build');
      install(data.pending ? sharedProperty(data.pending.submitted) : restored, []);
    }
    base = restored;
    session = data.session;
    revision = data.revision;
    pending = data.pending ?? null;
    save();
    publish({
      joined: true,
      avatar: session!.avatar,
      actorId: session!.actorId,
      message: 'Reconnecting…',
    });
    schedule(0, ++epoch);
  } catch {
    clear();
  }
}
