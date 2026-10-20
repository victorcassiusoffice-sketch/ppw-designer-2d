import { describe, expect, it } from 'vitest';
import { greenRoofLoad, normaliseEco, treeProtectionRadiusM, type EcoTree } from '../eco';
import { reviewProject, PROJECT_REVIEW_SOURCES } from '../projectReview';
import { defaultFoundationRebar, type FoundationElement } from '../foundation';
import type { Property } from '../../store/propertyStore';
import { emptyCity } from '../city';

const tree = (patch: Partial<EcoTree> = {}): EcoTree => ({
  id: 'tree',
  name: 'Measured tree',
  x: 4,
  y: 0,
  heightM: 6,
  canopyRadiusM: 2,
  status: 'existing',
  protectionMethod: 'bs5837-single-stem',
  stemDiameterMm: 100,
  ...patch,
});
const footing = (patch: Partial<FoundationElement> = {}): FoundationElement => ({
  id: 'footing',
  name: 'Pad',
  kind: 'pad',
  x: 0,
  y: 0,
  lengthM: 2,
  widthM: 2,
  depthM: 0.3,
  topElevationM: -0.2,
  rebar: defaultFoundationRebar(),
  ...patch,
});
const property = (): Property => ({
  id: 'p',
  name: 'Review',
  activeRoomId: 'roof',
  rooms: [
    {
      id: 'roof',
      name: 'Roof',
      kind: 'roof',
      levelId: 'roof',
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
      placedItems: [],
    },
  ],
  levels: [
    { id: 'ground', name: 'Ground', index: 0 },
    { id: 'roof', name: 'Roof', index: 1, kind: 'roof' },
  ],
});
const rules = (p: Property) => reviewProject(p).findings.map((f) => f.ruleId);

describe('measured eco models', () => {
  it('keeps a missing root assessment unknown and converts mm to metres for the named single-stem method', () => {
    expect(treeProtectionRadiusM(tree())).toBeCloseTo(1.2);
    expect(treeProtectionRadiusM(tree({ stemDiameterMm: 2000 }))).toBe(15);
    expect(treeProtectionRadiusM(tree({ stemDiameterMm: undefined }))).toBeNull();
    expect(treeProtectionRadiusM(tree({ veteran: true }))).toBeNull();
    expect(treeProtectionRadiusM(tree({ protectionMethod: 'unconfirmed' }))).toBeNull();
    expect(
      treeProtectionRadiusM(tree({ protectionMethod: 'surveyed', protectionRadiusM: 19 })),
    ).toBe(19);
  });
  it('rejects the complete invalid model instead of clamping size, dropping duplicate roofs or accepting unknown fields', () => {
    const value = { version: 1, trees: [tree()], greenRoofs: [] };
    expect(normaliseEco(JSON.parse(JSON.stringify(value)))).toEqual(value);
    for (const extra of [
      { trees: [tree({ heightM: Infinity })] },
      { trees: [tree(), tree()] },
      { unsafe: true },
      { version: 2 },
    ])
      expect(normaliseEco({ ...value, ...extra })).toBeUndefined();
    expect(
      normaliseEco({
        ...value,
        greenRoofs: [
          { id: 'a', name: 'A', roomId: 'roof' },
          { id: 'b', name: 'B', roomId: 'roof' },
        ],
      }),
    ).toBeUndefined();
  });
  it('adds only explicitly additional water, preserves unknown mass and validates the roof area', () => {
    const p = property(),
      roof = {
        id: 'green',
        name: 'Green',
        roomId: 'roof',
        saturatedKgM2: 120,
        extraRetainedWaterMm: 10,
      };
    const load = greenRoofLoad(p, roof);
    expect(load).toMatchObject({ areaM2: 20, totalKgM2: 130, totalMassKg: 2600, areaValid: true });
    expect(load.additionalLoadKPa).toBeCloseTo(1.2748645);
    expect(greenRoofLoad(p, { ...roof, saturatedKgM2: undefined }).totalMassKg).toBeNull();
    expect(greenRoofLoad(p, { ...roof, areaM2: 20.01 }).totalMassKg).toBeNull();
    expect(greenRoofLoad(p, { ...roof, roomId: 'deleted' })).toMatchObject({
      hasRoof: false,
      areaValid: false,
      areaM2: null,
    });
    expect(greenRoofLoad({ rooms: [{ ...p.rooms[0], kind: 'room' }] }, roof).hasRoof).toBe(false);
  });
});

