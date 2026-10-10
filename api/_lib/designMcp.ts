/** Stateless MCP Streamable HTTP (JSON response form), protocol 2025-11-25.
 * Public tools operate on supplied data and the public reference catalogue only.
 * No customer records, credentials, network fetch tools or order mutations exist. */
import { z } from 'zod';
import {
  createGuidedDesign,
  validateDesignDraft,
  DESIGN_SCHEMA_DESCRIPTION,
} from '../../src/designer/aiDesignContract.js';
import { allowedDesignOrigin, designCatalog, readDesignBody } from './designAssistant.js';
import {
  estimateServices, normaliseBuildingServices, serviceRunLengthM, SERVICE_FIXTURES, SERVICE_SYSTEMS,
} from '../../src/designer/buildingServices.js';
import {
  BUILDING_SERVICES_CHECKED_AT, SERVICE_FITTINGS, SERVICE_MATERIALS,
} from '../../src/data/buildingServicesCatalog.js';
import { buildLimiter, getClientIp } from './rateLimit.js';
import { FoundationSchema, FOUNDATION_SCHEMA_DESCRIPTION } from '../../src/designer/foundationContract.js';
import { estimateFoundation, normaliseFoundation } from '../../src/designer/foundation.js';
import { estimateMaterials, normaliseMaterialsSettings } from '../../src/designer/materials/index.js';
import { estimateMaterialCosts, foundationProcurement } from '../../src/designer/materials/costs.js';
import { resolveServiceConnections, serviceConnectionWarnings } from '../../src/designer/serviceConnections.js';
import { ConcreteInputSchema, MaterialsGeometrySchema, MaterialsInputSchema } from './materialEstimateContract.js';
import type { MinReq, MinRes } from './sentry.js';

export const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
const limiter = buildLimiter('design-mcp', 60, 60);
const briefInputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 100 },
    brief: { type: 'string', maxLength: 3000 },
    plotWidthM: { type: 'number', minimum: 12, maximum: 100, default: 20 },
    plotDepthM: { type: 'number', minimum: 14, maximum: 100, default: 24 },
    bedrooms: { type: 'integer', minimum: 1, maximum: 8, default: 3 },
    storeys: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
    wallHeightM: { type: 'number', minimum: 2.4, maximum: 4, default: 2.7 },
  },
  additionalProperties: false,
};
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const serviceSystemSchema = z.enum(['cold-water', 'hot-water', 'waste', 'electrical']);
const serviceKeySchema = z.string().min(1).max(128);
const servicePositionSchema = z.number().finite().min(-10000).max(10000);
const serviceDimensionSchema = z.number().finite().min(.05).max(5);
const serviceConnectionSchema = z.object({ fixtureId: serviceKeySchema, portId: serviceSystemSchema }).strict();
const servicesSchema = z.object({
  version: z.literal(1),
  runs: z.array(z.object({
    id: serviceKeySchema, levelId: serviceKeySchema, system: serviceSystemSchema, materialId: serviceKeySchema,
    diameterMm: z.number().finite().min(5).max(1000),
    points: z.array(z.object({ x: servicePositionSchema, y: servicePositionSchema }).strict()).min(2).max(500),
    startElevationM: z.number().finite().min(-20).max(20),
    endElevationM: z.number().finite().min(-20).max(20),
    startConnection: serviceConnectionSchema.optional(), endConnection: serviceConnectionSchema.optional(),
  }).strict()).max(2000),
  fixtures: z.array(z.object({
    id: serviceKeySchema, levelId: serviceKeySchema,
    kind: z.enum(['toilet', 'sink', 'mains-tap', 'electrical-board', 'sewer-connection']),
    x: servicePositionSchema, y: servicePositionSchema,
    widthM: serviceDimensionSchema, depthM: serviceDimensionSchema, heightM: serviceDimensionSchema,
    rotation: z.number().finite().min(-36000).max(36000),
    portElevationsM: z.object({
      'cold-water': z.number().finite().min(-20).max(20).optional(),
      'hot-water': z.number().finite().min(-20).max(20).optional(),
      waste: z.number().finite().min(-20).max(20).optional(),
      electrical: z.number().finite().min(-20).max(20).optional(),
    }).strict().optional(),
    connectionLabel: serviceKeySchema.optional(),
  }).strict()).max(2000),
}).strict().superRefine((services, ctx) => {
  const seen = new Set<string>();
  for (const group of ['runs', 'fixtures'] as const) {
    services[group].forEach((entity, index) => {
      if (seen.has(entity.id)) ctx.addIssue({ code: 'custom', path: [group, index, 'id'], message: 'IDs must be unique across all runs and fixtures.' });
      seen.add(entity.id);
    });
  }
  services.runs.forEach((run, index) => {
    if (serviceRunLengthM(run) < .01) ctx.addIssue({ code: 'custom', path: ['runs', index, 'points'], message: 'A route must measure at least 0.01 m including its elevation change.' });
  });
});

