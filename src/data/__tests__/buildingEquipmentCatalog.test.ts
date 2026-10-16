import { describe, expect, it } from 'vitest';
import { BUILDING_EQUIPMENT, buildingEquipmentById } from '../buildingEquipmentCatalog';
import { SERVICE_MATERIALS } from '../buildingServicesCatalog';
import { normaliseBuildingServices, SERVICE_FIXTURES } from '../../designer/buildingServices';

describe('source-backed coordination references', () => {
  it('covers every new service equipment type without inventing dimensions for a supplier family', () => {
    for (const kind of [
      'air-conditioner',
      'outdoor-ac',
      'air-grille',
      'extractor-fan',
      'sprinkler',
      'fire-extinguisher',
      'security-camera',
      'network-switch',
    ]) {
      expect(BUILDING_EQUIPMENT.some((item) => item.kind === kind)).toBe(true);
    }
    expect(new Set(BUILDING_EQUIPMENT.map((item) => item.id)).size).toBe(BUILDING_EQUIPMENT.length);
    for (const item of BUILDING_EQUIPMENT) {
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.checkedAt).toBe('2026-10-15');
      expect(item).not.toHaveProperty('price');
      if (item.referenceKind === 'family') expect(item.dimensions).toBeUndefined();
      expect(buildingEquipmentById(item.id)).toBe(item);
    }
    expect(buildingEquipmentById('unknown')).toBeUndefined();
  });
  it('preserves small verified equipment and the reference without silently replacing the user envelope', () => {
    const item = buildingEquipmentById('tplink-sg1008p-v7')!;
    const services = normaliseBuildingServices({
      version: 1,
      runs: [],
      fixtures: [
        {
          id: 'switch',
          levelId: 'ground',
          kind: item.kind,
          x: 0,
          y: 0,
          rotation: 0,
          ...item.dimensions,
          elevationM: 1.6,
          productReferenceId: item.id,
        },
      ],
    })!;
    expect(services.fixtures).toHaveLength(1);
    expect(services.fixtures[0]).toMatchObject({
      heightM: 0.027,
      elevationM: 1.6,
      productReferenceId: item.id,
    });
    const custom = normaliseBuildingServices({
      ...services,
      fixtures: [{ ...services.fixtures[0], widthM: 0.5 }],
    })!;
    expect(custom.fixtures[0].widthM).toBe(0.5);
    expect(SERVICE_FIXTURES[item.kind].heightM).not.toBe(item.dimensions!.heightM);
  });
  it('keeps pipe size designations, actual outside diameter and paired coil quantities distinct', () => {
    expect(SERVICE_MATERIALS.find((item) => item.id === 'wheatland-sch10-1')).toMatchObject({
      nominalDiameterMm: 25.4,
      outerDiameterMm: 33.4,
    });
    expect(
      SERVICE_MATERIALS.find((item) => item.id === 'daikin-copper-6.35')?.stockLengthM,
    ).toBeUndefined();
    for (const system of ['ventilation', 'refrigerant', 'fire-water', 'data']) {
      expect(SERVICE_MATERIALS.some((item) => item.system === system)).toBe(true);
    }
    for (const item of SERVICE_MATERIALS) expect(item.nominalDiameterMm).toBeGreaterThan(0);
  });
});
