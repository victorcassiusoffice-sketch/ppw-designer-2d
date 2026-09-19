/**
 * Sofap demo (2026-09-07) — a painted show flat for the Sofap retail team
 * (meeting Mon 14 Sep 11:00: Damien Chasteau, Retail Manager, and Henna
 * Gowreesunkur).
 *
 * Sofap's Permoglaze range is ALREADY the wall-paint catalogue of the
 * designer (`src/data/wallPaints.ts`, live sofaponlinestore.mu prices and
 * datasheet spread rates), so this demo ships no products of its own. What it
 * pre-builds is the thing the paint tool is for: a three-room flat, every wall
 * painted, a different Permoglaze line per room, with doors and windows on
 * the walls so the litres visibly deduct the openings and the tin count is
 * the cheapest set of whole tins at Sofap's own prices.
 *
 * A handful of the bundled decor pieces furnish it so the rooms read as
 * rooms; the paint lines are the point.
 */
import type { PlacedItem, Property, Room } from '../../store/propertyStore';
import type { Opening } from '../../designer/openings';
import type { DemoDefinition } from '../demoCatalog';

export const SOFAP_SLUG = 'sofap';
export const SOFAP_PAGE_NAME = 'Sofap · Painted show flat';

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Clockwise rectangle (y down): edges 0 top, 1 right, 2 bottom, 3 left. */
function rect(b: Box) {
  return [
    { x: b.x0, y: b.y0 },
    { x: b.x1, y: b.y0 },
    { x: b.x1, y: b.y1 },
    { x: b.x0, y: b.y1 },
  ];
}

let seq = 0;
let idPrefix = 'sofap';
function item(productId: string, at: { x: number; y: number }, rotation: 0 | 90 | 180 | 270 = 0, extra: Partial<PlacedItem> = {}): PlacedItem {
  seq += 1;
  return { instanceId: `${idPrefix}-${String(seq).padStart(2, '0')}-${productId.replace('demo-', '')}`, productId, x: at.x, y: at.y, rotation, ...extra };
}

let openingSeq = 0;
function opening(kind: 'door' | 'window', edgeIndex: number, offsetM: number, widthM: number): Opening {
  openingSeq += 1;
  return {
    id: `${idPrefix}-op-${String(openingSeq).padStart(2, '0')}`,
    edgeIndex,
    offsetM,
    widthM,
    kind,
    flipFacing: false,
    flipHand: false,
    ...(kind === 'window' ? { sillM: 0.9 } : {}),
  };
}

const DOOR = 0.838;

function paintAll(paintId: string) {
  return [0, 1, 2, 3].map((edgeIndex) => ({ edgeIndex, paintId }));
}

// The flat, metres. Living across the top; bedroom and kitchen beneath it.
export const SOFAP_LIVING: Box = { x0: 0, y0: 0, x1: 5.5, y1: 4 };
export const SOFAP_BEDROOM: Box = { x0: 0, y0: 4, x1: 3.5, y1: 7.5 };
export const SOFAP_KITCHEN: Box = { x0: 3.5, y0: 4, x1: 5.5, y1: 7.5 };

/** Wall height the quote is taken at — Sofap's datasheets assume a standard room. */
export const SOFAP_WALL_HEIGHT_M = 2.7;

export interface ShowFlatOptions {
  id: string;
  name: string;
  /** Prefix for the instance / opening ids (a demo's slug). */
  prefix: string;
  /** The paint line per room (`WallPaint.id`). */
  paints: { living: string; bedroom: string; kitchen: string };
}

const SOFAP_SHOW_FLAT: ShowFlatOptions = {
  id: 'sofap-show-flat',
  name: SOFAP_PAGE_NAME,
  prefix: 'sofap',
  // Soft Feel on the living walls (the premium line, 9 m²/L, 2 coats);
  // Matt Emulsion in the bedroom (the everyday line the pitch page's tin
  // arithmetic uses); Xtreme White in the kitchen (washable, 10.5 m²/L).
  paints: { living: 'permoglaze-soft-feel', bedroom: 'permoglaze-matt-emulsion', kitchen: 'permoglaze-xtreme-white' },
};

export function buildSofapShowFlat(): Property {
  return buildShowFlat(SOFAP_SHOW_FLAT);
}

/** The same flat for another paint company's pitch (TintEX, 2026-09-19): its lines on the walls, its ids. */
export function buildShowFlat(opts: ShowFlatOptions): Property {
  seq = 0;
  openingSeq = 0;
  idPrefix = opts.prefix;

  const console = item('demo-console-table', { x: 0.2, y: 0.1 });
  const living: Room = {
    id: 'living',
    name: 'Living room',
    polygon: rect(SOFAP_LIVING),
    wallPaint: paintAll(opts.paints.living),
    openings: [
      opening('window', 0, 2.0, 1.8), // top wall, x 2.0–3.8
      opening('window', 1, 1.2, 1.2), // right wall, y 1.2–2.4
      opening('door', 2, 0.9, DOOR), // bottom wall at x 0.9 → bedroom
      opening('door', 2, 4.2, DOOR), // bottom wall at x 4.2 → kitchen
      opening('door', 3, 2.9, DOOR), // left wall, the front door
    ],
    placedItems: [
      console,
      item('demo-potted-plant', { x: 0.3, y: 0.15 }, 0, { parentInstanceId: console.instanceId }),
      item('demo-aroma-diffuser', { x: 1.1, y: 0.2 }, 0, { parentInstanceId: console.instanceId }),
      item('demo-floor-lamp', { x: 4.9, y: 3.4 }),
      item('demo-pendant-light', { x: 2.5, y: 1.8 }),
      item('demo-wall-mirror', { x: 2.1, y: 3.9 }),
    ],
  };

  const bedroom: Room = {
    id: 'bedroom',
    name: 'Bedroom',
    polygon: rect(SOFAP_BEDROOM),
    wallPaint: paintAll(opts.paints.bedroom),
    openings: [
      opening('window', 3, 1.5, 1.2), // left wall, y 5.5–6.7
      opening('window', 2, 1.15, 1.2), // bottom wall, x 1.15–2.35
    ],
    placedItems: [
      item('demo-wall-sconce', { x: 0.2, y: 4.0 }),
      item('demo-wall-shelf', { x: 2.5, y: 4.0 }),
    ],
  };

  const kitchen: Room = {
    id: 'kitchen',
    name: 'Kitchen',
    polygon: rect(SOFAP_KITCHEN),
    wallPaint: paintAll(opts.paints.kitchen),
    openings: [
      opening('window', 1, 1.4, 1.0), // right wall, y 5.4–6.4
    ],
    placedItems: [item('demo-pendant-light', { x: 4.25, y: 5.5 })],
  };

  return {
    id: opts.id,
    name: opts.name,
    activeRoomId: 'living',
    rooms: [living, bedroom, kitchen],
    walls: [],
    wallHeightM: SOFAP_WALL_HEIGHT_M,
  };
}

export const SOFAP_DEMO: DemoDefinition = {
  slug: SOFAP_SLUG,
  merchant: 'Sofap',
  pageName: SOFAP_PAGE_NAME,
  products: [],
  currency: 'MUR',
  // Their meeting, their range: the panel shows Sofap only.
  paintBrandIds: ['sofap'],
  buildProperty: buildSofapShowFlat,
};