const SERVICE_SCHEMA_DESCRIPTION = {
  version: 1,
  units: { positions: 'metres in the building plan', dimensions: 'metres', diameter: 'supplier nominal millimetres, not automatically bore or OD', rotation: 'degrees' },
  fields: {
    runs: '{id, levelId, system, materialId, diameterMm, points:[{x,y},...], startElevationM, endElevationM, startConnection?:{fixtureId,portId}, endConnection?:{fixtureId,portId}}',
    fixtures: '{id, levelId, kind, x, y, widthM, depthM, heightM, rotation, portElevationsM?:{[system]:metres}, connectionLabel?:string}',
  },
  limits: { runs: 2000, fixtures: 2000, pointsPerRun: [2, 500], coordinatesM: [-10000, 10000], elevationsM: [-20, 20], diameterMm: [5, 1000], fixtureDimensionsM: [.05, 5], rotationDegrees: [-36000, 36000], minimumRunLengthM: .01, bodyBytes: 131072 },
  systems: SERVICE_SYSTEMS,
  fixtureDefaults: SERVICE_FIXTURES,
  example: { version: 1, runs: [{ id: 'cold-1', levelId: 'ground', system: 'cold-water', materialId: 'hpl-aquasafe-upvc-20', diameterMm: 20, points: [{ x: 1, y: 1 }, { x: 4, y: 1 }], startElevationM: .3, endElevationM: .3 }], fixtures: [] },
  rules: [
    'Both arrays are required. IDs must be unique across them. Supply levelIds to check floor references against your building.',
    'Elevations are relative to the selected floor. Every run belongs to one level; a vertical-only riser can repeat an XY point with different elevations.',
    'Measured length assumes a constant gradient along the complete polyline. Split routes when the gradient changes.',
    'Fixture defaults are editable generic planning envelopes, not verified supplier product dimensions.',
    'Unknown material IDs or sizes remain measurable but are explicitly unverified; no supply-length quantity is inferred.',
    'Explicit endpoint references connect only matching systems on the same floor; crossings are not connections. Valid endpoints follow the fixture before measurement.',
    'Generic fixture ports are schematic. Enter surveyed elevations in portElevationsM; sewer-connection requires a waste elevation. Missing or mismatched links remain unresolved and are reported.',
  ],
  limitations: 'Coordination and measured quantities only. No hydraulic sizing, electrical circuit design, automatic fitting count, live inventory, price, order or saved-design mutation. Mains connection and installation require project approval.',
};
export const DESIGN_MCP_TOOLS = [
  {
    name: 'get_foundation_schema',
    description: 'Read the measured foundation contract, bounded fields and complete example. No structural sizing or saved design access.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations,
  },
  {
    name: 'estimate_foundation',
    description: 'Validate supplied slab, strip and pad rectangles and calculate their 3D volume union with optional entered mix and rebar schedule. Read-only takeoff, not structural approval.',
    inputSchema: { type: 'object', properties: {
      foundation: { type: 'object', description: 'Complete FoundationModel from get_foundation_schema.' },
      concrete: { type: 'object', description: 'Optional supply ready-mix/site-mix, dry volume cement/sand/aggregate parts, dryVolumeFactor, cementBulkDensityKgM3, bagKg and wastePct. Unspecified fields use the displayed app defaults.' },
    }, required: ['foundation'], additionalProperties: false }, annotations,
  },
  {
    name: 'estimate_materials',
    description: 'Estimate measured wall, mortar, plaster, concrete, roof and optional foundation quantities through the shared editor engine. Returns costs only for explicitly supplied matching rates; missing prices stay unknown. No orders or saved-design changes.',
    inputSchema: { type: 'object', properties: {
      geometry: { type: 'object', description: 'walls:[{id,levelId?,lengthM,heightM,thicknessM?,openingAreaM2}], baseAreaM2, roofAreaM2, roofLengthM, roofWidthM, roofRectangular. Each physical wall once; max 2000. No foundationVolumeM3 override: supply a measured foundation instead.' },
      settings: { type: 'object', description: 'Optional partial version 1 MaterialsSettings from the editor. Ratios, plaster sides, waste, stock lengths and rates remain explicit; unknown fields reject.' },
      foundation: { type: 'object', description: 'Optional complete FoundationModel. Enabled models replace the legacy base, including empty models.' },
    }, required: ['geometry'], additionalProperties: false }, annotations,
  },
  {
    name: 'get_design_schema',
    description:
      'Read the versioned metre-based house proposal contract and complete valid example. External AI can generate JSON in this shape for user review and import.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations,
  },
  {
    name: 'search_catalog',
    description:
      'Search public catalogue dimensional references. This is a published reference snapshot, not live inventory or order availability.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 160 },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
    annotations,
  },
  {
    name: 'generate_guided_design',
    description:
      'Generate a deterministic conceptual home with metre-based rooms, doors, windows, stairs, roof and garden. Not an LLM: free-text notes are not interpreted. Returns a proposal only; never changes a saved design.',
    inputSchema: briefInputSchema,
    annotations,
  },
  {
    name: 'validate_design',
    description:
      'Validate a complete proposal supplied by your AI: dimensions, room collisions, entrances/circulation, stair connections and known product footprints. Returns corrected-field errors or importable JSON for user review; no plan is applied automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        draft: {
          type: 'object',
          description: 'Complete version 1 DesignDraft from get_design_schema.',
        },
      },
      required: ['draft'],
      additionalProperties: false,
    },
    annotations,
  },
  {
    name: 'get_services_schema',
    description: 'Read the versioned metre-based service-route contract, editable generic fixture defaults and a valid example. No customer designs are read or changed.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations,
  },
  {
    name: 'search_service_materials',
    description: 'Search dated Mauritian supplier pipe, conduit and fitting references. Nominal size is distinct from verified outside diameter. No stock, prices or suitability approval.',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', maxLength: 160 },
      system: { type: 'string', enum: ['cold-water', 'hot-water', 'waste', 'electrical'] },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    }, additionalProperties: false },
    annotations,
  },
  {
    name: 'estimate_services',
    description: 'Validate all supplied service routes and fixtures, then measure route lengths and known supply-length quantities. Any invalid entity rejects the estimate; no partial result is silently returned. Not hydraulic or electrical design.',
    inputSchema: { type: 'object', properties: {
      services: { type: 'object', description: 'Complete version 1 BuildingServices object from get_services_schema; runs and fixtures arrays are required.' },
      levelIds: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 128 }, maxItems: 2000, description: 'Optional known building floor IDs. Unknown references reject the whole estimate when supplied.' },
    }, required: ['services'], additionalProperties: false },
    annotations,
  },
];
const Rpc = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number().finite()]).optional(),
    method: z.string().min(1).max(120),
    params: z.record(z.unknown()).optional(),
  })
  .strict();
