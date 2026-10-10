import { describe, expect, it } from 'vitest';
import { dispatchDesignMcp, DESIGN_MCP_TOOLS } from '../_lib/designMcp';
import { defaultFoundationRebar, estimateFoundation } from '../../src/designer/foundation';
import { normaliseMaterialsSettings, estimateMaterials } from '../../src/designer/materials';
import { materialsProcurement, setMaterialRate } from '../../src/designer/materials/costs';
import { createGuidedDesign, validateDesignDraft } from '../../src/designer/aiDesignContract';
import { designDraftToProperty } from '../../src/designer/aiDesignProperty';
import { designCatalog } from '../_lib/designAssistant';
import { validateSnapshotFoundation } from '../_lib/designSnapshotValidation';

function call(name: string, args: Record<string, unknown> = {}) {
  return dispatchDesignMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).body;
}
const element = { id: 'slab-1', name: 'Measured slab', kind: 'slab' as const, x: 5, y: 4, lengthM: 10, widthM: 8, depthM: .2, topElevationM: 0, rebar: defaultFoundationRebar() };
const foundation = { version: 1 as const, enabled: true, elements: [element] };
const geometry = { walls: [], baseAreaM2: 80, roofAreaM2: 80, roofLengthM: 10, roofWidthM: 8, roofRectangular: true };

