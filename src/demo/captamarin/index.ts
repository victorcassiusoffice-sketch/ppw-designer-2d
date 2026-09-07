/**
 * Cap Tamarin demo (2026-09-08) — a furnished two-bedroom apartment, built for
 * the meeting at La Place Cap Tamarin on Wednesday 16 September (Patricia
 * Dimba, for Yannick Louison, CEO Real Estate Cluster; Kian Jhuboo, MD).
 *
 * WHAT IS THEIRS AND WHAT IS NOT — the honest part, because this gets shown to
 * the people who built it:
 *
 *  - The SIZE is theirs. captamarin.mu publishes a unit mix but no prices and
 *    no floor plans (the Zetwal units are 360 tours, not plans). Cosy Bay is
 *    published as "appartements 1 à 3 chambres, de 44 à 149 m2"; this plan is
 *    a two-bedroom of ~133 m2 including the terrace, inside that range. The
 *    moment they hand over a real unit plan it replaces this one — that is the
 *    ask at the end of the meeting.
 *  - The FURNITURE is a real Mauritian retailer's range (the Courts Mammouth
 *    catalogue already in this build, with their published prices and
 *    data-sheet dimensions). Kian Jhuboo's own words on 31 August: "we usually
 *    don't sell deco packs directly (we tend to outsource this to specialist)".
 *    So the demo shows exactly that: the designer pointed at somebody else's
 *    range. Point it at their deco specialist instead and nothing else changes.
 *  - NO PRICE for the apartment is stated anywhere. They publish none, and
 *    inventing one in front of them would be the fastest way to lose the room.
 *
 * The demo ships no products of its own; it places `courts-*` ids, which
 * `getProductById` resolves through the demo registry in any tab.
 */
import type { PlacedItem, Property, Room } from '../../store/propertyStore';
import type { Opening } from '../../designer/openings';
import type { DemoDefinition } from '../demoCatalog';
import { COURTS_PRODUCTS } from '../courts';

export const CAPTAMARIN_SLUG = 'captamarin';
export const CAPTAMARIN_PAGE_NAME = 'Cap Tamarin · Two-bedroom apartment';

const BY_ID = new Map(COURTS_PRODUCTS.map((p) => [p.id, p]));

