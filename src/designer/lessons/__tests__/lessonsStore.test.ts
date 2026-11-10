/**
 * Lessons state: a first pick shows its card once; "No more tips" hides them
 * all; blocked storage still works for the visit.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LESSONS_STORAGE_KEY,
  parseLessons,
  reloadLessonsFromStorage,
  useLessonsStore,
} from '../lessonsStore';

beforeEach(() => {
  localStorage.clear();
  reloadLessonsFromStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  reloadLessonsFromStorage();
});

describe('a first pick shows its card once', () => {
  it('offers a compact tip on the first pick and expands it on request', () => {
    const s = useLessonsStore.getState();
    expect(s.pick('door')).toBe(true);
    expect(useLessonsStore.getState().active).toMatchObject({ id: 'door', tucked: true, forced: false });
    s.untuck();
    expect(useLessonsStore.getState().active).toMatchObject({ id: 'door', tucked: false, forced: true });
    useLessonsStore.getState().gotIt();
    expect(useLessonsStore.getState().active).toBeNull();
    expect(useLessonsStore.getState().pick('door')).toBe(false);
    expect(useLessonsStore.getState().active).toBeNull();
  });

  it('remembers the shown card on the device', () => {
    useLessonsStore.getState().pick('floor');
    const saved = JSON.parse(localStorage.getItem(LESSONS_STORAGE_KEY) ?? '{}');
    expect(saved.seen).toContain('floor');
    reloadLessonsFromStorage();
    expect(useLessonsStore.getState().pick('floor')).toBe(false);
  });

  it('"Show me" shows a seen card again', () => {
    useLessonsStore.getState().pick('measure');
    useLessonsStore.getState().gotIt();
    expect(useLessonsStore.getState().pick('measure', { force: true })).toBe(true);
    expect(useLessonsStore.getState().active).toMatchObject({ id: 'measure', forced: true, tucked: false });
  });

  it('a keyboard-only tool shows no card on a touch screen', () => {
    expect(useLessonsStore.getState().pick('eyedropper', { touch: true })).toBe(false);
    expect(useLessonsStore.getState().pick('eyedropper', { touch: false })).toBe(true);
  });

  it('Got it ticks the lesson as done; a press on the canvas (tuck) does too', () => {
    useLessonsStore.getState().pick('walls');
    useLessonsStore.getState().gotIt();
    useLessonsStore.getState().pick('wallpaint');
    useLessonsStore.getState().untuck();
    useLessonsStore.getState().tuck();
    expect(useLessonsStore.getState().active).toMatchObject({ id: 'wallpaint', tucked: true });
    expect(useLessonsStore.getState().done).toEqual(['walls', 'wallpaint']);
  });
});

describe('"No more tips" hides them all', () => {
  it('stops every later card and is remembered', () => {
    useLessonsStore.getState().pick('select');
    useLessonsStore.getState().noMoreTips();
    expect(useLessonsStore.getState().active).toBeNull();
    for (const id of ['walls', 'door', 'floor', 'furnish', 'view3d'] as const) {
      expect(useLessonsStore.getState().pick(id)).toBe(false);
    }
    reloadLessonsFromStorage();
    expect(useLessonsStore.getState().tipsOff).toBe(true);
    expect(useLessonsStore.getState().pick('garden')).toBe(false);
  });

  it('the Lessons list can still show any card', () => {
    useLessonsStore.getState().noMoreTips();
    expect(useLessonsStore.getState().pick('garden', { force: true })).toBe(true);
  });

  it('"Show every tip again" turns tips back on and forgets what was seen', () => {
    useLessonsStore.getState().pick('door');
    useLessonsStore.getState().noMoreTips();
    useLessonsStore.getState().resetSeen();
    expect(useLessonsStore.getState().pick('door')).toBe(true);
  });
});

describe('blocked storage still works', () => {
  it('runs for the visit when every storage call throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      clear: () => undefined,
    });
    reloadLessonsFromStorage();
    const s = useLessonsStore.getState();
    expect(s.storageOk).toBe(false);
    expect(s.pick('door')).toBe(true);
    useLessonsStore.getState().gotIt();
    // Remembered in memory for the visit.
    expect(useLessonsStore.getState().pick('door')).toBe(false);
    useLessonsStore.getState().setSoundOn(true);
    expect(useLessonsStore.getState().soundOn).toBe(true);
    useLessonsStore.getState().startQuest();
    expect(useLessonsStore.getState().quest.status).toBe('active');
  });

  it('ignores a damaged saved value', () => {
    localStorage.setItem(LESSONS_STORAGE_KEY, '{not json');
    reloadLessonsFromStorage();
    expect(useLessonsStore.getState().seen).toEqual([]);
    expect(parseLessons(JSON.stringify({ seen: ['door', 'nope'], quest: { status: 'odd', ticks: ['room', 'x'] } }))).toMatchObject({
      seen: ['door'],
      quest: { status: 'idle', ticks: ['room'] },
    });
  });
});

describe('sounds are off until switched on', () => {
  it('starts off and remembers the switch', () => {
    expect(useLessonsStore.getState().soundOn).toBe(false);
    useLessonsStore.getState().setSoundOn(true);
    reloadLessonsFromStorage();
    expect(useLessonsStore.getState().soundOn).toBe(true);
  });
});

describe('the quest store', () => {
  it('ticks only while active, keeps ticks, and ends at seven', () => {
    const s = useLessonsStore.getState();
    expect(s.tickQuest(['room'])).toEqual([]);
    s.startQuest();
    expect(useLessonsStore.getState().tickQuest(['room', 'paint'])).toEqual(['room', 'paint']);
    expect(useLessonsStore.getState().tickQuest(['room'])).toEqual([]);
    expect(useLessonsStore.getState().quest.ticks).toEqual(['room', 'paint']);
    useLessonsStore.getState().tickQuest(['openings', 'floor', 'products', 'view3d', 'walk']);
    expect(useLessonsStore.getState().quest.status).toBe('done');
  });

  it('skip and decline are remembered; start again after done begins fresh', () => {
    useLessonsStore.getState().declineQuest();
    reloadLessonsFromStorage();
    expect(useLessonsStore.getState().quest.status).toBe('declined');
    useLessonsStore.getState().startQuest();
    useLessonsStore.getState().skipQuest();
    expect(useLessonsStore.getState().quest.status).toBe('skipped');
    useLessonsStore.getState().startQuest();
    useLessonsStore.getState().tickQuest(['room', 'openings', 'paint', 'floor', 'products', 'view3d', 'walk']);
    useLessonsStore.getState().startQuest();
    expect(useLessonsStore.getState().quest).toMatchObject({ status: 'active', ticks: [] });
  });
});