const toolContent = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: value,
  isError,
});
const rpcError = (id: string | number | null, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

/** Pure dispatcher. A caller-provided design never becomes a server-side design. */
export function dispatchDesignMcp(input: unknown): { status: number; body?: unknown } {
  const parsed = Rpc.safeParse(input);
  if (!parsed.success)
    return {
      status: 400,
      body: rpcError(null, -32600, 'Invalid JSON-RPC 2.0 request; batching is not supported.'),
    };
  const { id, method, params = {} } = parsed.data;
  if (id === undefined)
    return method.startsWith('notifications/')
      ? { status: 202 }
      : { status: 400, body: rpcError(null, -32600, 'Requests require an id.') };
  const result = (value: unknown) => ({ status: 200, body: { jsonrpc: '2.0', id, result: value } });
  if (method === 'initialize') {
    const protocol =
      typeof params.protocolVersion === 'string' &&
      (MCP_VERSIONS as readonly string[]).includes(params.protocolVersion)
        ? params.protocolVersion
        : MCP_VERSIONS[0];
    return result({
      protocolVersion: protocol,
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: { name: 'ppw-house-designer', version: '1.0.0' },
      instructions:
        'Use get_design_schema, create a measured proposal, then validate_design. Return the validated JSON to the user for preview/import in the AI design panel. Never claim a plan is structurally approved. No saved customer records or ordering tools are exposed.',
    });
  }
  if (method === 'ping') return result({});
  if (method === 'tools/list') return result({ tools: DESIGN_MCP_TOOLS });
  if (method === 'resources/list')
    return result({
      resources: [
        {
          uri: 'ppw://design/contract/v1',
          name: 'House proposal contract',
          description: 'Validated conceptual design contract and limitations.',
          mimeType: 'application/json',
        },
      ],
    });
  if (method === 'resources/templates/list') return result({ resourceTemplates: [] });
  if (method === 'resources/read')
    return params.uri === 'ppw://design/contract/v1'
      ? result({
          contents: [
            {
              uri: params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(DESIGN_SCHEMA_DESCRIPTION),
            },
          ],
        })
      : { status: 200, body: rpcError(id, -32002, 'Unknown resource.') };
  if (method !== 'tools/call')
    return { status: 200, body: rpcError(id, -32601, 'Method not found.') };
  const args = params.arguments ?? {};
  try {
    if (params.name === 'get_foundation_schema') {
      z.object({}).strict().parse(args);
      return result(toolContent({ ...FOUNDATION_SCHEMA_DESCRIPTION, concreteDefaults: normaliseMaterialsSettings().concrete }));
    }
    if (params.name === 'estimate_foundation') {
      const body = readDesignBody(args);
      if (!body.ok) throw new Error(body.error);
      const input = z.object({ foundation: FoundationSchema, concrete: ConcreteInputSchema.optional() }).strict().parse(body.value);
      const foundation = normaliseFoundation(input.foundation)!;
      const concrete = normaliseMaterialsSettings({ concrete: input.concrete }).concrete;
      return result(toolContent({ foundation, concrete, estimate: estimateFoundation(foundation, concrete), limitations: FOUNDATION_SCHEMA_DESCRIPTION.limitations }));
    }
    if (params.name === 'estimate_materials') {
      const body = readDesignBody(args);
      if (!body.ok) throw new Error(body.error);
      const input = z.object({ geometry: MaterialsGeometrySchema, settings: MaterialsInputSchema.optional(), foundation: FoundationSchema.optional() }).strict().parse(body.value);
      const settings = normaliseMaterialsSettings(input.settings);
      const model = input.foundation ? normaliseFoundation(input.foundation) : undefined;
      const foundation = foundationProcurement(model, settings.concrete);
      const geometry = { ...input.geometry, ...(model?.enabled ? { foundationVolumeM3: foundation.foundation!.volumeM3 } : {}) };
      const report = estimateMaterials(geometry, settings);
      return result(toolContent({ report, foundation: foundation.foundation, costs: estimateMaterialCosts(report, foundation.lines, foundation.incompleteReasons),
        limitations: 'Caller supplies measured physical walls once, with deduplicated openings. Quantities and user-entered quotation rates are estimates; no strength grade, structural adequacy, live stock, tax advice or order is implied. ' + FOUNDATION_SCHEMA_DESCRIPTION.limitations }));
    }
    if (params.name === 'get_design_schema') {
      z.object({}).strict().parse(args);
      return result(toolContent(DESIGN_SCHEMA_DESCRIPTION));
    }
    if (params.name === 'search_catalog') {
      const input = z
        .object({
          query: z.string().max(160).default(''),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .strict()
        .parse(args);
      const matches = designCatalog().filter((p) =>
        `${p.name} ${p.category} ${p.supplier} ${p.id}`
          .toLowerCase()
          .includes(input.query.toLowerCase()),
      );
      return result(
        toolContent({
          source: 'bundled public reference catalogue; not live stock',
          products: matches.slice(0, input.limit),
          total: matches.length,
        }),
      );
    }
    if (params.name === 'generate_guided_design') {
      const draft = createGuidedDesign(args);
      return result(
        toolContent({
          mode: 'guided',
          draft,
          warnings: draft.warnings,
          next: 'Review this proposal in the app AI panel; it has not changed any saved plan.',
        }),
      );
    }
    if (params.name === 'validate_design') {
      const input = z.object({ draft: z.unknown() }).strict().parse(args),
        checked = validateDesignDraft(input.draft, designCatalog());
      return result(toolContent(checked, !checked.ok));
    }
    if (params.name === 'get_services_schema') {
      z.object({}).strict().parse(args);
      return result(toolContent(SERVICE_SCHEMA_DESCRIPTION));
    }
    if (params.name === 'search_service_materials') {
      const input = z.object({ query: z.string().max(160).default(''), system: serviceSystemSchema.optional(), limit: z.number().int().min(1).max(50).default(20) }).strict().parse(args);
      const query = input.query.trim().toLowerCase();
      const match = (item: { system: string; id: string; label: string; supplier: string }) =>
        (!input.system || item.system === input.system) && `${item.id} ${item.label} ${item.supplier} ${item.system}`.toLowerCase().includes(query);
      const materials = SERVICE_MATERIALS.filter(match), fittings = SERVICE_FITTINGS.filter(match);
      return result(toolContent({
        source: 'Published supplier reference snapshot; not live stock or prices',
        checkedAt: BUILDING_SERVICES_CHECKED_AT,
        materials: materials.slice(0, input.limit), fittings: fittings.slice(0, Math.max(0, input.limit - materials.length)),
        total: materials.length + fittings.length,
      }));
    }
    if (params.name === 'estimate_services') {
      const body = readDesignBody(args);
      if (!body.ok) throw new Error(body.error);
      const input = z.object({ services: servicesSchema, levelIds: z.array(serviceKeySchema).max(2000).optional() }).strict().parse(body.value);
      if (input.levelIds) {
        const floors = new Set(input.levelIds);
        const invalid = [...input.services.runs, ...input.services.fixtures].filter(entity => !floors.has(entity.levelId));
        if (invalid.length) return result(toolContent({ error: 'Unknown floor references. No quantities were calculated.', invalidEntities: invalid.map(entity => ({ id: entity.id, levelId: entity.levelId })) }, true));
      }
      const services = normaliseBuildingServices(input.services, input.levelIds ? new Set(input.levelIds) : undefined);
      if (!services || services.runs.length !== input.services.runs.length || services.fixtures.length !== input.services.fixtures.length)
        return result(toolContent({ error: 'One or more entities failed the service contract. No partial quantities were calculated.' }, true));
      const resolved = resolveServiceConnections(services);
      servicesSchema.parse(resolved);
      const connectionIssues = serviceConnectionWarnings(resolved);
      if (resolved.runs.some(run => serviceRunLengthM(run) < .01))
        return result(toolContent({ error: 'A linked route resolves to less than 0.01 m. No partial quantities were calculated.' }, true));
      const runs = estimateServices(resolved);
      return result(toolContent({
        runs, totalLengthM: runs.reduce((sum, run) => sum + run.lengthM, 0), fixtureCount: services.fixtures.length,
        warnings: [...runs.filter(run => !run.verifiedMaterial).map(run => `${run.id}: material/system/nominal-size match is unverified; supply-length quantity is unavailable.`), ...connectionIssues.map(issue => `${issue.runId}: ${issue.message}`)],
        connectionIssues, connectionsComplete: connectionIssues.length === 0,
        floorReferencesChecked: input.levelIds !== undefined,
        assumptions: 'Constant gradient per route. Whole supply lengths per route without offcut reuse. Fittings, insertion depths, waste allowances and fixtures are not added to pipe lengths.',
        limitations: SERVICE_SCHEMA_DESCRIPTION.limitations,
      }));
    }
    return { status: 200, body: rpcError(id, -32602, 'Unknown tool.') };
  } catch (error) {
    return result(
      toolContent(
        {
          error:
            error instanceof z.ZodError
              ? error.issues
                  .slice(0, 8)
                  .map((i) => `${i.path.join('.')}: ${i.message}`)
                  .join('; ')
              : error instanceof Error
                ? error.message
                : 'Invalid proposal.',
        },
        true,
      ),
    );
  }
}

const h = (req: MinReq, key: string) => {
  const v = req.headers[key];
  return Array.isArray(v) ? v[0] : v;
};
export async function handleDesignMcp(req: MinReq, res: MinRes): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = h(req, 'origin');
  if (!allowedDesignOrigin(origin)) {
    res.status(403).json(rpcError(null, -32000, 'Origin is not allowed.'));
    return;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  } // No SSE or session lifecycle.
  const version = h(req, 'mcp-protocol-version');
  if (version && !(MCP_VERSIONS as readonly string[]).includes(version)) {
    res.status(400).json(rpcError(null, -32600, 'Unsupported MCP protocol version.'));
    return;
  }
  const contentType = h(req, 'content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    res.status(415).json(rpcError(null, -32600, 'Content-Type must be application/json.'));
    return;
  }
  const accept = h(req, 'accept') ?? '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    res
      .status(406)
      .json(rpcError(null, -32600, 'Accept must include application/json and text/event-stream.'));
    return;
  }
  const limit = await limiter.check(getClientIp(req));
  if (!limit.success) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    res.status(429).json(rpcError(null, -32000, 'Request limit reached.'));
    return;
  }
  const input = readDesignBody(req.body);
  if (!input.ok) {
    res.status(input.status).json(rpcError(null, -32700, input.error));
    return;
  }
  const output = dispatchDesignMcp(input.value);
  if (output.body === undefined) {
    res.status(output.status).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.status(output.status).json(output.body);
}
