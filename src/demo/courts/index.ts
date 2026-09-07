/**
 * Courts Mammouth demo (2026-09-05) — their real range, and a show home built
 * from it.
 *
 * `products.json` is generated from courtsmammouth.mu product pages (read via
 * web.archive.org snapshots because the live site sits behind a bot wall);
 * every row's `notes` carries the price date and the data-sheet lines it was
 * built from, and `source_url` is the product page. Where a page published no
 * footprint (the split-unit air conditioners, the home gym) the notes say the
 * size is typical, not theirs.
 *
 * The show home is FIVE attached rooms on one canvas — living, dining and
 * kitchen, wellness, office, bedroom — each furnished only from this range,
 * with doors between them, windows on the outer walls, one painted room, and
 * the wellness floor laid. Positions are computed from the product
 * dimensions, so a corrected size moves the piece rather than breaking the
 * plan.
 */
import catalog from './products.json';
import type { Product } from '../../data/products.schema';
import type { PlacedItem, Property, Room } from '../../store/propertyStore';
import type { Opening } from '../../designer/openings';
import type { DemoDefinition } from '../demoCatalog';

export const COURTS_SLUG = 'courts';
export const COURTS_PAGE_NAME = 'Courts Mammouth · Show home';

export const COURTS_PRODUCTS: Product[] = (catalog as { products: Product[] }).products;
const BY_ID = new Map(COURTS_PRODUCTS.map((p) => [p.id, p]));

