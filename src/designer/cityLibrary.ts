import { buildingLevels } from './building';
import type { Property } from '../store/propertyStore';
import type { CityAsset } from './city';
import { validBuildingForm, type CityRoomForm } from './cityBuildingForm';

export interface LibraryBuilding {
  id: string;
  name: string;
  widthM: number;
  lengthM: number;
  heightM: number;
  buildingForm: CityRoomForm[];
}
export const LIBRARY_KEY = 'olb.city.buildings.v1';
const fits = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;

function validEntry(entry: LibraryBuilding) {
  return entry && typeof entry.id === 'string' && typeof entry.name === 'string' && entry.name.trim() &&
    entry.name.length <= 80 && fits(entry.widthM, .05, 1000) && fits(entry.lengthM, .05, 1000) &&
    fits(entry.heightM, .01, 500) && validBuildingForm(entry.buildingForm);
}

export function readLibrary(): LibraryBuilding[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 24).filter(validEntry) : [];
  } catch { return []; }
}

export function captureBuilding(property: Property, name: string, id: string): LibraryBuilding {
  const levels = buildingLevels(property).filter(l => l.heightM > 0);
  const rooms = property.rooms.filter(r => r.kind !== 'outdoor' && r.kind !== 'roof' && r.polygon.length >= 3)
    .map(r => ({ polygon: r.polygon, level: levels.find(l => l.level.id === (r.levelId ?? 'ground')) }));
  if (!rooms.length || rooms.some(r => !r.level)) throw new Error('Draw an enclosed room on a building floor first.');
  const vertices = rooms.flatMap(r => r.polygon);
  if (vertices.length > 512) throw new Error('This building exceeds the city model limit of 512 outline points.');
  const xs = vertices.map(p => p.x), ys = vertices.map(p => p.y);
  const xmin = Math.min(...xs), ymin = Math.min(...ys);
  const widthM = Math.max(...xs) - xmin, lengthM = Math.max(...ys) - ymin;
  const floor = Math.min(0, ...rooms.map(r => r.level!.elevationM));
  const heightM = Math.max(...rooms.map(r => r.level!.elevationM + r.level!.heightM)) - floor;
  const entry = { id, name: name.trim().slice(0, 80), widthM, lengthM, heightM,
    buildingForm: rooms.map(({ polygon, level }) => ({
      base: (level!.elevationM - floor) / heightM,
      top: (level!.elevationM + level!.heightM - floor) / heightM,
      polygon: polygon.map(p => ({ x: (p.x - xmin) / widthM - .5, y: (p.y - ymin) / lengthM - .5 })),
    })) };
  if (!validEntry(entry)) throw new Error('Check building name, floor heights and measured room outlines.');
  return entry;
}

export function placeBuilding(entry: LibraryBuilding, id: string, x: number, y: number): CityAsset {
  return { ...structuredClone(entry), id, kind: 'building', x, y, rotation: 0 };
}
