/** What the build feedback reacts to: counts read from the design. Pure. */
import type { Property } from '../../store/propertyStore';
import type { BuildSound } from './sound';

/** The counts the feedback reacts to. */
export interface BuildCounts {
  items: number;
  openings: number;
  rooms: number;
  walls: number;
  paint: string;
  floor: number;
  cladding: string;
}

export function buildCounts(property: Property): BuildCounts {
  let items = 0;
  let openings = 0;
  let rooms = 0;
  let floor = 0;
  const paint: string[] = [];
  const cladding: string[] = [];
  for (const room of property.rooms) {
    items += room.placedItems?.length ?? 0;
    openings += room.openings?.length ?? 0;
    if ((room.polygon?.length ?? 0) >= 3) rooms += 1;
    for (const edge of room.wallPaint ?? []) paint.push(`${room.id}:${edge.edgeIndex}:${edge.side ?? ''}:${edge.paintId}:${edge.colourHex ?? ''}`);
    for (const edge of room.wallCladding ?? []) cladding.push(`${room.id}:${JSON.stringify(edge)}`);
    for (const zone of room.floorTiles ?? []) floor += zone.runs.length + zone.materialId.length;
    if (room.floorFinish?.materialId) floor += 1000 + room.floorFinish.materialId.length;
  }
  for (const wall of property.walls ?? []) {
    paint.push(`${wall.id}:${wall.paintId ?? ''}:${wall.paintColourHex ?? ''}:${wall.exteriorPaint?.paintId ?? ''}`);
  }
  return { items, openings, rooms, walls: property.walls?.length ?? 0, paint: paint.join('|'), floor, cladding: cladding.join('|') };
}

/** Which sound a change of the design makes (undo is decided by the caller). */
export function soundForChange(before: BuildCounts, after: BuildCounts): BuildSound | null {
  if (after.items > before.items || after.openings > before.openings || after.rooms > before.rooms) return 'place';
  if (after.walls > before.walls) return 'snap';
  if (after.items < before.items || after.openings < before.openings || after.rooms < before.rooms || after.walls < before.walls) return 'remove';
  if (after.paint !== before.paint || after.floor !== before.floor || after.cladding !== before.cladding) return 'paint';
  return null;
}