/** Footprint in metres at rotation 0: `l` along x, `w` along y. */
function footprint(id: string): { l: number; w: number } {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Courts demo: unknown product ${id}`);
  return { l: p.dimensions_cm.length / 100, w: p.dimensions_cm.width / 100 };
}

/** Axis-aligned size on the plan for a cardinal rotation. */
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

const GAP = 0.05; // metres between a wall face and the piece against it

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Top-left of a piece pushed against one wall of `room`, `along` metres from
 * that wall's start (left end for top/bottom, top end for left/right).
 */
function againstWall(room: Box, id: string, rotation: 0 | 90 | 180 | 270, side: Side, along: number, gap = GAP): { x: number; y: number } {
  const s = sizeAt(id, rotation);
  switch (side) {
    case 'top':
      return { x: room.x0 + along, y: room.y0 + gap };
    case 'bottom':
      return { x: room.x0 + along, y: room.y1 - s.h - gap };
    case 'left':
      return { x: room.x0 + gap, y: room.y0 + along };
    case 'right':
      return { x: room.x1 - s.w - gap, y: room.y0 + along };
  }
}

let seq = 0;
function item(productId: string, at: { x: number; y: number }, rotation: 0 | 90 | 180 | 270 = 0, extra: Partial<PlacedItem> = {}): PlacedItem {
  seq += 1;
  const n = String(seq).padStart(2, '0');
  return { instanceId: `courts-${n}-${productId.replace('courts-', '')}`, productId, x: round(at.x), y: round(at.y), rotation, ...extra };
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

let openingSeq = 0;
function opening(kind: 'door' | 'window', edgeIndex: number, offsetM: number, widthM: number): Opening {
  openingSeq += 1;
  return {
    id: `courts-op-${String(openingSeq).padStart(2, '0')}`,
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

// The plan, metres. Row 1: living + dining. Row 2: wellness, office, bedroom.
const LIVING: Box = { x0: 0, y0: 0, x1: 6, y1: 4.5 };
const DINING: Box = { x0: 6, y0: 0, x1: 10, y1: 4.5 };
const WELLNESS: Box = { x0: 0, y0: 4.5, x1: 4.5, y1: 8.5 };
const OFFICE: Box = { x0: 4.5, y0: 4.5, x1: 7.5, y1: 8.5 };
const BEDROOM: Box = { x0: 7.5, y0: 4.5, x1: 11.5, y1: 8.5 };

function paintAll(paintId: string) {
  return [0, 1, 2, 3].map((edgeIndex) => ({ edgeIndex, paintId }));
}

export function buildCourtsShowHome(): Property {
  seq = 0;
  openingSeq = 0;

  // ---- Living room -------------------------------------------------------
  const sideboard = item('courts-campus-sideboard', againstWall(LIVING, 'courts-campus-sideboard', 90, 'right', 0.3), 90);
  const living: Room = {
    id: 'living',
    name: 'Living room',
    polygon: rect(LIVING),
    wallPaint: paintAll('permoglaze-soft-feel'),
    openings: [
      opening('window', 0, 4.2, 1.8), // top wall, x 3.3–5.1 (the blind hangs here)
      opening('window', 3, 2.25, 1.2), // left wall, y 1.65–2.85
      opening('door', 1, 3.6, DOOR), // to the dining room
      opening('door', 2, 3.6, DOOR), // bottom wall at x 2.4 → wellness
      opening('door', 2, 0.75, DOOR), // bottom wall at x 5.25 → office
    ],
    placedItems: [
      item('courts-elit-rug', { x: 0.7, y: 1.35 }),
      item('courts-marco-sofa-corner', againstWall(LIVING, 'courts-marco-sofa-corner', 0, 'top', 0.2, 0.12)),
      item('courts-perera-coffee-table', { x: 0.95, y: 1.55 }),
      item('courts-aurum-tv-cabinet', againstWall(LIVING, 'courts-aurum-tv-cabinet', 0, 'bottom', 3.1, 0.08)),
      item('courts-hisense-65a6h-tv', againstWall(LIVING, 'courts-hisense-65a6h-tv', 0, 'bottom', 3.17, 0.02)),
      item('courts-samsung-ar18-ac', againstWall(LIVING, 'courts-samsung-ar18-ac', 90, 'left', 3.3, 0.03), 90),
      sideboard,
      item('courts-marble-table-lamp', { x: 5.57, y: 0.6 }, 0, { parentInstanceId: sideboard.instanceId }),
      item('courts-pendant-lamp-7254', { x: 2.8, y: 2.05 }),
      item('courts-blind-white-180', againstWall(LIVING, 'courts-blind-white-180', 0, 'top', 3.3, 0.02)),
    ],
  };

  // ---- Dining and kitchen ------------------------------------------------
  const lavis = item('courts-lavis-sideboard', againstWall(DINING, 'courts-lavis-sideboard', 90, 'right', 1.7), 90);
  const dining: Room = {
    id: 'dining',
    name: 'Dining and kitchen',
    polygon: rect(DINING),
    openings: [
      opening('window', 0, 2.0, 1.2), // top wall, x 7.4–8.6
      opening('door', 2, 1.25, DOOR), // bottom wall at x 8.75 → bedroom
    ],
    placedItems: [
      item('courts-gessica-dining-6', { x: 6.8, y: 1.25 }),
      item('courts-samsung-rb33-fridge', againstWall(DINING, 'courts-samsung-rb33-fridge', 0, 'top', 3.3, 0.06)),
      lavis,
      item('courts-ceramic-table-lamp', { x: 9.6, y: 2.2 }, 0, { parentInstanceId: lavis.instanceId }),
      item('courts-pendant-black-canopy', { x: 7.8, y: 1.95 }),
    ],
  };

  // ---- Wellness room (home gym + recovery) ---------------------------------
  const wellness: Room = {
    id: 'wellness',
    name: 'Wellness room',
    polygon: rect(WELLNESS),
    floorFinish: { materialId: 'rubber-composite' },
    openings: [
      opening('window', 3, 2.0, 1.5), // left wall, y 5.75–7.25
      opening('window', 2, 2.25, 1.2), // bottom wall, x 1.65–2.85
    ],
    placedItems: [
      item('courts-horizon-tr50-treadmill', againstWall(WELLNESS, 'courts-horizon-tr50-treadmill', 90, 'left', 0.15, 0.12), 90),
      item('courts-horizon-gr7-cycle', { x: 1.1, y: 6.6 }),
      item('courts-jdm-home-gym', { x: 3.35, y: 5.9 }),
      item('courts-tamarin-corner', { x: 3.25, y: 7.3 }),
      item('courts-homedics-footspa', { x: 2.5, y: 7.9 }),
    ],
  };

  // ---- Home office ---------------------------------------------------------
  const desk = item('courts-touran-desk', againstWall(OFFICE, 'courts-touran-desk', 90, 'right', 1.1, 0.06), 90);
  const office: Room = {
    id: 'office',
    name: 'Home office',
    polygon: rect(OFFICE),
    openings: [
      opening('window', 2, 0.9, 1.2), // bottom wall, x 6.0–7.2
    ],
    placedItems: [
      desk,
      item('courts-stellar-celosia-chair', { x: 6.15, y: 5.9 }, 90),
      item('courts-malden-bookshelf', againstWall(OFFICE, 'courts-malden-bookshelf', 0, 'bottom', 0.2, 0.06)),
      item('courts-nexus-shelving-white', againstWall(OFFICE, 'courts-nexus-shelving-white', 0, 'bottom', 0.9, 0.06)),
      item('courts-bamboo-desk-lamp', { x: 6.9, y: 5.7 }, 0, { parentInstanceId: desk.instanceId }),
      item('courts-hisense-as12-ac', againstWall(OFFICE, 'courts-hisense-as12-ac', 0, 'top', 1.8, 0.03)),
    ],
  };

  // ---- Bedroom -------------------------------------------------------------
  const bedside = item('courts-arte-bedside', { x: 11.05, y: 5.0 });
  const bedroom: Room = {
    id: 'bedroom',
    name: 'Bedroom',
    polygon: rect(BEDROOM),
    wallPaint: paintAll('permoglaze-matt-emulsion'),
    openings: [
      opening('window', 1, 3.2, 1.2), // right wall, y 7.1–8.3 (blind)
      opening('window', 2, 0.9, 1.2), // bottom wall, x 10.0–11.2
    ],
    placedItems: [
      item('courts-mika-bed-160', againstWall(BEDROOM, 'courts-mika-bed-160', 90, 'right', 0.9), 90),
      bedside,
      item('courts-table-lamp-wood-d25', { x: 11.1, y: 5.05 }, 0, { parentInstanceId: bedside.instanceId }),
      item('courts-beluga-wardrobe-4', againstWall(BEDROOM, 'courts-beluga-wardrobe-4', 0, 'bottom', 0.2, 0.06)),
      item('courts-hisense-40a4n-tv', againstWall(BEDROOM, 'courts-hisense-40a4n-tv', 90, 'left', 1.5, 0.03), 90),
      item('courts-samsung-ar09-ac', againstWall(BEDROOM, 'courts-samsung-ar09-ac', 0, 'top', 2.8, 0.03)),
      item('courts-blind-beige-120', againstWall(BEDROOM, 'courts-blind-beige-120', 90, 'right', 2.6, 0.02), 90),
    ],
  };

  return {
    id: 'courts-show-home',
    name: COURTS_PAGE_NAME,
    activeRoomId: 'living',
    rooms: [living, dining, wellness, office, bedroom],
    walls: [],
  };
}

export const COURTS_DEMO: DemoDefinition = {
  slug: COURTS_SLUG,
  merchant: 'Courts Mammouth',
  pageName: COURTS_PAGE_NAME,
  products: COURTS_PRODUCTS,
  currency: 'MUR',
  buildProperty: buildCourtsShowHome,
};
