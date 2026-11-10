/**
 * The lessons layer (One Live Build game programme, part 2, 8 Nov 2026).
 * Loaded after the first picture by `LessonsBoot`, so the first picture is
 * never slower. Everything here listens: to the stores for tool and mode
 * changes, and to the page for the few tools whose state lives in a
 * component (the 3D House tools, the Room box, the catalogue, Walk).
 *
 * One system: the tool cards, the Lessons list, the first-build quest, the
 * tooltips, the build feedback and the loading tips all read lessonData.ts.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './lessons.css';
import { useDesignerUIStore } from '../../store/designerUIStore';
import { useDrawProgressStore } from '../../store/drawProgressStore';
import { usePropertyStore } from '../../store/propertyStore';
import { useGardenEditorStore } from '../../store/gardenEditorStore';
import { HOUSE_TOOL_LESSON, MODE_LESSON, TOOL_LESSON, type HouseTool, type LessonId } from './lessonData';
import { useLessonsStore } from './lessonsStore';
import { LessonCard } from './LessonCard';
import { QuestHost } from './QuestHost';
import { ToolTips } from './ToolTips';
import { BuildFeedback } from './BuildFeedback';
import { LoadingTips } from './LoadingTips';
import { coarsePointer, isStageTarget } from './dom';
import { lastPointerWasTouch, notePointerKind } from './pointerKind';
import { lessonActive } from './openLesson';
import { LESSONS } from './lessonData';
import { lessonText } from '../../i18n/lessonMessages';
import { useAppPreferences } from '../../i18n/AppPreferences';

const touchNow = () => lastPointerWasTouch() ?? coarsePointer();
const pick = (id: LessonId) => useLessonsStore.getState().pick(id, { touch: touchNow() });

/** States read from the page, compared between checks to see a rising edge. */
interface PageFacts {
  roomBox: boolean;
  houseWalls: boolean;
  houseRoom: boolean;
  houseTool: string;
  catalog: boolean;
  walkOpen: boolean;
  walking: boolean;
  picture3d: boolean;
}

function readPage(): PageFacts {
  const q = (selector: string) => !!document.querySelector(selector);
  return {
    roomBox: q('[aria-controls="ppw-pop-size"][aria-expanded="true"]'),
    houseWalls: q('[data-testid="house-draw-walls"][aria-pressed="true"]'),
    houseRoom: q('[data-testid="house-draw-room"][aria-pressed="true"]'),
    houseTool: document.querySelector('.house-opening-tools')?.getAttribute('data-active-tool') ?? '',
    catalog: q('[data-testid="sims-dock"][data-catalog-open="true"], [data-testid="sims-bottom-toolbar"][data-catalog-open="true"]'),
    walkOpen: q('[data-testid="world-walk"]'),
    walking: q('[data-testid="world-walk"][data-status]'),
    picture3d: q('[data-first-picture-ms]'),
  };
}

