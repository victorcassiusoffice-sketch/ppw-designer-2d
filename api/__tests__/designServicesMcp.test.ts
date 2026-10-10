import { describe, expect, it } from 'vitest';
import { dispatchDesignMcp, DESIGN_MCP_TOOLS } from '../_lib/designMcp';

function call(name: string, args: Record<string, unknown> = {}) {
  return dispatchDesignMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).body;
}
const run = {
  id: 'hot-1', levelId: 'first', system: 'hot-water', materialId: 'espace-cpvc-20', diameterMm: 20,
  points: [{ x: 0, y: 0 }, { x: 3, y: 0 }], startElevationM: 0, endElevationM: 4,
};
const fixture = {
  id: 'sink-1', levelId: 'first', kind: 'sink', x: 3, y: 0,
  widthM: .6, depthM: .48, heightM: .85, rotation: 0,
};
const services = { version: 1, runs: [run], fixtures: [fixture] };

describe('read-only building services MCP', () => {
  it('exposes a usable measured contract and only read-only tools', () => {
    expect(call('get_services_schema')).toMatchObject({ result: { isError: false, structuredContent: {
      version: 1, fixtureDefaults: { sink: { widthM: .6 } }, example: { runs: [{ materialId: 'hpl-aquasafe-upvc-20' }] },
    } } });
    for (const name of ['get_services_schema', 'search_service_materials', 'estimate_services']) {
      expect(DESIGN_MCP_TOOLS.find(tool => tool.name === name)?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    }
  });

  it('preserves nominal-only sizes and source dates without fabricating OD or prices', () => {
    const response = call('search_service_materials', { query: 'espace-cpvc-20', system: 'hot-water' });
    expect(response).toMatchObject({ result: { structuredContent: { checkedAt: '2026-10-05', total: 1,
      materials: [{ nominalDiameterMm: 20, stockLengthM: 4, supplier: 'Espace Maison' }], fittings: [],
    } } });
    expect(JSON.stringify(response)).not.toContain('outerDiameterMm');
    expect(JSON.stringify(response)).not.toContain('priceMinor');
    expect(call('search_service_materials', { query: 'hpl-aquasafe-upvc-20' })).toMatchObject({ result: { structuredContent: { materials: [{ nominalDiameterMm: 20, outerDiameterMm: 20 }] } } });
  });

  it('keeps discrete fittings separate and respects the combined result limit', () => {
    expect(call('search_service_materials', { query: 'valve', limit: 1 })).toMatchObject({ result: { structuredContent: {
      materials: [], fittings: [{ kind: 'valve', nominalDiameterMm: 20 }], total: 2,
    } } });
    expect(call('search_service_materials', { query: 'valve', system: 'electrical' })).toMatchObject({ result: { structuredContent: { total: 0 } } });
  });

  it('measures elevations and counts full known supply lengths without changing input', () => {
    const before = JSON.stringify(services);
    expect(call('estimate_services', { services, levelIds: ['ground', 'first'] })).toMatchObject({ result: { isError: false, structuredContent: {
      runs: [{ lengthM: 5, planLengthM: 3, stockLengthM: 4, stockLengths: 2, verifiedMaterial: true }],
      totalLengthM: 5, fixtureCount: 1, floorReferencesChecked: true, warnings: [],
    } } });
    expect(JSON.stringify(services)).toBe(before);
  });

  it('measures a vertical-only riser and reports unverified custom sizes', () => {
    expect(call('estimate_services', { services: { version: 1, runs: [{ ...run, materialId: 'custom-pipe', points: [{ x: 1, y: 1 }, { x: 1, y: 1 }], endElevationM: 3 }], fixtures: [] } })).toMatchObject({ result: { isError: false, structuredContent: {
      runs: [{ lengthM: 3, stockLengthM: null, stockLengths: null, verifiedMaterial: false }], warnings: [expect.stringContaining('unverified')], floorReferencesChecked: false,
    } } });
  });

  it('rejects unknown floors rather than dropping routes or assigning them to ground', () => {
    const response = call('estimate_services', { services, levelIds: ['ground'] });
    expect(response).toMatchObject({ result: { isError: true, structuredContent: { invalidEntities: [{ id: 'hot-1', levelId: 'first' }, { id: 'sink-1', levelId: 'first' }] } } });
    expect(JSON.stringify(response)).not.toContain('totalLengthM');
  });

  it.each([
    { version: 1, runs: [run, { ...run, id: 'broken', points: [{ x: 1, y: 0 }] }], fixtures: [] },
    { version: 1, runs: [run, { ...run }], fixtures: [] },
    { version: 1, runs: [run], fixtures: [{ ...fixture, id: run.id }] },
    { version: 1, runs: [{ ...run, points: [{ x: 0, y: 0 }, { x: 0, y: 0 }], endElevationM: 0 }], fixtures: [] },
    { version: 1, runs: [{ ...run, diameterMm: NaN }], fixtures: [] },
    { version: 1, runs: [], fixtures: [{ ...fixture, widthM: -1 }] },
    { version: 1, runs: [] },
    { version: 1, runs: [], fixtures: [], makeOrder: true },
    { version: 1, runs: Array(2001).fill(run), fixtures: [] },
  ])('rejects the complete estimate when any entity is malformed', (invalid) => {
    const response = call('estimate_services', { services: invalid });
    expect(response).toMatchObject({ result: { isError: true, structuredContent: { error: expect.any(String) } } });
    expect(JSON.stringify(response)).not.toContain('totalLengthM');
  });

  it('reports a system/diameter mismatch without pretending supplier stock lengths apply', () => {
    for (const patch of [{ diameterMm: 25 }, { system: 'cold-water' }]) {
      expect(call('estimate_services', { services: { version: 1, runs: [{ ...run, ...patch }], fixtures: [] } })).toMatchObject({ result: { structuredContent: {
        runs: [{ verifiedMaterial: false, stockLengths: null }], warnings: [expect.stringContaining('unverified')],
      } } });
    }
  });

  it('enforces the existing body limit even on direct dispatcher use', () => {
    const oversized = { version: 1, runs: Array.from({ length: 1000 }, (_, i) => ({ ...run, id: `run-${i}` })), fixtures: [] };
    expect(call('estimate_services', { services: oversized })).toMatchObject({ result: { isError: true, structuredContent: { error: 'Proposal exceeds the 128 KB limit.' } } });
  });

  it('resolves fixture-linked endpoints before measurement and reports missing links', () => {
    const linked = { ...run, system: 'cold-water', materialId: 'hpl-aquasafe-upvc-20', startElevationM: 0, endElevationM: 0,
      endConnection: { fixtureId: 'supply', portId: 'cold-water' } };
    const supply = { ...fixture, id: 'supply', kind: 'mains-tap', x: 3, y: 0, portElevationsM: { 'cold-water': 4 }, connectionLabel: 'Surveyed private supply' };
    expect(call('estimate_services', { services: { version: 1, runs: [linked], fixtures: [supply] } })).toMatchObject({ result: { isError: false, structuredContent: {
      totalLengthM: 5, connectionsComplete: true, connectionIssues: [],
    } } });
    expect(call('estimate_services', { services: { version: 1, runs: [linked], fixtures: [] } })).toMatchObject({ result: { isError: false, structuredContent: {
      totalLengthM: 3, connectionsComplete: false, connectionIssues: [{ runId: 'hot-1', message: expect.stringContaining('removed') }],
    } } });
  });

  it('requires the drainage invert and refuses malformed optional link fields', () => {
    const waste = { ...run, system: 'waste', materialId: 'custom', endConnection: { fixtureId: 'drain', portId: 'waste' } };
    const drain = { ...fixture, id: 'drain', kind: 'sewer-connection' };
    expect(call('estimate_services', { services: { version: 1, runs: [waste], fixtures: [drain] } })).toMatchObject({ result: { isError: false, structuredContent: { connectionsComplete: false, connectionIssues: [{ message: expect.stringContaining('surveyed') }] } } });
    expect(call('estimate_services', { services: { version: 1, runs: [{ ...run, endConnection: { fixtureId: 'drain', portId: 'gas' } }], fixtures: [] } })).toMatchObject({ result: { isError: true } });
    expect(call('estimate_services', { services: { version: 1, runs: [run], fixtures: [{ ...fixture, portElevationsM: { waste: -21 } }] } })).toMatchObject({ result: { isError: true } });
  });
});
