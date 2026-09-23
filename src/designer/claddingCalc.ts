/**
 * Cladding quantity — wall area (paint's opening deduction) → whole boards
 * → whole packs. Prices come only from the sample catalog.
 */
import type { Polygon } from '../lib/geometry';
import type { Opening } from './openings';
import { edgeLengthM, paintableEdgeAreaM2, wallFinishHeightM } from './wallPaintCalc';
import type { Level } from './levels';
import { DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import {
  CLADDING_PRODUCTS,
  boardFaceM2,
  findCladdingProduct,
  type CladdingProduct,
} from '../data/claddingCatalog';

export interface CladEdge {
  edgeIndex: number;
  productId: string;
}

interface CladRoom {
  levelId?: string;
  id: string;
  name: string;
  polygon: Polygon;
  openings?: Opening[];
  wallCladding?: CladEdge[];
}

interface CladFreeWall {
  levelId?: string;
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  claddingId?: string;
  /** 2 = both faces; absent = 1. Shares the paint-faces convention. */
  claddingFaces?: number;
}

export interface CladdingOrder {
  productId: string;
  product: CladdingProduct;
  areaM2: number;
  /** Boards the faces need before the offcut allowance. */
  netBoards: number;
  /** Boards to buy (net × (1 + waste), rounded up). */
  boards: number;
  packs: number;
  totalMur: number;
  perRoom: Array<{ roomId: string; roomName: string; areaM2: number; boards: number }>;
}

function orderFor(product: CladdingProduct, areaM2: number): { boards: number; netBoards: number; packs: number; totalMur: number } {
  const face = boardFaceM2(product);
  if (!(face > 0) || !(areaM2 > 0)) return { boards: 0, netBoards: 0, packs: 0, totalMur: 0 };
  const netBoards = areaM2 / face;
  const boards = Math.ceil(netBoards * (1 + product.wasteFraction) - 1e-9);
  const packs = Math.ceil(boards / product.boardsPerPack);
  return { boards, netBoards, packs, totalMur: packs * product.samplePackPriceMur };
}

/**
 * One order per sample product across the plan. Area is the paintable face
 * (length × height − openings), same rule as wall paint.
 */
export function deriveCladdingOrders(
  property: { rooms: CladRoom[]; walls?: CladFreeWall[]; wallHeightM?: number; levels?: Level[] },
  wallHeightM = property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M,
): CladdingOrder[] {
  const areaByProduct = new Map<string, { area: number; rooms: CladdingOrder['perRoom'] }>();
  const add = (productId: string, area: number, room: { id: string; name: string }) => {
    if (!(area > 0)) return;
    const slot = areaByProduct.get(productId) ?? { area: 0, rooms: [] };
    slot.area += area;
    const row = slot.rooms.find((r) => r.roomId === room.id);
    if (row) row.areaM2 += area;
    else slot.rooms.push({ roomId: room.id, roomName: room.name, areaM2: area, boards: 0 });
    areaByProduct.set(productId, slot);
  };

  for (const room of property.rooms) {
    const heightM = wallFinishHeightM(property, room, wallHeightM);
    for (const e of room.wallCladding ?? []) {
      const product = findCladdingProduct(e.productId);
      if (!product) continue;
      add(product.id, paintableEdgeAreaM2(room, e.edgeIndex, heightM), room);
    }
  }
  for (const w of property.walls ?? []) {
    const heightM = wallFinishHeightM(property, w, wallHeightM);
    const product = findCladdingProduct(w.claddingId);
    if (!product) continue;
    const faces = w.claddingFaces === 2 ? 2 : 1;
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    add(product.id, len * heightM * faces, { id: `wall:${w.id}`, name: 'Free wall' });
  }

  const out: CladdingOrder[] = [];
  for (const product of CLADDING_PRODUCTS) {
    const slot = areaByProduct.get(product.id);
    if (!slot || slot.area <= 0) continue;
    const q = orderFor(product, slot.area);
    const perRoom = slot.rooms.map((r) => ({
      ...r,
      areaM2: Math.round(r.areaM2 * 100) / 100,
      boards: Math.ceil((r.areaM2 / boardFaceM2(product)) * (1 + product.wasteFraction) - 1e-9),
    }));
    out.push({
      productId: product.id,
      product,
      areaM2: Math.round(slot.area * 100) / 100,
      netBoards: Math.round(q.netBoards * 10) / 10,
      boards: q.boards,
      packs: q.packs,
      totalMur: q.totalMur,
      perRoom,
    });
  }
  return out;
}

/** Length helper re-export so tests can show the area chain without a second import. */
export { edgeLengthM };
