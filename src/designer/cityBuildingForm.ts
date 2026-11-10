import type { CityAsset, CityPoint } from './city.js';

/** Unit-box geometry. Instances retain measured dimensions and can rotate independently. */
export interface CityRoomForm {
  base: number;
  top: number;
  polygon: CityPoint[];
}

export function validBuildingForm(value: unknown): value is CityRoomForm[] {
  if (!Array.isArray(value) || !value.length || value.length > 64) return false;
  let points = 0;
  return value.every(room => {
    if (!room || !Number.isFinite(room.base) || !Number.isFinite(room.top) ||
        room.base < 0 || room.top > 1 || room.top <= room.base || !Array.isArray(room.polygon) ||
        room.polygon.length < 3 || room.polygon.length > 128) return false;
    points += room.polygon.length;
    return points <= 512 && room.polygon.every((p: CityPoint) => p &&
      Number.isFinite(p.x) && Math.abs(p.x) <= 0.500001 && Number.isFinite(p.y) && Math.abs(p.y) <= 0.500001);
  });
}

export function buildingPolygons(asset: CityAsset): CityPoint[][] {
  const angle = asset.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return (asset.buildingForm ?? []).map(room => room.polygon.map(p => {
    const x = p.x * asset.widthM, y = p.y * asset.lengthM;
    return { x: asset.x + x * cos - y * sin, y: asset.y + x * sin + y * cos };
  }));
}
