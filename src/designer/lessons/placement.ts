/**
 * Where a lesson card may sit. Pure, so the rule is tested, not assumed.
 *
 * The card must never cover the tool it explains (its button, its bar or
 * card on the canvas, its docked panel) nor the bottom bar. It goes into the
 * free band of the canvas first, near the tool's button; if the band is too
 * small (a small phone with a tool card open), it tries the bottom of the
 * band, then the top of the screen. When nothing fits, the caller shows the
 * compact card and takes the place that covers the least: the secondary bars
 * (a lighter weight) before the tool's own controls.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** How much covering it costs, per pixel. Tool UI 10 (the default), the
   * secondary bars less (`SECONDARY_WEIGHT`), the work area 1. */
  weight?: number;
}

/** The secondary bars (floors and project row, zoom row): covered before a tool's own controls. */
export const SECONDARY_WEIGHT = 3;
const TOOL_WEIGHT = 10;

export interface PlaceInput {
  size: { w: number; h: number };
  viewport: { w: number; h: number };
  /** The free band of the canvas (between the top chrome and the bottom HUDs). */
  band: { top: number; bottom: number };
  /** The button that picked the tool, if it is on screen. */
  anchor: Rect | null;
  /** Tool UI the card must not cover (bars, tool cards, panels, the bottom bar). */
  protect: readonly Rect[];
  /** The spot being worked on (rooms, the pen's corners). Avoided too, but
   * when something must be covered, this goes first: one press on it folds
   * the card, while covered tool controls would block the tool. */
  work?: readonly Rect[];
  margin?: number;
  /** Which end of the band to try first (cards: top, the quest: bottom). */
  prefer?: 'top' | 'bottom';
}

export interface Placement {
  x: number;
  y: number;
  /** True when no candidate avoided everything (tool UI and work area). */
  overlaps: boolean;
  /** True when even the best spot covers some tool UI: show the compact card. */
  coversTools: boolean;
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Height of a card's button row (44 px buttons + padding). */
const BUTTON_ROW_PX = 56;

export function placeCard(input: PlaceInput): Placement {
  const margin = input.margin ?? 8;
  const { w, h } = input.size;
  const vw = input.viewport.w;
  const vh = input.viewport.h;
  const clampX = (value: number) => Math.round(Math.min(Math.max(value, margin), Math.max(margin, vw - w - margin)));
  const centre = input.anchor ? input.anchor.x + input.anchor.w / 2 : margin + w / 2;
  const x = clampX(centre - w / 2);
  const protect = input.anchor ? [...input.protect, input.anchor] : [...input.protect];
  // Near the button first, then the left and the right edge; at each, the
  // top of the free band, its bottom, the top and the bottom of the screen.
  const xs = [...new Set([x, clampX(margin), clampX(vw - w - margin)])];
  const bandTop = input.band.top + margin;
  const bandBottom = input.band.bottom - h - margin;
  const ends =
    input.prefer === 'bottom'
      ? [bandBottom, bandTop, vh - h - margin, margin]
      : [bandTop, bandBottom, margin, vh - h - margin];
  // Then just below and just above every bar and every work area: when a tool
  // card covers most of a small phone, the gap between it and the tool row
  // is the place, and the band's two ends may both be wrong.
  const edges = [...protect, ...(input.work ?? [])]
    .flatMap((p) => [p.y + p.h + margin, p.y - h - margin])
    .filter((y) => y >= margin && y + h <= vh - margin)
    .sort((a, b) => Math.abs(a - ends[0]) - Math.abs(b - ends[0]));
  const ys = [...new Set([...ends.slice(0, 2), ...edges, ...ends.slice(2)].map((y) => Math.round(y)))];
  const candidates = ys.flatMap((y) => xs.map((cx) => ({ x: cx, y })));
  let best: { x: number; y: number; cost: number; tools: number } | null = null;
  for (const c of candidates) {
    const rect = { x: c.x, y: Math.round(c.y), w, h };
    const outside = rect.y < 0 || rect.y + h > vh;
    const tools = protect.reduce((sum, p) => sum + overlapArea(rect, p), 0);
    const toolCost = protect.reduce((sum, p) => sum + (p.weight ?? TOOL_WEIGHT) * overlapArea(rect, p), 0);
    // The button row is the only part that takes a press: keep it off the work.
    const buttons = { x: rect.x, y: rect.y + h - BUTTON_ROW_PX, w, h: BUTTON_ROW_PX };
    const work = (input.work ?? []).reduce((sum, p) => sum + overlapArea(rect, p) + 5 * overlapArea(buttons, p), 0);
    const cost = toolCost + work + (outside ? 1e9 : 0);
    if (cost === 0) return { x: rect.x, y: rect.y, overlaps: false, coversTools: false };
    if (!best || cost < best.cost) best = { x: rect.x, y: rect.y, cost, tools };
  }
  const chosen = best ?? { x, y: margin, cost: 1, tools: 1 };
  return { x: chosen.x, y: Math.max(margin, Math.min(chosen.y, vh - h - margin)), overlaps: true, coversTools: chosen.tools > 0 };
}
