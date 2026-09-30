/** Persisted, versioned inputs. Distances are metres unless the field ends in Mm. */
export interface MaterialsSettings {
  version: 1;
  scope: 'all' | 'active';
  wall: {
    kind: 'block' | 'concrete';
    presetId: string;
    /** The selected product's physical thickness, independent of the plan's display stroke. */
    thicknessM: number;
    blockLengthM: number;
    blockHeightM: number;
    dimensionBasis: 'actual' | 'nominal';
    jointMm: number;
    /** 1 = full-bed joints; smaller values must come from a supplier's bedding specification. */
    beddingFraction: number;
    wastePct: number;
  };
  mortar: VolumeMix;
  plaster: { sides: 0 | 1 | 2; thicknessMm: number; mix: VolumeMix };
  concrete: VolumeMix & { supply: 'ready-mix' | 'site-mix' };
  base: { enabled: boolean; depthM: number; /** null uses the measured ground footprint. */ areaOverrideM2: number | null };
  pillars: { count: number; widthM: number; depthM: number; heightM: number };
  roof: {
    kind: 'none' | 'reinforced-concrete' | 'sheet';
    depthM: number;
    areaOverrideM2: number | null;
    /** null uses the drawing's bounding rectangle, which is marked approximate when irregular. */
    lengthOverrideM: number | null;
    widthOverrideM: number | null;
    rebar: {
      enabled: boolean; diameterMm: number; spacingMm: number; layers: number;
      coverMm: number; stockLengthM: number; lapLengthM: number; wastePct: number;
    };
    sheet: {
      presetId: string; pitchDeg: number; slopes: 1 | 2;
      /** Effective cover already includes side lap. Never subtract a side lap again. */
      effectiveCoverM: number; sheetLengthM: number; endLapM: number;
      overhangM: number; wastePct: number; fastenersPerM2: number;
      ridgeLengthM: number; flashingLengthM: number; gutterLengthM: number;
      trimStockLengthM: number; trimLapM: number;
      /** 0 omits purlins until spacing is supplied by the roof designer. */
      purlinSpacingM: number;
    };
  };
}

export interface VolumeMix {
  /** Dry loose volume parts, not mass ratios or a certified concrete strength class. */
  cement: number; sand: number; aggregate: number;
  dryVolumeFactor: number;
  cementBulkDensityKgM3: number;
  bagKg: number;
  wastePct: number;
}

export interface MaterialWallInput {
  id: string; levelId?: string; lengthM: number; heightM: number; thicknessM?: number;
  openingAreaM2: number;
  /** Optional adapter diagnostics; the engine recomputes area from length and height. */
  grossAreaM2?: number; netAreaM2?: number;
}

export interface MaterialsGeometry {
  /** Physical walls once per storey, shared walls/openings deduplicated by the geometry adapter. */
  walls: MaterialWallInput[];
  /** Ground footprint only, not a sum of every storey's rooms. */
  baseAreaM2: number;
  /** Horizontal footprint union, excluding courtyard gaps. Roof penetrations require a verified area override. */
  roofAreaM2: number;
  roofLengthM: number;
  roofWidthM: number;
  roofRectangular: boolean;
}

export type MaterialGroup = 'walls' | 'mortar' | 'plaster' | 'base' | 'pillars' | 'roof' | 'rebar' | 'sheet' | 'totals';
export type MaterialUnit = 'blocks' | 'm²' | 'm³' | 'kg' | 'bags' | 'm' | 'bars' | 'sheets' | 'pieces';
export interface MaterialQuantityLine {
  id: string; group: MaterialGroup; label: string; unit: MaterialUnit;
  /** Net geometric quantity, before allowance; quantity includes the declared allowance and pack rounding. */
  net: number; quantity: number; wastePct: number; formula: string;
  sourceId?: string;
  /** Totals aggregate the component rows, never add them to those rows again. */
  role: 'component' | 'summary';
}

export interface MaterialsReport {
  version: 1;
  settings: MaterialsSettings;
  lines: MaterialQuantityLine[];
  warnings: string[];
  assumptions: string[];
  totals: {
    wallGrossAreaM2: number; wallOpeningAreaM2: number; wallNetAreaM2: number;
    blocks: number; mortarM3: number; plasterM3: number;
    concreteNetM3: number; concreteOrderM3: number;
    cementKg: number; cementBags: number; sandM3: number; aggregateM3: number;
    rebarKg: number; sheets: number;
  };
}
