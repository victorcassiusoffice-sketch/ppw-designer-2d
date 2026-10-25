import type { Property, Room } from '../store/propertyStore';
import type { MaterialsSettings } from './materials';
import { isOutdoorRoom, isRoofRoom } from './levels';

/** One explicit whole-building masonry specification, shared by drawing and takeoff.
 * Existing glass specifications and all measured centre lines remain unchanged. */
export function withMasonryThickness(property: Property, settings: MaterialsSettings): Property {
  return { ...property, materials: settings,
    rooms: property.rooms.map(room => inheritMasonryRoom(room, settings)),
    ...(property.walls ? { walls: property.walls.map(wall => wall.construction === 'glass' ? wall : { ...wall, thicknessM: settings.wall.thicknessM }) } : {}),
  };
}

/** New or reshaped rooms inherit an explicitly saved specification, not a second default. */
export function inheritMasonryRoom(room: Room, settings?: MaterialsSettings): Room {
  if (!settings || isOutdoorRoom(room) || isRoofRoom(room)) return room;
  const thicknessMm = settings.wall.thicknessM * 1000;
  return { ...room, wallConstruction: room.polygon.map((_, edgeIndex) => {
    const current = room.wallConstruction?.find(edge => edge.edgeIndex === edgeIndex);
    return current?.kind === 'glass' ? current : { edgeIndex, kind: current?.kind ?? 'plastered-brick', thicknessMm };
  }) };
}
