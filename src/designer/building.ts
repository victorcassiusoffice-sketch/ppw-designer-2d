/** Whole-building geometry shared by the editor, 3D view and saved designs. */
import type { Polygon } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import { isRoofLevel, levelsOf, roofSourceLevelId, type Level } from './levels';

export const FLOOR_SLAB_THICKNESS_M = 0.18;
export const MIN_LEVEL_HEIGHT_M = 2;
export const MAX_LEVEL_HEIGHT_M = 8;

export interface BuildingStair {
  id: string;
  fromLevelId: string;
  toLevelId: string;
  /** Centre of the footprint in plan metres. At rotation 0, stairs ascend along +y. */
  x: number;
  y: number;
  widthM: number;
  runM: number;
  /** Clockwise degrees in plan. */
  rotation: number;
}

export type NewBuildingStair = Pick<BuildingStair, 'fromLevelId' | 'toLevelId'>
  & Partial<Omit<BuildingStair, 'id' | 'fromLevelId' | 'toLevelId'>>;

export interface RoofConfig {
  style: 'flat' | 'gable' | 'shed';
  material: 'felt' | 'tile' | 'metal';
  pitchDeg: number;
  overhangM: number;
}

export const DEFAULT_ROOF_CONFIG: Readonly<RoofConfig> = Object.freeze({
  style: 'flat', material: 'felt', pitchDeg: 25, overhangM: 0.2,
});

export interface BuildingLevel {
  level: Level;
  elevationM: number;
  heightM: number;
  slabThicknessM: number;
}

type BuildingProperty = Pick<Property, 'levels' | 'wallHeightM'> & Partial<Pick<Property, 'rooms'>>;

/** Optional metadata is discarded independently so malformed heights never erase a floor. */
export function normaliseLevelHeight(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= MIN_LEVEL_HEIGHT_M && value <= MAX_LEVEL_HEIGHT_M ? value : undefined;
}

export function normaliseLevelElevation(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Missing elevations are cumulative, so deleting an empty floor cannot leave a floating gap. */
export function buildingLevels(property: BuildingProperty): BuildingLevel[] {
  const levels = levelsOf(property);
  const out: BuildingLevel[] = [];
  const defaultHeight = normaliseLevelHeight(property.wallHeightM) ?? DEFAULT_WALL_HEIGHT_M;
  let nextElevation = 0;
  for (const level of levels.filter((l) => !isRoofLevel(l))) {
    const elevationM = normaliseLevelElevation(level.elevationM) ?? nextElevation;
    const heightM = normaliseLevelHeight(level.heightM) ?? defaultHeight;
    out.push({ level, elevationM, heightM, slabThicknessM: FLOOR_SLAB_THICKNESS_M });
    nextElevation = elevationM + heightM + FLOOR_SLAB_THICKNESS_M;
  }
  const roofSource = property.rooms ? roofSourceLevelId(levels, property.rooms) : null;
  const source = out.find((entry) => entry.level.id === roofSource) ?? out[out.length - 1];
  for (const level of levels.filter(isRoofLevel)) {
    out.push({
      level,
      elevationM: source ? source.elevationM + source.heightM + FLOOR_SLAB_THICKNESS_M : 0,
      heightM: 0,
      slabThicknessM: FLOOR_SLAB_THICKNESS_M,
    });
  }
  return out;
}

export function levelElevationM(property: BuildingProperty, levelId: string): number {
  return buildingLevels(property).find((entry) => entry.level.id === levelId)?.elevationM ?? 0;
}

export function levelHeightM(property: BuildingProperty, levelId: string): number {
  return buildingLevels(property).find((entry) => entry.level.id === levelId)?.heightM
    ?? normaliseLevelHeight(property.wallHeightM) ?? DEFAULT_WALL_HEIGHT_M;
}

export function roofConfigOf(property: Pick<Property, 'roof'>): RoofConfig {
  return normaliseRoofConfig(property.roof) ?? { ...DEFAULT_ROOF_CONFIG };
}

export function normaliseRoofConfig(value: unknown): RoofConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (!['flat', 'gable', 'shed'].includes(raw.style as string)
    || !['felt', 'tile', 'metal'].includes(raw.material as string)) return undefined;
  return {
    style: raw.style as RoofConfig['style'], material: raw.material as RoofConfig['material'],
    pitchDeg: typeof raw.pitchDeg === 'number' && Number.isFinite(raw.pitchDeg)
      ? Math.max(5, Math.min(60, raw.pitchDeg)) : DEFAULT_ROOF_CONFIG.pitchDeg,
    overhangM: typeof raw.overhangM === 'number' && Number.isFinite(raw.overhangM)
      ? Math.max(0, Math.min(1.5, raw.overhangM)) : DEFAULT_ROOF_CONFIG.overhangM,
  };
}

