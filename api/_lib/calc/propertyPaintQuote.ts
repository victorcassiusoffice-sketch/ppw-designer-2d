import { z } from 'zod';
import { DEFAULT_WALL_HEIGHT_M, findWallPaintById, MAX_PAINT_COATS, MAX_PAINT_WASTE_PCT, MIN_PAINT_COATS } from '../../../src/data/wallPaints.js';
import { coatsFor, deriveWallPaintOrders, wallPaintBreakdown, wastePctFor } from '../../../src/designer/wallPaintCalc.js';

const coordinate = z.number().finite().min(-10000).max(10000);
const point = z.object({ x: coordinate, y: coordinate });
const text = z.string().min(1).max(200);
const paintId = text.refine(id => !!findWallPaintById(id), 'Unknown wall-paint product');
const height = z.number().finite().min(2).max(8);
const paintedFace = z.object({
  edgeIndex: z.number().int().nonnegative(), paintId, side: z.enum(['interior', 'exterior']).optional(),
  colourHex: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), colourName: z.string().max(200).optional(),
});

/** Read-only property quote input. Strip unrelated design data; reject malformed
 * measurements rather than normalising them into plausible quantities. Bounds
 * also keep the exact tin-pack optimiser safe on this public calculation API. */
export const propertyPaintQuoteSchema = z.object({
  mode: z.literal('property'),
  property: z.object({
    wallHeightM: height.optional(),
    wallPaintCoats: z.number().int().min(MIN_PAINT_COATS).max(MAX_PAINT_COATS).optional(),
    wallPaintWastePct: z.number().finite().min(0).max(MAX_PAINT_WASTE_PCT).optional(),
    wallPaintPrimer: z.boolean().optional(),
    levels: z.array(z.object({ id: text, name: text, index: z.number().int().min(0).max(100), kind: z.literal('roof').optional(), heightM: height.optional() })).max(100).optional(),
    rooms: z.array(z.object({
      id: text, name: text, levelId: text.optional(), kind: z.enum(['room', 'outdoor', 'roof']).optional(),
      polygon: z.array(point).min(3).max(100),
      openings: z.array(z.object({
        id: text, edgeIndex: z.number().int().nonnegative(), offsetM: z.number().finite().min(-10000).max(10000),
        widthM: z.number().finite().positive().max(100), kind: z.enum(['door', 'doorway', 'window']),
        sillM: z.number().finite().min(0).max(100).optional(), flipFacing: z.boolean().default(false), flipHand: z.boolean().default(false),
      })).max(200).optional(),
      wallPaint: z.array(paintedFace).max(200).optional(),
    }).superRefine((room, ctx) => {
      const faces = new Set<string>();
      for (const face of room.wallPaint ?? []) {
        const key = `${face.edgeIndex}:${face.side ?? 'interior'}`;
        if (face.edgeIndex >= room.polygon.length || faces.has(key)) ctx.addIssue({ code: 'custom', message: 'Invalid or duplicate painted wall face' });
        faces.add(key);
      }
      if (room.openings?.some(o => o.edgeIndex >= room.polygon.length)) ctx.addIssue({ code: 'custom', message: 'Opening edge is outside the room polygon' });
    })).max(100),
    walls: z.array(z.object({
      id: text, levelId: text.optional(), a: point, b: point, paintId: paintId.optional(),
      paintColourHex: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), paintColourName: z.string().max(200).optional(),
      paintFaces: z.union([z.literal(1), z.literal(2)]).optional(), exteriorPaint: paintedFace.optional(),
    })).max(500).optional(),
  }).superRefine((property, ctx) => {
    for (const entries of [property.rooms, property.walls ?? [], property.levels ?? []]) {
      if (new Set(entries.map(entry => entry.id)).size !== entries.length) ctx.addIssue({ code: 'custom', message: 'Duplicate geometry identity' });
    }
  }),
});

export function propertyPaintQuote(input: z.infer<typeof propertyPaintQuoteSchema>) {
  const property = { ...input.property, wallHeightM: input.property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M };
  const rows = wallPaintBreakdown(property);
  let litresBound = 0;
  for (const row of rows) {
    const paint = findWallPaintById(row.paintId)!;
    litresBound += row.areaM2 * coatsFor(paint, property) / paint.coverage_m2_per_l * (1 + wastePctFor(!!row.colourHex, property) / 100);
  }
  if (!Number.isFinite(litresBound) || litresBound > 5000) throw new RangeError('Quote exceeds 5,000 litres. Split the project into smaller paint schedules.');
  const lines = deriveWallPaintOrders(property);
  return {
    mode: 'property' as const, currency: 'MUR' as const, measurement_unit: 'm' as const, quote_basis: 'whole_tins' as const,
    lines, total_price_mur: Math.round(lines.reduce((total, line) => total + line.fill.totalMur, 0) * 100) / 100,
    limits: ['Prices are catalogue snapshots, not a supplier-confirmed order.', 'Two coats double unrounded paint demand; whole-tin cost can change in steps.', 'Paint openings below 1 m² are retained for cutting-in; larger clipped openings are deducted once.'],
  };
}
