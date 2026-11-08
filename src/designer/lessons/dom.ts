/**
 * Reading the page for the lessons layer: what is on screen, where the free
 * canvas band is, and what a card must not cover. Read-only: it never
 * changes another component's DOM.
 */
import Konva from 'konva';
import { SECONDARY_WEIGHT, type Rect } from './placement';
import { usePropertyStore } from '../../store/propertyStore';
import { useDrawProgressStore } from '../../store/drawProgressStore';
import { isDrawnPolygon } from '../roomLayout';

/**
 * The secondary bars: the whole top bar (project, floors and project row) and
 * the plan's own view row (area, zoom, fit, share, AI, Clear). A card stays
 * off them too, but on a small phone with a tool open there may be no other
 * room, and then it covers these before the tool's own controls.
 */
export const SECONDARY_SELECTORS = [
  '.plan-topbar',
  '[data-testid="canvas-chrome-toggle"]',
  '.plan-view-toolbar .pointer-events-auto',
  '.plan-document-actions',
] as const;

/** The tool UI a card must never cover (bars, cards on the canvas, docked panels, the bottom bar). */
export const PROTECTED_SELECTORS = [
  ...SECONDARY_SELECTORS,
  // The tool row itself (categories, the active-tool chip, the tool buttons).
  '.plan-build-tools',
  '[data-testid="plan-active-tool"]',
  '[data-testid="room-draw-hud"]',
  '[data-testid="door-options"]',
  '[data-testid="floor-paint-hud"]',
  '[data-testid="cladding-hud"]',
  '[data-testid="wallpaint-hud"]',
  '[data-testid="door-hud"]',
  '[data-testid="remove-hud"]',
  '#ppw-floor-panel',
  '#ppw-wallpaint-panel',
  '#ppw-cladding-panel',
  '[data-testid="materials-panel"]',
  '[data-testid="sims-dock"]',
  '[data-testid="sims-bottom-toolbar"]',
  '[aria-label="Selected item controls"]',
  '[data-testid="house-selection-strip"]',
  '[data-testid="building-controls"]',
  '.house-quick-tools',
  '.house-opening-options',
  '.plan-garden-workspace',
  '.world-walk-launch',
] as const;

/**
 * A tool card wins over the quest: the quest moves out of the card's way
 * (`lessonCardRects` is protected for the quest), never the other way round,
 * so the two never chase each other round the screen.
 */
export function lessonCardRects(): Rect[] {
  const out: Rect[] = [];
  for (const el of document.querySelectorAll('[data-lesson-card], [data-lesson-chip]')) {
    const rect = rectOf(el);
    if (rect) out.push(rect);
  }
  return out;
}

/**
 * After a card or the quest appears or moves, its buttons let presses through
 * for a moment: a tap already on its way to the plan must not land on
 * "No more tips" because a card arrived under the finger.
 */
const SETTLE_MS = 400;

/**
 * The plan often re-centres right after a tool is picked (a tool bar slides
 * in, the view fits again). For this long after a card or the quest appears,
 * it is placed again on every frame, so it follows the room instead of
 * leaving its buttons where the room has just moved to.
 */
export const FOLLOW_MS = 1500;