export function stairRiseM(property: BuildingProperty, stair: Pick<BuildingStair, 'fromLevelId' | 'toLevelId'>): number {
  return levelElevationM(property, stair.toLevelId) - levelElevationM(property, stair.fromLevelId);
}

export function stairStepCount(property: BuildingProperty, stair: BuildingStair): number {
  return Math.max(1, Math.ceil((stairRiseM(property, stair) - 1e-9) / 0.18));
}

/** Four footprint corners; also used to cut an opening in the destination slab. */
export function stairFootprint(stair: BuildingStair): Polygon {
  const radians = stair.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    [-stair.widthM / 2, -stair.runM / 2], [stair.widthM / 2, -stair.runM / 2],
    [stair.widthM / 2, stair.runM / 2], [-stair.widthM / 2, stair.runM / 2],
  ].map(([x, y]) => ({ x: stair.x + x * cos - y * sin, y: stair.y + x * sin + y * cos }));
}

/** Validate references as well as numbers: no stairs to deleted floors or down through a roof. */
export function normaliseBuildingStairs(value: unknown, property: BuildingProperty): BuildingStair[] {
  if (!Array.isArray(value)) return [];
  const levels = levelsOf(property);
  const seen = new Set<string>();
  const stairs: BuildingStair[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || seen.has(raw.id)) continue;
    const from = levels.find((l) => l.id === raw.fromLevelId);
    const to = levels.find((l) => l.id === raw.toLevelId);
    if (!from || !to || isRoofLevel(from) || from.id === to.id || from.index >= to.index) continue;
    if (!['x', 'y', 'widthM', 'runM', 'rotation'].every((key) => typeof raw[key] === 'number' && Number.isFinite(raw[key]))) continue;
    if (raw.widthM < 0.6 || raw.widthM > 5 || raw.runM < 1 || raw.runM > 30) continue;
    const stair: BuildingStair = {
      id: raw.id, fromLevelId: from.id, toLevelId: to.id, x: raw.x, y: raw.y,
      widthM: raw.widthM, runM: raw.runM, rotation: ((raw.rotation % 360) + 360) % 360,
    };
    const riseM = stairRiseM(property, stair);
    if (!Number.isFinite(riseM) || riseM <= 0) continue;
    seen.add(stair.id);
    stairs.push(stair);
  }
  return stairs;
}

/** Sanitize just the new fields on localStorage rehydration, preserving all older metadata. */
export function normaliseBuildingMetadata(property: Property): Property {
  const next = { ...property };
  if (property.levels) next.levels = property.levels.map((level) => {
    if (level.heightM === undefined && level.elevationM === undefined) return level;
    const clean = { ...level };
    const height = isRoofLevel(level) ? undefined : normaliseLevelHeight(level.heightM);
    const elevation = isRoofLevel(level) ? undefined : normaliseLevelElevation(level.elevationM);
    if (height === undefined) delete clean.heightM;
    else clean.heightM = height;
    if (elevation === undefined) delete clean.elevationM;
    else clean.elevationM = elevation;
    return clean;
  });
  if (property.stairs !== undefined) {
    const stairs = normaliseBuildingStairs(property.stairs, next);
    if (stairs.length > 0) next.stairs = stairs;
    else delete next.stairs;
  }
  if (property.roof !== undefined) {
    const roof = normaliseRoofConfig(property.roof);
    if (roof && levelsOf(next).some(isRoofLevel)) next.roof = roof;
    else delete next.roof;
  }
  return JSON.stringify(next) === JSON.stringify(property) ? property : next;
}
