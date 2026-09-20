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
import type { Property, Room } from '../../store/propertyStore';
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

let idPrefix = 'sofap';

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

/**
 * A room's paint: the line, and (3D Mode P3, 2026-09-19) the SHADE it is
 * painted in — the 3D audit found both show flats reading as unpainted
 * white boxes because every wall carried its line's white base hex. A shade
 * from the brand's own card makes the flat read as painted.
 */
export interface RoomPaint {
  paintId: string;
  colourHex?: string;
  colourName?: string;
}

function paintAll(p: RoomPaint | string) {
  const spec: RoomPaint = typeof p === 'string' ? { paintId: p } : p;
  return [0, 1, 2, 3].map((edgeIndex) => ({ edgeIndex, ...spec }));
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
  /** The paint line per room (`WallPaint.id`), with the shade it is painted in. */
  paints: { living: RoomPaint | string; bedroom: RoomPaint | string; kitchen: RoomPaint | string };
}

const SOFAP_SHOW_FLAT: ShowFlatOptions = {
  id: 'sofap-show-flat',
  name: SOFAP_PAGE_NAME,
  prefix: 'sofap',
  // Soft Feel on the living walls (the premium line, 9 m²/L, 2 coats);
  // Matt Emulsion in the bedroom (the everyday line the pitch page's tin
  // arithmetic uses); Xtreme White in the kitchen (washable, 10.5 m²/L).
  // Shades from Sofap's own à-la-carte card (official hexes, sofapColours.ts);
  // Xtreme White is a white-only line, so the kitchen stays its white.
  paints: {
    living: { paintId: 'permoglaze-soft-feel', colourHex: '#E0C6A4', colourName: 'Bermuda Beach' },
    bedroom: { paintId: 'permoglaze-matt-emulsion', colourHex: '#CFC5B7', colourName: 'Elmwood' },
    kitchen: 'permoglaze-xtreme-white',
  },
};

export function buildSofapShowFlat(): Property {
  return buildShowFlat(SOFAP_SHOW_FLAT);
}

/** The same flat for another paint company's pitch (TintEX, 2026-09-19): its lines on the walls, its ids. */
export function buildShowFlat(opts: ShowFlatOptions): Property {
  openingSeq = 0;
  idPrefix = opts.prefix;

  // No props (Vic 2026-09-20: "there's a random table there and there's no
  // 3D product of a table … it's a design software operating like The
  // Sims"). A paint pitch shows the rooms, their openings and the paint; a
  // customer furnishes it from the catalogue, and what they place is what
  // the 3D shows — nothing stands in for a product.
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
    placedItems: [],
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
    placedItems: [],
  };

  const kitchen: Room = {
    id: 'kitchen',
    name: 'Kitchen',
    polygon: rect(SOFAP_KITCHEN),
    wallPaint: paintAll(opts.paints.kitchen),
    openings: [
      opening('window', 1, 1.4, 1.0), // right wall, y 5.4–6.4
    ],
    placedItems: [],
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