/** Call `place` on every frame for `FOLLOW_MS`; returns the stop function. */
export function followFor(place: () => void, ms: number = FOLLOW_MS): () => void {
  const until = performance.now() + ms;
  let frame = 0;
  const tick = () => {
    place();
    if (performance.now() < until) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
const settleTimers = new WeakMap<Element, number>();
export function markSettling(el: Element): void {
  el.setAttribute('data-lessons-settling', '');
  const previous = settleTimers.get(el);
  if (previous !== undefined) window.clearTimeout(previous);
  settleTimers.set(
    el,
    window.setTimeout(() => {
      el.removeAttribute('data-lessons-settling');
      settleTimers.delete(el);
    }, SETTLE_MS),
  );
}

/** The main stage: the plan canvas or the 3D canvas. */
export const STAGE_SELECTORS = ['[data-testid="wallpaint-3d-canvas"]', '.konvajs-content'] as const;

export function rectOf(el: Element | null | undefined): Rect | null {
  if (!el || !(el instanceof HTMLElement || el instanceof SVGElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return null;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function firstVisible(selectors: readonly string[]): { el: Element; rect: Rect } | null {
  for (const selector of selectors) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = document.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of nodes) {
      const rect = rectOf(el);
      if (rect) return { el, rect };
    }
  }
  return null;
}

export function protectedRects(extra: readonly Rect[] = [], exclude?: Element | null): Rect[] {
  const out: Rect[] = [...extra];
  const secondary = new Set<string>(SECONDARY_SELECTORS);
  for (const selector of PROTECTED_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      // Never avoid yourself.
      if (exclude && (exclude === el || exclude.contains(el) || el.contains(exclude))) continue;
      const rect = rectOf(el);
      if (rect) out.push(secondary.has(selector) ? { ...rect, weight: SECONDARY_WEIGHT } : rect);
    }
  }
  return out;
}

/**
 * The free band of the stage: its top below any tool bar laid over it, its
 * bottom above any tool card or the bottom bar.
 */
export function stageBand(protect: readonly Rect[]): { top: number; bottom: number; stage: Rect | null } {
  const stage = firstVisible(STAGE_SELECTORS)?.rect ?? null;
  let top = stage ? Math.max(0, stage.y) : 0;
  let bottom = stage ? Math.min(innerHeight, stage.y + stage.h) : innerHeight;
  const middle = (top + bottom) / 2;
  for (const p of protect) {
    if (p.x + p.w < (stage?.x ?? 0) || p.x > (stage ? stage.x + stage.w : innerWidth)) continue;
    // Wide bars only: a narrow side panel does not shrink the band's height.
    if (p.w < innerWidth * 0.45) continue;
    if (p.y + p.h / 2 < middle) top = Math.max(top, p.y + p.h);
    else bottom = Math.min(bottom, p.y);
  }
  return { top, bottom: Math.max(top, bottom), stage };
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function coarsePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** Is the press on the work surface (plan or 3D canvas)? */
export function isStageTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest('.konvajs-content, [data-testid="wallpaint-3d-canvas"], .world-walk-look');
}

/** The plan's live Konva stage (read-only; the same lookup the dev geometry bridge uses). */
function livePlanStage(): Konva.Stage | null {
  for (const stage of Konva.stages ?? []) {
    try {
      const container = stage.container();
      if (container?.isConnected && rectOf(container)) return stage;
    } catch {
      /* a disposed stage throws on container() */
    }
  }
  return null;
}

/**
 * The spot being worked on: the drawn rooms, free walls and the pen's corners
 * on the plan, or the middle of the 3D view. A card avoids these too.
 */
export function workRects(): Rect[] {
  const out: Rect[] = [];
  const stage = livePlanStage();
  if (stage) {
    const { pxPerMetre, property } = usePropertyStore.getState();
    const box = stage.container().getBoundingClientRect();
    const transform = stage.getAbsoluteTransform();
    const toRect = (xs: number[], ys: number[], padPx: number) => {
      if (!xs.length) return;
      const corners = [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ].map(([x, y]) => transform.point({ x: x * pxPerMetre, y: y * pxPerMetre }));
      const x0 = box.left + Math.min(corners[0].x, corners[1].x) - padPx;
      const y0 = box.top + Math.min(corners[0].y, corners[1].y) - padPx;
      const x1 = box.left + Math.max(corners[0].x, corners[1].x) + padPx;
      const y1 = box.top + Math.max(corners[0].y, corners[1].y) + padPx;
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    };
    for (const room of property.rooms) {
      if (!isDrawnPolygon(room.polygon)) continue;
      toRect(room.polygon.map((v) => v.x), room.polygon.map((v) => v.y), 16);
    }
    for (const wall of property.walls ?? []) toRect([wall.a.x, wall.b.x], [wall.a.y, wall.b.y], 24);
    const pen = useDrawProgressStore.getState();
    if (pen.enabled && pen.vertices.length) toRect(pen.vertices.map((v) => v.x), pen.vertices.map((v) => v.y), 48);
  }
  const three = firstVisible(['[data-testid="wallpaint-3d-canvas"]'])?.rect;
  if (three) out.push({ x: three.x + three.w * 0.3, y: three.y + three.h * 0.3, w: three.w * 0.4, h: three.h * 0.4 });
  // Only what is on screen matters.
  return out.filter((r) => r.x < innerWidth && r.y < innerHeight && r.x + r.w > 0 && r.y + r.h > 0);
}
