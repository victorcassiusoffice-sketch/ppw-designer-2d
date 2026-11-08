/**
 * Lessons state: which tips were shown, which lessons are done, tips on or
 * off, sounds on or off, the first-build quest, and the card on screen.
 *
 * Remembered per device under one localStorage key, read and written inside
 * try/catch. When storage is blocked (private window, a locked-down browser)
 * everything still works for the visit; `storageOk` turns false so the
 * Lessons list can say ticks will not be kept.
 */
import { create } from 'zustand';
import { LESSON_IDS, LESSONS, type LessonId } from './lessonData';
import { QUEST_STEPS, type QuestStepId } from './quest';

export const LESSONS_STORAGE_KEY = 'olb.lessons.v1';

export type QuestStatus = 'idle' | 'declined' | 'active' | 'skipped' | 'done';

export interface QuestState {
  status: QuestStatus;
  /** Steps ticked from the real design. Sticky: a tick stays once earned. */
  ticks: QuestStepId[];
  /** The panel folded to its chip. */
  minimized: boolean;
  /** Steps that need the app's state, not the design: seen in 3D, walked. */
  saw3d: boolean;
  walked: boolean;
}

export interface ActiveCard {
  id: LessonId;
  /** Folded to a chip after a press on the canvas. */
  tucked: boolean;
  /** Opened from the Lessons list or the quest: shown even if seen before. */
  forced: boolean;
  /** Bumps on every open so a re-open of the same lesson re-measures. */
  nonce: number;
}

interface Persisted {
  seen: LessonId[];
  done: LessonId[];
  tipsOff: boolean;
  soundOn: boolean;
  quest: QuestState;
  tipIndex: number;
}

export interface LessonsState extends Persisted {
  storageOk: boolean;
  active: ActiveCard | null;
  /** The last line read to screen readers (polite). */
  announcement: { text: string; nonce: number } | null;
  announce: (text: string) => void;
  /** The quest offer folded to a chip for this visit (a press on the canvas). */
  offerTucked: boolean;
  setOfferTucked: (tucked: boolean) => void;
  /** A pick of a lesson: shows its card the first time, unless tips are off. */
  pick: (id: LessonId, options?: { force?: boolean; touch?: boolean }) => boolean;
  gotIt: () => void;
  noMoreTips: () => void;
  setTipsOff: (off: boolean) => void;
  setSoundOn: (on: boolean) => void;
  tuck: () => void;
  untuck: () => void;
  close: () => void;
  markDone: (id: LessonId) => void;
  resetSeen: () => void;
  startQuest: () => void;
  declineQuest: () => void;
  skipQuest: () => void;
  setQuestMinimized: (minimized: boolean) => void;
  /** Ticks the given steps; returns the ones that were new. */
  tickQuest: (steps: QuestStepId[]) => QuestStepId[];
  noteQuestView: (patch: Partial<Pick<QuestState, 'saw3d' | 'walked'>>) => void;
  nextTipIndex: () => number;
}

const INITIAL_QUEST: QuestState = { status: 'idle', ticks: [], minimized: false, saw3d: false, walked: false };

const INITIAL: Persisted = {
  seen: [],
  done: [],
  tipsOff: false,
  soundOn: false,
  quest: INITIAL_QUEST,
  tipIndex: 0,
};

const isLessonId = (value: unknown): value is LessonId =>
  typeof value === 'string' && (LESSON_IDS as readonly string[]).includes(value);
const isStepId = (value: unknown): value is QuestStepId =>
  typeof value === 'string' && (QUEST_STEPS as readonly string[]).includes(value);
const QUEST_STATUSES: readonly QuestStatus[] = ['idle', 'declined', 'active', 'skipped', 'done'];

/** Parse what the device kept; anything unexpected falls back to the default. */
export function parseLessons(raw: string | null): Persisted {
  if (!raw) return { ...INITIAL, quest: { ...INITIAL_QUEST } };
  try {
    const data = JSON.parse(raw) as Partial<Persisted> & { quest?: Partial<QuestState> };
    const quest: Partial<QuestState> = data.quest ?? {};
    return {
      seen: Array.isArray(data.seen) ? data.seen.filter(isLessonId) : [],
      done: Array.isArray(data.done) ? data.done.filter(isLessonId) : [],
      tipsOff: data.tipsOff === true,
      soundOn: data.soundOn === true,
      quest: {
        status: QUEST_STATUSES.includes(quest.status as QuestStatus) ? (quest.status as QuestStatus) : 'idle',
        ticks: Array.isArray(quest.ticks) ? quest.ticks.filter(isStepId) : [],
        minimized: quest.minimized === true,
        saw3d: quest.saw3d === true,
        walked: quest.walked === true,
      },
      tipIndex: Number.isInteger(data.tipIndex) && (data.tipIndex as number) >= 0 ? (data.tipIndex as number) : 0,
    };
  } catch {
    return { ...INITIAL, quest: { ...INITIAL_QUEST } };
  }
}

