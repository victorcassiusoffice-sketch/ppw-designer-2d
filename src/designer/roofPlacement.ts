/** Find a real free plan slot for the catalog's centre-add action on a roof. */
import { getProductById } from '../data/products';
import type { Product } from '../data/products.schema';
import { findFreeSlot, polygonBounds, rotatedFootprint, type Vertex } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { roofConfigOf } from './building';
import { isRoofProduct } from './energy';
import { isRoofRoom } from './levels';
import { createRoofSurface } from './roofSurface';
import { fillLatticeInside, tileLatticeFor } from './flooringLattice';

export function roofPlacementPoint(property: Property, product: Product, step = 0.05): Vertex | null {
  if (!isRoofProduct(product)) return null;
  const w = product.dimensions_cm.length / 100, h = product.dimensions_cm.width / 100;
  const rooms = property.rooms.filter((room) => isRoofRoom(room) && room.polygon.length >= 3)
    .sort((a, b) => Number(b.id === property.activeRoomId) - Number(a.id === property.activeRoomId));
  for (const room of rooms) {
    const bounds = polygonBounds(room.polygon);
    let x = (bounds.minX + bounds.maxX) / 2, y = (bounds.minY + bounds.maxY) / 2;
    const surface = createRoofSurface(room.polygon, 0, roofConfigOf(property));
    // Prefer one gable face; a centre/ridge mount is only needed when no
    // ordinary slot fits. The shared plan validator still commits placement.
    if (surface?.config.style === 'gable') {
      if (surface.axis === 'x') x = (bounds.minX + x) / 2;
      else y = (bounds.minY + y) / 2;
    }
    const others = room.placedItems.flatMap((item) => {
      const other = getProductById(item.productId);
      if (!other || !isRoofProduct(other)) return [];
      const footprint = rotatedFootprint({ lengthM: other.dimensions_cm.length / 100, widthM: other.dimensions_cm.width / 100 }, item.rotation);
      return [{ x: item.x, y: item.y, w: footprint.w, h: footprint.h, instanceId: item.instanceId }];
    });
    // PV shares the plan's panel array lattice. Choose an unoccupied cell
    // first so the shared placement action does not snap onto a neighbour.
    const lattice = tileLatticeFor({ productId: product.id, fp: { lengthM: w, widthM: h }, rotationDeg: 0, polygon: room.polygon, items: room.placedItems });
    const cells = fillLatticeInside({ lat: lattice, polygon: room.polygon, others });
    const nearest = cells.sort((a, b) => Math.hypot(a.x + w / 2 - x, a.y + h / 2 - y) - Math.hypot(b.x + w / 2 - x, b.y + h / 2 - y))[0];
    if (nearest) return { x: nearest.x + w / 2, y: nearest.y + h / 2 };
    // Auto-placement need not enumerate every centimetre of a large roof.
    // Keep this coarser search aligned to the customer's actual snap grid.
    const searchStep = Math.max(step, Math.ceil(0.25 / step) * step);
    const slot = findFreeSlot({ preferredX: x - w / 2, preferredY: y - h / 2, w, h, others, polygon: room.polygon, step: searchStep });
    if (slot) return { x: slot.x + w / 2, y: slot.y + h / 2 };
  }
  return null;
}
