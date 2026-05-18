/**
 * Sims-Parity DT-16 — multi-select state helpers (GL1.12).
 *
 * Pure helpers:
 *   • toggleSelection — Shift+click semantic; if id in set, remove;
 *     else add.
 *   • marqueeSelect — given selection rect + item bounds list, return
 *     selected ids. Touch marquee is disabled per mobile policy (see
 *     `MARQUEE_TOUCH_DISABLED` constant — consumers check before
 *     dispatching marquee).
 *   • groupTransform — translate-only group transform.
 */

export const MARQUEE_TOUCH_DISABLED = true;

export function toggleSelection(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function singleSelect(id: string): Set<string> {
  return new Set([id]);
}

export function clearSelection(): Set<string> {
  return new Set();
}

export interface RectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
}

export interface MarqueeItem {
  id: string;
  rect: RectMm;
}

/**
 * Returns the set of item ids fully inside the marquee rect.
 * (Use fully-inside semantics — partial overlap is too easy to fire
 * accidentally during a hand-drawn marquee.)
 */
export function marqueeSelect(marquee: RectMm, items: MarqueeItem[]): Set<string> {
  const result = new Set<string>();
  const mLeft = marquee.xMm;
  const mTop = marquee.yMm;
  const mRight = marquee.xMm + marquee.widthMm;
  const mBottom = marquee.yMm + marquee.depthMm;
  for (const it of items) {
    const iL = it.rect.xMm;
    const iT = it.rect.yMm;
    const iR = it.rect.xMm + it.rect.widthMm;
    const iB = it.rect.yMm + it.rect.depthMm;
    if (iL >= mLeft && iR <= mRight && iT >= mTop && iB <= mBottom) {
      result.add(it.id);
    }
  }
  return result;
}

/**
 * Apply a translation to a list of item positions atomically.
 */
export interface PositionedItem {
  id: string;
  xMm: number;
  yMm: number;
}
export function groupTranslate(items: PositionedItem[], deltaXMm: number, deltaYMm: number): PositionedItem[] {
  return items.map((it) => ({ ...it, xMm: it.xMm + deltaXMm, yMm: it.yMm + deltaYMm }));
}