/** Footprint in metres at rotation 0: `l` along x, `w` along y. */
function footprint(id: string): { l: number; w: number } {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Cap Tamarin demo: unknown product ${id}`);
  return { l: p.dimensions_cm.length / 100, w: p.dimensions_cm.width / 100 };
}

function sizeAt(id: string, rotation: 0 | 90 | 180 | 270): { w: number; h: number } {
  const f = footprint(id);
  return rotation === 90 || rotation === 270 ? { w: f.w, h: f.l } : { w: f.l, h: f.w };
}

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

const GAP = 0.05;
type Side = 'top' | 'bottom' | 'left' | 'right';

function againstWall(
  room: Box,
  id: string,
  rotation: 0 | 90 | 180 | 270,
  side: Side,
  along: number,
  gap = GAP,
): { x: number; y: number } {
  const s = sizeAt(id, rotation);
  switch (side) {
    case 'top':
      return { x: round(room.x0 + along), y: round(room.y0 + gap) };
    case 'bottom':
      return { x: round(room.x0 + along), y: round(room.y1 - s.h - gap) };
    case 'left':
      return { x: round(room.x0 + gap), y: round(room.y0 + along) };
    case 'right':
      return { x: round(room.x1 - s.w - gap), y: round(room.y0 + along) };
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

let seq = 0;
function item(
  productId: string,
  at: { x: number; y: number },
  rotation: 0 | 90 | 180 | 270 = 0,
  extra: Partial<PlacedItem> = {},
): PlacedItem {
  seq += 1;
  return {
    instanceId: `ct-${String(seq).padStart(2, '0')}-${productId.replace('courts-', '')}`,
    productId,
    x: round(at.x),
    y: round(at.y),
    rotation,
    ...extra,
  };
}

let openingSeq = 0;
function opening(kind: 'door' | 'window', edgeIndex: number, offsetM: number, widthM: number): Opening {
  openingSeq += 1;
  return {
    id: `ct-op-${String(openingSeq).padStart(2, '0')}`,
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

// The apartment, metres. West-facing living opening onto the terrace, two
// bedrooms behind it — the shape Cap Tamarin's own 2-bed products describe.
export const CT_LIVING: Box = { x0: 0, y0: 0, x1: 8, y1: 5.5 }; // 44.0 m2
export const CT_KITCHEN: Box = { x0: 8, y0: 0, x1: 12, y1: 3.5 }; // 14.0 m2
export const CT_BATH: Box = { x0: 12, y0: 0, x1: 14, y1: 3.5 }; // 7.0 m2
export const CT_HALL: Box = { x0: 8, y0: 3.5, x1: 14, y1: 5.5 }; // 12.0 m2
export const CT_BED1: Box = { x0: 0, y0: 5.5, x1: 4.5, y1: 9.5 }; // 18.0 m2
export const CT_BED2: Box = { x0: 4.5, y0: 5.5, x1: 8.5, y1: 9.5 }; // 16.0 m2
export const CT_TERRACE: Box = { x0: 8.5, y0: 5.5, x1: 14, y1: 9.5 }; // 22.0 m2

/** Wall height the paint quote is taken at. */
export const CT_WALL_HEIGHT_M = 2.7;

export function buildCapTamarinApartment(): Property {
  seq = 0;
  openingSeq = 0;

  // ---- Living and dining ----------------------------------------------
  const sideboard = item(
    'courts-campus-sideboard',
    againstWall(CT_LIVING, 'courts-campus-sideboard', 90, 'left', 1.2),
    90,
  );
  const living: Room = {
    id: 'living',
    name: 'Living and dining',
    polygon: rect(CT_LIVING),
    wallPaint: paintAll('permoglaze-soft-feel'),
    // `offsetM` is the CENTRE of the opening along the edge (openingSpan),
    // and edge 2 runs right-to-left on a clockwise polygon: t 5.8 on the
    // 8 m bottom wall is x 2.2 (bedroom 1), t 1.5 is x 6.5 (bedroom 2).
    openings: [
      opening('window', 0, 1.2, 1.8), // north wall, x 0.3-2.1
      opening('window', 0, 4.6, 1.8), // north wall, x 3.7-5.5
      opening('door', 1, 1.0, DOOR), // east wall -> kitchen
      opening('door', 2, 5.8, DOOR), // south wall -> main bedroom
      opening('door', 2, 1.5, DOOR), // south wall -> second bedroom
    ],
    placedItems: [
      item('courts-elit-rug', { x: 1.1, y: 1.9 }),
      item('courts-marco-sofa-corner', againstWall(CT_LIVING, 'courts-marco-sofa-corner', 0, 'top', 0.9, 0.12)),
      item('courts-perera-coffee-table', { x: 1.4, y: 2.1 }),
      item('courts-aurum-tv-cabinet', againstWall(CT_LIVING, 'courts-aurum-tv-cabinet', 0, 'bottom', 1.2, 0.08)),
      item('courts-hisense-65a6h-tv', againstWall(CT_LIVING, 'courts-hisense-65a6h-tv', 0, 'bottom', 1.27, 0.02)),
      item('courts-samsung-ar18-ac', againstWall(CT_LIVING, 'courts-samsung-ar18-ac', 0, 'top', 3.4, 0.03)),
      sideboard,
      item('courts-marble-table-lamp', { x: 0.12, y: 1.3 }, 0, { parentInstanceId: sideboard.instanceId }),
      item('courts-pendant-lamp-7254', { x: 2.0, y: 2.4 }),
      item('courts-blind-white-180', againstWall(CT_LIVING, 'courts-blind-white-180', 0, 'top', 4.6, 0.02)),
      // Dining end, by the terrace side of the room.
      item('courts-gessica-dining-6', { x: 5.2, y: 1.6 }),
      item('courts-pendant-black-canopy', { x: 6.2, y: 2.4 }),
    ],
  };

  // ---- Kitchen ---------------------------------------------------------
  const lavis = item('courts-lavis-sideboard', againstWall(CT_KITCHEN, 'courts-lavis-sideboard', 0, 'bottom', 0.3, 0.06));
  const kitchen: Room = {
    id: 'kitchen',
    name: 'Kitchen',
    polygon: rect(CT_KITCHEN),
    wallPaint: paintAll('permoglaze-xtreme-white'),
    openings: [
      opening('window', 0, 1.4, 1.2), // north wall, x 8.8-10.0
      opening('door', 2, 2.5, DOOR), // south wall -> hall (x 9.5)
    ],
    placedItems: [
      item('courts-samsung-rb33-fridge', againstWall(CT_KITCHEN, 'courts-samsung-rb33-fridge', 0, 'top', 0.25, 0.06)),
      lavis,
      item('courts-ceramic-table-lamp', { x: 8.5, y: 3.0 }, 0, { parentInstanceId: lavis.instanceId }),
    ],
  };

  // ---- Bathroom (empty: no sanitaryware in the range) -------------------
  const bath: Room = {
    id: 'bath',
    name: 'Bathroom',
    polygon: rect(CT_BATH),
    wallPaint: paintAll('permoglaze-aquashield'),
    openings: [
      opening('window', 0, 1.0, 0.9), // north wall, centred on the 2 m span
      opening('door', 2, 1.0, DOOR), // south wall -> hall
    ],
    placedItems: [],
  };

  // ---- Hall ------------------------------------------------------------
  const hall: Room = {
    id: 'hall',
    name: 'Hall',
    polygon: rect(CT_HALL),
    openings: [
      opening('door', 1, 1.0, DOOR), // front door, centred on the 2 m east wall
    ],
    placedItems: [],
  };

  // ---- Bedroom 1 (master) ---------------------------------------------
  const bedside = item('courts-arte-bedside', { x: 0.15, y: 5.75 });
  const bed1: Room = {
    id: 'bed1',
    name: 'Main bedroom',
    polygon: rect(CT_BED1),
    wallPaint: paintAll('permoglaze-matt-emulsion'),
    openings: [
      opening('window', 3, 1.8, 1.5), // west wall
      opening('window', 2, 2.2, 1.2), // south wall
    ],
    placedItems: [
      item('courts-mika-bed-160', againstWall(CT_BED1, 'courts-mika-bed-160', 0, 'top', 0.75, 0.1)),
      bedside,
      item('courts-table-lamp-wood-d25', { x: 0.2, y: 5.8 }, 0, { parentInstanceId: bedside.instanceId }),
      item('courts-beluga-wardrobe-4', againstWall(CT_BED1, 'courts-beluga-wardrobe-4', 0, 'bottom', 0.4, 0.06)),
      item('courts-samsung-ar09-ac', againstWall(CT_BED1, 'courts-samsung-ar09-ac', 0, 'top', 2.9, 0.03)),
      item('courts-blind-beige-120', againstWall(CT_BED1, 'courts-blind-beige-120', 90, 'left', 1.2, 0.02), 90),
    ],
  };

  // ---- Bedroom 2 (guest + desk) ---------------------------------------
  const desk = item('courts-touran-desk', againstWall(CT_BED2, 'courts-touran-desk', 0, 'bottom', 0.35, 0.06));
  const bed2: Room = {
    id: 'bed2',
    name: 'Second bedroom',
    polygon: rect(CT_BED2),
    wallPaint: paintAll('permoglaze-matt-emulsion'),
    openings: [opening('window', 2, 2.0, 1.2)], // south wall, centred
    placedItems: [
      item('courts-tamarin-corner', againstWall(CT_BED2, 'courts-tamarin-corner', 0, 'top', 0.2, 0.1)),
      desk,
      item('courts-bamboo-desk-lamp', { x: 4.7, y: 8.6 }, 0, { parentInstanceId: desk.instanceId }),
      item('courts-stellar-celosia-chair', { x: 5.0, y: 8.0 }),
      item('courts-malden-bookshelf', againstWall(CT_BED2, 'courts-malden-bookshelf', 0, 'top', 2.4, 0.06)),
      item('courts-hisense-40a4n-tv', againstWall(CT_BED2, 'courts-hisense-40a4n-tv', 90, 'right', 1.4, 0.02), 90),
    ],
  };

  // ---- Terrace ---------------------------------------------------------
  const terrace: Room = {
    id: 'terrace',
    name: 'Terrace',
    polygon: rect(CT_TERRACE),
    openings: [opening('door', 0, 2.4, DOOR)], // north wall -> hall
    placedItems: [
      item('demo-outdoor-bench', { x: 9.0, y: 8.6 }),
      item('demo-hedge', { x: 12.0, y: 9.0 }),
      item('demo-garden-tree', { x: 11.2, y: 5.9 }),
    ],
  };

  return {
    id: 'captamarin-apartment',
    name: CAPTAMARIN_PAGE_NAME,
    activeRoomId: 'living',
    rooms: [living, kitchen, bath, hall, bed1, bed2, terrace],
    walls: [],
    wallHeightM: CT_WALL_HEIGHT_M,
  };
}

export const CAPTAMARIN_DEMO: DemoDefinition = {
  slug: CAPTAMARIN_SLUG,
  merchant: 'Cap Tamarin',
  pageName: CAPTAMARIN_PAGE_NAME,
  products: [],
  currency: 'MUR',
  buildProperty: buildCapTamarinApartment,
};