describe('versioned project engineering review', () => {
  it('screens bore-only designs for missing ground/design inputs and actual circular tree protection conflicts', () => {
    const p = property();
    p.foundation = {
      version: 1,
      enabled: true,
      elements: [],
      bores: [
        {
          id: 'bore',
          name: 'Bore',
          x: 0,
          y: 0,
          diameterM: 2,
          depthM: 3,
          topElevationM: 0,
        },
      ],
    };
    p.eco = { version: 1, greenRoofs: [], trees: [tree({ x: 2, y: 0 })] };
    expect(rules(p)).toEqual(
      expect.arrayContaining([
        'foundation-design-inputs',
        'excavation-support',
        'tree-bore-conflict',
      ]),
    );
    const inputs = reviewProject(p).findings.find((f) => f.ruleId === 'foundation-design-inputs')!;
    expect(inputs.missingData.join(' ')).toContain('Geotechnical');
    expect(inputs.missingData).not.toContain('Specified concrete grade');
    p.eco.trees[0].x = 3;
    expect(rules(p)).not.toContain('tree-bore-conflict');
    p.foundation.bores!.push({ ...p.foundation.bores![0], id: 'overlap', x: 0.5 });
    expect(rules(p)).toContain('excavation-union-incomplete');
  });
  it('declares incomplete screening when a dense model exceeds its geometric work bound', () => {
    const p = property();
    p.eco = {
      version: 1,
      greenRoofs: [],
      trees: Array.from({ length: 300 }, (_, i) => tree({ id: `tree-${i}`, x: 2000 })),
    };
    p.services = {
      version: 1,
      fixtures: [],
      runs: [
        {
          id: 'dense',
          levelId: 'ground',
          system: 'cold-water',
          materialId: 'unknown',
          diameterMm: 20,
          startElevationM: -1,
          endElevationM: -1,
          points: Array.from({ length: 500 }, (_, i) => ({ x: i, y: i % 2 })),
        },
      ],
    };
    const report = reviewProject(p);
    expect(report.screeningComplete).toBe(false);
    expect(report.findings.find((f) => f.ruleId === 'review-limit')?.severity).toBe('critical');
    expect(report.status).toBe('unverified');
  });
  it('returns deterministic JSON with evidence, missing inputs and no approval even when references are supplied', () => {
    const p = property();
    p.engineering = {
      version: 1,
      structuralDesignRef: 'Engineer drawing S1',
      geotechnicalReportRef: 'GI1',
    };
    p.eco = { version: 1, trees: [], greenRoofs: [{ id: 'g', name: 'Green', roomId: 'roof' }] };
    const before = JSON.stringify(p),
      report = reviewProject(p);
    expect(report).toEqual(reviewProject(JSON.parse(before)));
    expect(JSON.stringify(p)).toBe(before);
    expect(report.status).toBe('unverified');
    expect(report.engineVersion).toBe('1.0.0');
    expect(report.screeningComplete).toBe(true);
    const load = report.findings.find((f) => f.ruleId === 'green-roof-load')!;
    expect(load.missingData).toContain('Manufacturer saturated assembly mass');
    expect(load.evidence.find((e) => e.label === 'Added mass')?.value).toBeNull();
    const ids = new Set(PROJECT_REVIEW_SOURCES.map((s) => s.id));
    expect(
      report.findings.every((f) =>
        f.sourceIds.every((id) => ids.has(id as (typeof PROJECT_REVIEW_SOURCES)[number]['id'])),
      ),
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
  it('checks excavation margins, not just the narrower concrete body, and resolves after moving the tree', () => {
    const p = property();
    p.foundation = {
      version: 1,
      enabled: true,
      elements: [
        footing({ excavation: { depthM: 1, topElevationM: 0, marginM: 2, stage: 'excavated' } }),
      ],
    };
    p.eco = { version: 1, trees: [tree()], greenRoofs: [] };
    expect(rules(p)).toContain('tree-foundation-conflict');
    p.eco.trees[0].x = 8;
    expect(rules(p)).not.toContain('tree-foundation-conflict');
  });
  it('uses the actual closest point at a footing corner rather than axis-only overlap', () => {
    const p = property();
    p.foundation = { version: 1, enabled: true, elements: [footing()] };
    p.eco = {
      version: 1,
      trees: [tree({ x: 2, y: 2, protectionMethod: 'surveyed', protectionRadiusM: 1.4 })],
      greenRoofs: [],
    };
    expect(rules(p)).not.toContain('tree-foundation-conflict');
    p.eco.trees[0].protectionRadiusM = 1.5;
    expect(rules(p)).toContain('tree-foundation-conflict');
  });
  it('uses the city utility trench envelope and excludes services entirely above the ground datum', () => {
    const p = property();
    p.eco = { version: 1, trees: [tree({ x: 0 })], greenRoofs: [] };
    p.city = {
      ...emptyCity(),
      enabled: true,
      networks: [
        {
          id: 'main',
          name: 'Main',
          system: 'water',
          points: [
            { x: 2, y: -10, z: -1 },
            { x: 2, y: 10, z: -1 },
          ],
          diameterMm: 100,
          trenchWidthM: 2,
          trenchDepthM: 1,
        },
      ],
    };
    expect(rules(p)).toContain('tree-city-utility-conflict');
    p.city.networks[0].trenchWidthM = 0.2;
    expect(rules(p)).not.toContain('tree-city-utility-conflict');
    p.services = {
      version: 1,
      fixtures: [],
      runs: [
        {
          id: 'upstairs',
          levelId: 'roof',
          system: 'cold-water',
          materialId: 'unknown',
          diameterMm: 20,
          points: [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
          ],
          startElevationM: -0.1,
          endElevationM: -0.1,
        },
      ],
    };
    expect(rules(p)).not.toContain('tree-service-conflict');
    p.services.runs[0].levelId = 'ground';
    expect(rules(p)).toContain('tree-service-conflict');
  });
  it('flags canopy plan overlap and unknown veteran protection without inventing roots', () => {
    const p = property();
    p.rooms.push({ ...p.rooms[0], id: 'ground-room', kind: 'room', levelId: 'ground' });
    p.eco = { version: 1, trees: [tree({ x: 6, y: 2, veteran: true })], greenRoofs: [] };
    expect(rules(p)).toContain('tree-canopy-conflict');
    expect(rules(p)).toContain('tree-rpa-missing');
  });
  it('reports excess green-roof load, missing references and stale roof ids', () => {
    const p = property();
    p.eco = {
      version: 1,
      trees: [],
      greenRoofs: [
        {
          id: 'g',
          name: 'Green',
          roomId: 'roof',
          saturatedKgM2: 200,
          additionalLoadCapacityKPa: 1,
        },
      ],
    };
    const load = reviewProject(p).findings.find((f) => f.ruleId === 'green-roof-load')!;
    expect(load.severity).toBe('critical');
    expect(load.missingData).toContain('Capacity assessment reference');
    p.eco.greenRoofs[0].roomId = 'removed';
    expect(rules(p)).toContain('green-roof-area');
  });
  it('marks zero-lap steel, missing foundation inputs and reversed drainage for review', () => {
    const p = property();
    p.foundation = {
      version: 1,
      enabled: true,
      elements: [footing({ lengthM: 10, rebar: { ...defaultFoundationRebar(), enabled: true } })],
    };
    p.services = {
      version: 1,
      fixtures: [],
      runs: [
        {
          id: 'drain',
          levelId: 'ground',
          system: 'waste',
          materialId: 'unknown',
          diameterMm: 110,
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
          ],
          startElevationM: -0.5,
          endElevationM: -0.2,
        },
      ],
    };
    expect(rules(p)).toEqual(
      expect.arrayContaining([
        'foundation-steel-lap',
        'foundation-design-inputs',
        'foundation-steel-incomplete',
        'drainage-no-fall',
        'service-specification',
      ]),
    );
  });
});