function usePickWatcher(): void {
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    unsubs.push(
      useDesignerUIStore.subscribe((s, prev) => {
        if (s.tool !== prev.tool && s.tool !== 'hand') pick(TOOL_LESSON[s.tool]);
        if (s.viewMode !== prev.viewMode && s.viewMode === '3d') pick('view3d');
      }),
    );
    unsubs.push(
      useDrawProgressStore.subscribe((s, prev) => {
        if (s.enabled && !prev.enabled) pick(MODE_LESSON.wall);
      }),
    );
    unsubs.push(
      usePropertyStore.subscribe((s, prev) => {
        if (s.selectedInstanceId && !prev.selectedInstanceId) pick(MODE_LESSON.inspect);
      }),
    );
    unsubs.push(
      useGardenEditorStore.subscribe((s, prev) => {
        if (s.panelOpen && !prev.panelOpen) pick('garden');
      }),
    );

    // The Select buttons and its key: Select is where every tool returns,
    // so only a person choosing it counts, never a tool being put away.
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-testid^="select-tool-toggle"], .house-quick-tools [aria-label="Select and move objects"]')) pick('select');
    };
    const key = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (event.key === 'h' || event.key === 'H') pick('select');
    };
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key);

    // Tools whose state lives inside a component: read the page.
    let facts = readPage();
    let frame = 0;
    const check = () => {
      frame = 0;
      const next = readPage();
      if (next.roomBox && !facts.roomBox) pick('room');
      if (next.houseWalls && !facts.houseWalls) pick(HOUSE_TOOL_LESSON.wall);
      if (next.houseRoom && !facts.houseRoom) pick(HOUSE_TOOL_LESSON.room);
      // The House Studio switches its Select tool on by itself when it opens:
      // that is not a pick (it would push the 3D House card off the screen).
      // A person choosing Select is caught by the click listener above.
      if (next.houseTool && next.houseTool !== facts.houseTool && next.houseTool !== 'select' && next.houseTool in HOUSE_TOOL_LESSON) {
        pick(HOUSE_TOOL_LESSON[next.houseTool as HouseTool]);
      }
      if (next.catalog && !facts.catalog) pick(MODE_LESSON.buy);
      // Walk teaches itself on its own chooser (lane A); a card would sit
      // under the walk screen, so any card closes as the walk opens.
      if (next.walkOpen && !facts.walkOpen) useLessonsStore.getState().close();
      // Quest facts the design cannot show: the 3D picture drawn, a walk started.
      const store = useLessonsStore.getState();
      if (store.quest.status === 'active') {
        if (next.picture3d && useDesignerUIStore.getState().viewMode === '3d' && !store.quest.saw3d) store.noteQuestView({ saw3d: true });
        if (next.walking && !store.quest.walked) store.noteQuestView({ walked: true });
      }
      facts = next;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-pressed', 'aria-expanded', 'data-active-tool', 'data-catalog-open', 'data-status', 'data-first-picture-ms'],
    });
    unsubs.push(useDesignerUIStore.subscribe(schedule));

    return () => {
      for (const u of unsubs) u();
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

/**
 * A press on the canvas belongs to the canvas: the card folds to a chip, the
 * quest folds to its chip, and while the press is held no lesson surface
 * takes pointer events (a drag that crosses a card still draws).
 */
function usePressThrough(): void {
  useEffect(() => {
    const root = document.documentElement;
    const down = (event: PointerEvent) => {
      notePointerKind(event.pointerType);
      if (!isStageTarget(event.target)) return;
      root.setAttribute('data-lessons-pressing', '');
      const s = useLessonsStore.getState();
      if (s.active?.tucked && !s.active.forced) s.gotIt();
      else if (s.active && !s.active.tucked) s.tuck();
      if (s.quest.status === 'active' && !s.quest.minimized) s.setQuestMinimized(true);
      if (s.quest.status === 'idle' && !s.offerTucked) s.setOfferTucked(true);
    };
    const up = () => root.removeAttribute('data-lessons-pressing');
    document.addEventListener('pointerdown', down, { capture: true, passive: true });
    document.addEventListener('pointerup', up, { capture: true, passive: true });
    document.addEventListener('pointercancel', up, { capture: true, passive: true });
    window.addEventListener('blur', up);
    return () => {
      up();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', up);
    };
  }, []);
}

/** Esc closes the card (the key still reaches the tool, which puts itself away). */
function useEscape(): void {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const s = useLessonsStore.getState();
      if (s.active) s.gotIt();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
}

/** A card closes when its tool is put away (it was in hand, now it is not). */
function useCloseWhenPutAway(): void {
  const active = useLessonsStore((s) => s.active);
  useEffect(() => {
    if (!active) return undefined;
    let wasActive = lessonActive(active.id);
    const timer = window.setInterval(() => {
      const now = lessonActive(active.id);
      if (wasActive && !now) {
        const s = useLessonsStore.getState();
        if (s.active?.nonce === active.nonce) s.close();
      }
      wasActive = wasActive || now;
    }, 250);
    return () => window.clearInterval(timer);
  }, [active]);
}

/** Screen readers hear each card once (a polite live region). */
function useAnnounceCards(): void {
  const active = useLessonsStore((s) => s.active);
  const { locale } = useAppPreferences();
  useEffect(() => {
    if (!active || active.tucked) return;
    const lesson = LESSONS[active.id];
    const touch = touchNow();
    const parts = [
      lessonText(locale, lesson.name),
      lessonText(locale, lesson.line),
      ...lesson.steps.map((step) => lessonText(locale, touch && step.touch ? step.touch : step.text)),
    ];
    if (lesson.keys) parts.push(`${lessonText(locale, 'lesson.ui.key')}: ${lessonText(locale, lesson.keys)}`);
    useLessonsStore.getState().announce(parts.join('. '));
    // Read the instructions when the user opens the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.nonce, active?.tucked, locale]);
}

function LiveRegion(): JSX.Element {
  const announcement = useLessonsStore((s) => s.announcement);
  return createPortal(
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-lessons-live>
      {announcement ? <span key={announcement.nonce}>{announcement.text}</span> : null}
    </div>,
    document.body,
  );
}

export default function LessonsLayer(): JSX.Element {
  usePickWatcher();
  usePressThrough();
  useEscape();
  useCloseWhenPutAway();
  useAnnounceCards();
  const active = useLessonsStore((s) => s.active);
  return (
    <>
      {active && <LessonCard card={active} />}
      <QuestHost />
      <ToolTips />
      <BuildFeedback />
      <LoadingTips />
      <LiveRegion />
    </>
  );
}