describe('read-only foundation and materials MCP', () => {
  it('publishes complete bounded foundation input and only read-only annotations', () => {
    expect(call('get_foundation_schema')).toMatchObject({ result: { isError: false, structuredContent: { version: 1, example: foundation, concreteDefaults: { supply: 'ready-mix' } } } });
    for (const name of ['get_foundation_schema', 'estimate_foundation', 'estimate_materials'])
      expect(DESIGN_MCP_TOOLS.find(tool => tool.name === name)?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
  });

  it('runs the exact shared engine and does not mutate the supplied plan', () => {
    const before = JSON.stringify(foundation);
    const concrete = normaliseMaterialsSettings().concrete;
    expect(call('estimate_foundation', { foundation })).toMatchObject({ result: { isError: false, structuredContent: { foundation, concrete, estimate: estimateFoundation(foundation, concrete) } } });
    expect(JSON.stringify(foundation)).toBe(before);
  });

  it('counts overlapping slab/pad concrete once and applies site-mix allowance once', () => {
    const model = { ...foundation, elements: [element, { ...element, id: 'pad-1', kind: 'pad', lengthM: 2, widthM: 2, depthM: .5 }] };
    expect(call('estimate_foundation', { foundation: model, concrete: { supply: 'site-mix', cement: 1, sand: 2, aggregate: 3, wastePct: 0 } })).toMatchObject({ result: { isError: false, structuredContent: { estimate: {
      volumeM3: expect.closeTo(17.2, 10), overlapM3: expect.closeTo(.8, 10), concreteOrderM3: expect.closeTo(17.2, 10), mix: { wetM3: expect.closeTo(17.2, 10) },
    } } } });
  });

  it.each([
    { ...foundation, elements: [{ ...element, depthM: -1 }] },
    { ...foundation, elements: [element, element] },
    { ...foundation, elements: [{ ...element, rebar: { ...element.rebar, lapLengthM: 6 } }] },
    { ...foundation, elements: [{ ...element, depthM: .1, rebar: { ...element.rebar, enabled: true, coverMm: 100 } }] },
    { ...foundation, elements: [{ ...element, x: Infinity }] },
    { ...foundation, elements: [{ ...element, engineerApproved: true }] },
    { ...foundation, elements: Array.from({ length: 101 }, (_, i) => ({ ...element, id: String(i) })) },
  ])('rejects the entire malformed foundation, never clamps it', invalid => {
    const response = call('estimate_foundation', { foundation: invalid });
    expect(response).toMatchObject({ result: { isError: true } });
    expect(JSON.stringify(response)).not.toContain('concreteOrderM3');
  });

  it.each([{ cement: 0 }, { aggregate: -1 }, { dryVolumeFactor: 4 }, { bagKg: 0 }, { supply: 'structurally-approved' }, { makeOrder: true }])('rejects invalid concrete input', concrete => {
    expect(call('estimate_foundation', { foundation, concrete })).toMatchObject({ result: { isError: true } });
  });

  it('replaces the legacy base with the enabled foundation without double-counting', () => {
    expect(call('estimate_materials', { geometry, foundation, settings: { base: { enabled: true, depthM: .4 }, concrete: { wastePct: 0 } } })).toMatchObject({ result: { isError: false, structuredContent: {
      report: { totals: { concreteNetM3: 16, concreteOrderM3: 16 } }, costs: { complete: false, unpricedLines: 1 },
    } } });
    expect(call('estimate_materials', { geometry, foundation: { ...foundation, elements: [] }, settings: { base: { enabled: true, depthM: .4 } } })).toMatchObject({ result: { isError: false, structuredContent: { report: { totals: { concreteNetM3: 0 } } } } });
  });

  it('retains declared tax basis, quantities and supplied matching rates', () => {
    const settings = normaliseMaterialsSettings({ quotationTaxBasis: 'inclusive', base: { enabled: true, depthM: .2 }, concrete: { wastePct: 0 } });
    const lines = materialsProcurement(estimateMaterials(geometry, settings));
    const line = lines.find(item => item.unit === 'm³')!;
    settings.unitRates = { [line.id]: { mur: 100, unit: line.unit, specification: line.specification, taxBasis: 'inclusive' } };
    expect(call('estimate_materials', { geometry, settings })).toMatchObject({ result: { isError: false, structuredContent: { costs: { complete: true, knownSubtotalMur: 1600 } } } });
    settings.unitRates[line.id].taxBasis = 'exclusive';
    expect(call('estimate_materials', { geometry, settings })).toMatchObject({ result: { isError: false, structuredContent: { costs: { complete: false } } } });
  });

  it('withholds a complete quotation when overlapping reinforced schedules are unresolved', () => {
    const reinforced = { ...element, rebar: { ...element.rebar, enabled: true } };
    expect(call('estimate_materials', { geometry, foundation: { ...foundation, elements: [reinforced, { ...reinforced, id: 'overlap' }] } })).toMatchObject({ result: { isError: false, structuredContent: {
      foundation: { rebarComplete: false }, costs: { complete: false, incompleteReasons: expect.arrayContaining([expect.stringContaining('overlap')]) },
    } } });
  });

  it.each([false, true])('reports pending fill as incomplete even with matching quotation rates (overlap: %s)', overlapping => {
    const model = { ...foundation, elements: [element, { ...element, id: 'pending', x: overlapping ? 5 : 25,
      excavation: { depthM: 1, topElevationM: 0, marginM: .25, stage: 'excavated' as const } }] };
    let settings = normaliseMaterialsSettings({ quotationTaxBasis: 'inclusive', base: { enabled: true, depthM: .4 }, concrete: { wastePct: 0 } });
    const quantities = estimateMaterials({ ...geometry, foundationVolumeM3: 16 }, settings);
    for (const line of materialsProcurement(quantities)) settings = setMaterialRate(settings, line, 100);
    expect(call('estimate_materials', { geometry, foundation: model, settings })).toMatchObject({ result: { isError: false, structuredContent: {
      report: { totals: { concreteNetM3: 16, concreteOrderM3: 16 } },
      foundation: { volumeM3: 16, plannedConcreteVolumeM3: overlapping ? 16 : 32, pendingConcreteM3: overlapping ? 0 : 16, concreteComplete: false },
      costs: { complete: false, unpricedLines: 0, knownSubtotalMur: 1600,
        incompleteReasons: expect.arrayContaining([expect.stringContaining('awaits concrete')]) },
    } } });
    expect(call('estimate_foundation', { foundation: model })).toMatchObject({ result: { isError: false, structuredContent: {
      estimate: { concreteComplete: false, pendingConcreteM3: overlapping ? 0 : 16 },
    } } });
  });

  it.each(['missing rectangle', 'impossible depth'] as const)('does not quote omitted enabled roof steel as complete through MCP: %s', failure => {
    const measured = failure === 'missing rectangle' ? { ...geometry, roofLengthM: 0, roofWidthM: 0 } : geometry;
    let settings = normaliseMaterialsSettings({ quotationTaxBasis: 'inclusive', roof: { kind: 'reinforced-concrete',
      depthM: failure === 'impossible depth' ? .01 : .15,
      rebar: { enabled: true, coverMm: 25, diameterMm: 10, layers: 1 } } });
    for (const line of materialsProcurement(estimateMaterials(measured, settings))) settings = setMaterialRate(settings, line, 100);
    const reason = failure === 'missing rectangle' ? 'verified roof length and width' : 'cannot fit within the slab depth';
    expect(call('estimate_materials', { geometry: measured, settings })).toMatchObject({ result: { isError: false, structuredContent: {
      report: { totals: { rebarKg: 0 }, quantityIncompleteReasons: expect.arrayContaining([expect.stringContaining(reason)]) },
      costs: { complete: false, unpricedLines: 0, incompleteReasons: expect.arrayContaining([expect.stringContaining(reason)]) },
    } } });
  });

  it.each([
    { geometry: { ...geometry, foundationVolumeM3: 1 } },
    { geometry: { ...geometry, walls: [{ id: 'a', lengthM: 2, heightM: 2, openingAreaM2: 5 }] } },
    { geometry, settings: { wall: { blockLengthM: 0 } } },
    { geometry, settings: { mortar: { aggregate: 1 } } },
    { geometry, settings: { pillars: { count: 1.1 } } },
    { geometry, settings: { roof: { rebar: { lapLengthM: 6 } } } },
    { geometry, settings: { roof: { sheet: { sheetLengthM: .1, endLapM: .2 } } } },
    { geometry, settings: { makeOrder: true } },
  ])('rejects invalid or contradictory material inputs', args => {
    expect(call('estimate_materials', args)).toMatchObject({ result: { isError: true } });
  });

  it('enforces the 128 KB limit on direct MCP dispatch', () => {
    expect(call('estimate_foundation', { foundation, extra: 'x'.repeat(131073) })).toMatchObject({ result: { isError: true, structuredContent: { error: 'Proposal exceeds the 128 KB limit.' } } });
  });
});

describe('measured foundation AI proposal roundtrip', () => {
  it('rejects malformed saved foundations while preserving legacy and service-linked snapshots', () => {
    expect(validateSnapshotFoundation({ rooms: [] })).toBeNull();
    const snapshot = { foundation, services: { version: 1, runs: [{ startConnection: { fixtureId: 'sink-1', portId: 'cold-water' } }] } };
    const before = JSON.stringify(snapshot);
    expect(validateSnapshotFoundation(snapshot)).toBeNull();
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(validateSnapshotFoundation({ foundation: null })).toContain('Invalid foundation');
    expect(validateSnapshotFoundation({ foundation: { ...foundation, elements: [{ ...element, depthM: -1 }] } })).toContain('Invalid foundation');
  });
  it('preserves optional metre-based foundation data through validation and property conversion', () => {
    const draft = { ...createGuidedDesign({}), foundation };
    expect(validateDesignDraft(draft).ok).toBe(true);
    const property = designDraftToProperty(draft);
    expect(property.foundation).toEqual(foundation);
    expect(property.foundation).not.toBe(foundation);
    expect(validateDesignDraft({ ...draft, foundation: { ...foundation, elements: [{ ...element, x: -1 }] } }).ok).toBe(false);
    expect(validateDesignDraft({ ...draft, foundation: { ...foundation, certified: true } }).ok).toBe(false);
  });
  it('makes the same published measured product references available to server AI and MCP', () => {
    expect(designCatalog().find(product => product.id === 'resiglas-water-tank-1000-a')).toMatchObject({ widthM: 1.6, depthM: 1.05, heightM: 1.085 });
    expect(call('search_catalog', { query: 'legrand-613351' })).toMatchObject({ result: { isError: false } });
  });
});
