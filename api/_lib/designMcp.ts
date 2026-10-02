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
import { buildLimiter, getClientIp } from './rateLimit.js';
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
export const DESIGN_MCP_TOOLS = [
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
