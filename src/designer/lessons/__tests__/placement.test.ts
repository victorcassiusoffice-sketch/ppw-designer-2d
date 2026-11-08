/**
 * The card never covers the tool it explains, the tool's bar or card, or the
 * bottom bar, when there is any room; when there is none it reports it.
 */
import { describe, expect, it } from 'vitest';
import { overlapArea, placeCard, SECONDARY_WEIGHT, type Rect } from '../placement';

const viewport = { w: 1280, h: 800 };
const size = { w: 360, h: 250 };

describe('placeCard', () => {
  it('sits at the top of the canvas band, under the tool button, covering nothing', () => {
    const anchor: Rect = { x: 720, y: 80, w: 56, h: 44 };
    const placed = placeCard({ size, viewport, band: { top: 365, bottom: 730 }, anchor, protect: [] });
    expect(placed.overlaps).toBe(false);
    expect(placed.y).toBe(373);
    // Centred on the button, clamped inside the screen.
    expect(placed.x).toBe(Math.round(720 + 28 - 180));
    expect(overlapArea({ ...placed, ...size }, anchor)).toBe(0);
  });

  it('moves to the side when a docked panel covers the spot under the button', () => {
    const anchor: Rect = { x: 1100, y: 80, w: 56, h: 44 };
    const panel: Rect = { x: 960, y: 140, w: 320, h: 600 };
    const placed = placeCard({ size, viewport, band: { top: 365, bottom: 730 }, anchor, protect: [panel] });
    expect(placed.overlaps).toBe(false);
    expect(overlapArea({ ...placed, ...size }, panel)).toBe(0);
  });

  it('on a small phone with a tool card open, goes just above that card', () => {
    const phone = { w: 313, h: 567 };
    const toolRow: Rect = { x: 8, y: 60, w: 297, h: 50 };
    const hud: Rect = { x: 9, y: 366, w: 294, h: 133 };
    const bar: Rect = { x: 48, y: 495, w: 216, h: 56 };
    const compact = { w: 297, h: 146 };
    const placed = placeCard({ size: compact, viewport: phone, band: { top: 273, bottom: 366 }, anchor: null, protect: [toolRow, hud, bar] });
    expect(placed.overlaps).toBe(false);
    for (const p of [toolRow, hud, bar]) expect(overlapArea({ ...placed, ...compact }, p)).toBe(0);
    expect(placed.y + compact.h).toBeLessThanOrEqual(366);
  });

  it('reports an overlap when nothing fits, and still stays on screen', () => {
    const phone = { w: 313, h: 567 };
    const everything: Rect = { x: 0, y: 0, w: 313, h: 567 };
    const placed = placeCard({ size: { w: 297, h: 300 }, viewport: phone, band: { top: 0, bottom: 567 }, anchor: null, protect: [everything] });
    expect(placed.overlaps).toBe(true);
    expect(placed.coversTools).toBe(true);
    expect(placed.y).toBeGreaterThanOrEqual(8);
    expect(placed.y + 300).toBeLessThanOrEqual(567);
  });

  it('can prefer the bottom of the band (the quest)', () => {
    const placed = placeCard({ size: { w: 300, h: 140 }, viewport, band: { top: 365, bottom: 730 }, anchor: null, protect: [], prefer: 'bottom' });
    expect(placed.y).toBe(730 - 140 - 8);
    expect(placed.x).toBe(8);
  });

  it('covers the room before it covers a tool control, and stays full size', () => {
    const toolPanel: Rect = { x: 1008, y: 210, w: 272, h: 540 };
    const room: Rect = { x: 250, y: 290, w: 510, h: 410 };
    const placed = placeCard({ size, viewport, band: { top: 262, bottom: 735 }, anchor: { x: 690, y: 80, w: 56, h: 44 }, protect: [toolPanel], work: [room] });
    expect(overlapArea({ ...placed, ...size }, toolPanel)).toBe(0);
    expect(placed.coversTools).toBe(false);
  });

  it('finds the gap above a tool card that covers most of a small phone', () => {
    const phone = { w: 313, h: 567 };
    const toolRow: Rect = { x: 9, y: 60, w: 295, h: 50 };
    const paintCard: Rect = { x: 9, y: 270, w: 294, h: 229 };
    const bar: Rect = { x: 48, y: 495, w: 216, h: 56 };
    const compact = { w: 297, h: 146 };
    // The band guess has collapsed below the paint card (it covers most of the plan).
    const placed = placeCard({ size: compact, viewport: phone, band: { top: 499, bottom: 499 }, anchor: null, protect: [toolRow, paintCard, bar] });
    expect(placed.coversTools).toBe(false);
    for (const p of [toolRow, paintCard, bar]) expect(overlapArea({ ...placed, ...compact }, p)).toBe(0);
  });

  it('with no gap at all, covers a secondary bar before the tool row or the tool panel', () => {
    // 360 px at 115 % text (313 x 567) with Wall paint open, measured 8 Nov:
    // the top bar runs to 221, the view row 221 to 273, the paint panel from 270.
    const phone = { w: 313, h: 567 };
    const topBar: Rect = { x: 0, y: 0, w: 313, h: 221, weight: SECONDARY_WEIGHT };
    const toolRow: Rect = { x: 9, y: 60, w: 295, h: 50 };
    const viewRow: Rect = { x: 3, y: 225, w: 145, h: 44, weight: SECONDARY_WEIGHT };
    const paintCard: Rect = { x: 9, y: 270, w: 294, h: 229 };
    const bar: Rect = { x: 48, y: 505, w: 216, h: 56 };
    const oneRow = { w: 297, h: 58 };
    const placed = placeCard({ size: oneRow, viewport: phone, band: { top: 499, bottom: 499 }, anchor: null, protect: [topBar, toolRow, viewRow, paintCard, bar] });
    const card = { ...placed, ...oneRow };
    expect(placed.coversTools).toBe(true);
    for (const p of [toolRow, paintCard, bar]) expect(overlapArea(card, p)).toBe(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.h).toBeLessThanOrEqual(567);
  });
});
