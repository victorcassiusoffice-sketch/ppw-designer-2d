import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessEstimateEvidence, ESTIMATE_ENGINE_EVIDENCE } from '../estimateEvidence';
import { getAllProducts } from '../../data/products';
import type { Property } from '../../store/propertyStore';

const blank = (): Property => ({ id: 'p', name: 'Project', activeRoomId: 'r', rooms: [{ id: 'r', name: 'Room', polygon: [], placedItems: [] }] });
describe('estimate evidence, not accuracy claims', () => {
  it('inventories distinct real implementation and test files, without counting helper names as engines', () => {
    expect(ESTIMATE_ENGINE_EVIDENCE).toHaveLength(12);
    expect(new Set(ESTIMATE_ENGINE_EVIDENCE.map(engine => engine.module)).size).toBe(12);
    for (const engine of ESTIMATE_ENGINE_EVIDENCE) {
      expect(existsSync(engine.module)).toBe(true);
      expect(existsSync(engine.testFile)).toBe(true);
      expect(readFileSync(engine.module, 'utf8')).toMatch(/export (function|const|interface)/);
      expect(engine.inputs).toBeTruthy(); expect(engine.output).toBeTruthy(); expect(engine.limit).toBeTruthy();
    }
  });
  it('empty input and absent source data stay unverified rather than becoming a perfect score', () => {
    const result = assessEstimateEvidence(blank());
    expect(result.inputCoverage).toEqual({ present: 0, total: 3 });
    expect(result.sources).toMatchObject({ recorded: 0, total: 0, verification: 'not-verified' });
    expect(result.empiricalAccuracy.status).toBe('unavailable');
    expect(result.empiricalAccuracy.reason).toContain('final supplier invoices');
    expect(JSON.stringify(result)).not.toMatch(/accuracyPct|accuracyPercent|confidencePct/);
  });
  it('counts unique placed product references and valid dimensions without exposing their names or values', () => {
    const product = { ...getAllProducts()[0], id: 'sku', name: 'Private merchant item', source_url: 'https://example.com/reference', dimensions_cm: { length: 80, width: 48, height: 17 } };
    const property = blank(); property.rooms[0].placedItems = [1, 2].map(n => ({ instanceId: `i${n}`, productId: product.id, x: n, y: 1, rotation: 0 }));
    const result = assessEstimateEvidence(property, id => id === product.id ? product : undefined);
    expect(result.sources).toMatchObject({ recorded: 1, total: 1, verification: 'not-verified' });
    expect(result.checks.find(row => row.id === 'dimensions')?.status).toBe('present');
    expect(JSON.stringify(result)).not.toContain(product.name);
    expect(JSON.stringify(result)).not.toContain(product.supplier);
    expect(result.empiricalAccuracy.status).toBe('unavailable');
  });
  it('unknown products, non-web source strings and invalid dimensions do not count as present', () => {
    const product = { ...getAllProducts()[0], source_url: 'javascript:bad()', dimensions_cm: { length: 80, width: NaN, height: 17 } };
    const property = blank(); property.rooms[0].placedItems = [{ instanceId: 'i', productId: product.id, x: 1, y: 1, rotation: 0 }, { instanceId: 'j', productId: 'missing', x: 2, y: 2, rotation: 0 }];
    const result = assessEstimateEvidence(property, id => id === product.id ? product : undefined);
    expect(result.sources.recorded).toBe(0);
    expect(result.checks.find(row => row.id === 'dimensions')?.status).toBe('review');
    expect(result.checks.find(row => row.id === 'sources')?.status).toBe('review');
  });
  it('records reference presence but never converts document text into engineering approval', () => {
    const property = blank(); property.foundation = { version: 1, enabled: true, elements: [] };
    property.engineering = { version: 1, geotechnicalReportRef: 'Reference A', structuralDesignRef: 'Reference B' };
    const result = assessEstimateEvidence(property);
    expect(result.sources.engineeringReferences).toBe(2);
    expect(result.sources.verification).toBe('not-verified');
    expect(result.checks.find(row => row.id === 'foundation-reference')?.status).toBe('present');
    expect(result.checks.find(row => row.id === 'foundation-reference')?.detail).toContain('not verified');
  });
  it('does not mutate the stored project or run quantity / cost calculations', () => {
    const property = blank(); property.wallHeightM = 2.7;
    property.rooms[0].polygon = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    const before = JSON.stringify(property);
    expect(assessEstimateEvidence(property).inputCoverage).toEqual({ present: 2, total: 3 });
    expect(JSON.stringify(property)).toBe(before);
  });
});