function readStored(): { value: Persisted; ok: boolean } {
  try {
    if (typeof localStorage === 'undefined') return { value: parseLessons(null), ok: false };
    return { value: parseLessons(localStorage.getItem(LESSONS_STORAGE_KEY)), ok: true };
  } catch {
    return { value: parseLessons(null), ok: false };
  }
}

function writeStored(value: Persisted): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(LESSONS_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let nonce = 0;

export const useLessonsStore = create<LessonsState>((set, get) => {
  const stored = readStored();
  const save = (patch: Partial<Persisted>) => {
    set(patch);
    const s = get();
    const ok = writeStored({
      seen: s.seen,
      done: s.done,
      tipsOff: s.tipsOff,
      soundOn: s.soundOn,
      quest: s.quest,
      tipIndex: s.tipIndex,
    });
    if (ok !== s.storageOk) set({ storageOk: ok });
  };
  return {
    ...stored.value,
    storageOk: stored.ok,
    active: null,
    offerTucked: false,
    setOfferTucked: (tucked) => set({ offerTucked: tucked }),
    announcement: null,
    announce: (text) => {
      nonce += 1;
      set({ announcement: { text, nonce } });
    },

    pick: (id, options = {}) => {
      const s = get();
      const lesson = LESSONS[id];
      if (!options.force) {
        if (s.tipsOff || s.seen.includes(id)) return false;
        if (lesson.keyboardOnly && options.touch) return false;
      }
      nonce += 1;
      set({ active: { id, tucked: false, forced: !!options.force, nonce } });
      if (!s.seen.includes(id)) save({ seen: [...s.seen, id] });
      return true;
    },
    gotIt: () => {
      const s = get();
      if (!s.active) return;
      const id = s.active.id;
      set({ active: null });
      if (!s.done.includes(id)) save({ done: [...s.done, id] });
    },
    noMoreTips: () => {
      set({ active: null });
      save({ tipsOff: true });
    },
    setTipsOff: (off) => save({ tipsOff: off }),
    setSoundOn: (on) => save({ soundOn: on }),
    tuck: () => {
      const s = get();
      if (!s.active || s.active.tucked) return;
      set({ active: { ...s.active, tucked: true } });
      // Pressing on the canvas with the tool in hand is using it.
      if (!s.done.includes(s.active.id)) save({ done: [...s.done, s.active.id] });
    },
    untuck: () => {
      const s = get();
      if (s.active?.tucked) set({ active: { ...s.active, tucked: false } });
    },
    close: () => set({ active: null }),
    markDone: (id) => {
      const s = get();
      if (!s.done.includes(id)) save({ done: [...s.done, id] });
    },
    resetSeen: () => save({ seen: [], tipsOff: false }),

    startQuest: () => {
      const s = get();
      const fresh = s.quest.status === 'done';
      save({
        quest: fresh
          ? { ...INITIAL_QUEST, status: 'active' }
          : { ...s.quest, status: 'active', minimized: false },
      });
    },
    declineQuest: () => save({ quest: { ...get().quest, status: 'declined' } }),
    skipQuest: () => save({ quest: { ...get().quest, status: 'skipped' } }),
    setQuestMinimized: (minimized) => {
      const quest = get().quest;
      if (quest.minimized !== minimized) save({ quest: { ...quest, minimized } });
    },
    tickQuest: (steps) => {
      const quest = get().quest;
      if (quest.status !== 'active') return [];
      const fresh = steps.filter((step) => !quest.ticks.includes(step));
      if (!fresh.length) return [];
      const ticks = QUEST_STEPS.filter((step) => quest.ticks.includes(step) || fresh.includes(step));
      save({ quest: { ...quest, ticks, status: ticks.length === QUEST_STEPS.length ? 'done' : 'active' } });
      return fresh;
    },
    noteQuestView: (patch) => {
      const quest = get().quest;
      const next = { ...quest, ...patch };
      if (next.saw3d !== quest.saw3d || next.walked !== quest.walked) save({ quest: next });
    },
    nextTipIndex: () => {
      const index = get().tipIndex;
      save({ tipIndex: index + 1 });
      return index;
    },
  };
});

/** Re-read the device (tests, and a second tab that changed it). */
export function reloadLessonsFromStorage(): void {
  const stored = readStored();
  useLessonsStore.setState({ ...stored.value, storageOk: stored.ok, active: null });
}
