import { cmToM, rotatedFootprint } from '../lib/geometry';
import type { Room, PlacedItem } from '../store/propertyStore';
import type { Product } from '../data/products.schema';
import { placementKind } from './attachmentPlacement';
import { openingSillM } from './openingGeometry';

/** A layout hint only: not an accessibility or building-code assessment. */
export function objectAccessWarnings(room: Room, item: PlacedItem, product: Product): string[] {
  if (placementKind(product) !== 'floor') return [];
  const { w, h } = rotatedFootprint({ lengthM: cmToM(product.dimensions_cm.length), widthM: cmToM(product.dimensions_cm.width) }, item.rotation);
  const corners = [{ x: item.x, y: item.y }, { x: item.x + w, y: item.y }, { x: item.x + w, y: item.y + h }, { x: item.x, y: item.y + h }];
  const warnings = new Set<string>();
  for (const opening of room.openings ?? []) {
    if (opening.kind === 'hole') continue;
    const a = room.polygon[opening.edgeIndex];
    const b = room.polygon[(opening.edgeIndex + 1) % room.polygon.length];
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-6) continue;
    if (opening.kind === 'window' && cmToM(product.dimensions_cm.height) <= openingSillM(opening)) continue;
    const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
    const along = corners.map(p => (p.x - a.x) * dx + (p.y - a.y) * dy);
    const across = corners.map(p => (p.x - a.x) * -dy + (p.y - a.y) * dx);
    const near = opening.kind === 'window' ? 0.2 : Math.max(0.45, opening.widthM);
    if (Math.max(...along) > opening.offsetM - opening.widthM / 2 && Math.min(...along) < opening.offsetM + opening.widthM / 2
      && Math.max(...across) > -near && Math.min(...across) < near) {
      warnings.add(opening.kind === 'window' ? 'May block this window — check access.' : 'May block this door — check the opening and swing.');
    }
  }
  return [...warnings];
}
