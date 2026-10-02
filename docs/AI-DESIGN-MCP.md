# AI design proposals and MCP — 2 October 2026

This is a permanent proposal interface over the same metre-based property used by Plan, 3D, Materials and saved pages. A proposal is always reviewed before the browser opens it as a separate design. The API does not apply plans, read customer designs, save cloud records, place orders or send messages.

## User paths

- **Guided layout:** available offline, without an account. Explicit plot, bedroom, storey and wall-height controls generate a rule-based concept with connected rooms, doors, windows, stairs, roof and garden. Free-text notes are not interpreted. It is labelled guided, not AI.
- **Hosted AI proposal:** authenticated Clerk users can submit a brief through the app. The existing server-side OpenRouter configuration is reused. The response must pass the same geometry checks before review. If authentication, provider or distributed quotas are absent/unavailable, this path fails closed and guided layout remains available.
- **Bring your own AI:** connect an HTTP-capable MCP client to `https://designer.ppwellness.co/api/mcp`. Ask it to read the schema, propose a design, validate it, and return the draft JSON. Import that JSON in the app to preview and open a new plan. This public MCP surface does not spend hosted model credit or expose customer records.

These are **conceptual design** workflows. They do not certify foundations, structural strength, reinforcement, cyclone resistance, planning permission, setbacks, fire/egress compliance or electrical engineering. Furniture footprints come from catalogue references; services, clearances and current supplier specifications still need review. The existing Materials workspace supplies editable planning estimates separately.

## HTTP contracts

Existing Vercel function `api/agent-chat.ts` routes these aliases without changing merchant-chat authentication:

| Route                   | Method | Result                                                                                         |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `/api/design-assistant` | GET    | Readiness booleans, guided availability, sign-in requirement and MCP path; no secrets          |
| `/api/design-assistant` | POST   | `{mode:"guided", brief:{...}}`, `{mode:"ai", brief:{...}}` or `{mode:"validate", draft:{...}}` |
| `/api/mcp`              | POST   | MCP JSON-RPC over Streamable HTTP, stateless JSON response form                                |

AI POST requires `Authorization: Bearer <Clerk session token>`. The verified subject keys the quota, never a supplied email, user ID or design ID. Configuration requires `OPENROUTER_API_KEY`, `CLERK_SECRET_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`. No new API key is exposed to the client. `VITE_CLERK_PUBLISHABLE_KEY` is the existing public sign-in configuration.

Successful POST returns `{mode, draft, warnings}`. Review warnings are a separate array so additional server advisories do not invalidate the bounded draft schema. Guided output is deterministic for the numeric controls. Hosted AI is not silently substituted with guided output. Provider errors return a neutral message; raw provider responses and credentials are not returned.

The provider prompt is capped at 30 KB UTF-8, with at most 40 relevant public catalogue references. Quotas reserve conservatively using the serialized prompt byte count plus message overhead and 6,000 maximum output tokens at the existing paid-model ceiling. No automatic second paid call occurs. Provider timeout is 24 seconds inside the existing 30-second function. The new route uses `google/gemini-2.5-flash`, verified in the public provider model directory on 2 October 2026. The legacy merchant-chat model IDs are not changed. Its old `:free` model ID was absent from that directory, so the new route does not promise free hosted inference; distributed quotas and sign-in are mandatory.

## MCP tools and compatibility

Supports protocol versions `2025-11-25`, `2025-06-18` and `2025-03-26`. POST requests use `Content-Type: application/json` and `Accept: application/json, text/event-stream`. Subsequent requests send the negotiated `MCP-Protocol-Version` header. Initialization returns capabilities; notifications return HTTP 202 without a body. GET/DELETE return 405 because this service uses neither SSE nor server sessions.

| Tool                     | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `get_design_schema`      | Versioned contract, coordinate conventions, complete guided example and optional-array examples |
| `search_catalog`         | Public reference IDs and dimensions; explicitly a bundled snapshot, not live inventory          |
| `generate_guided_design` | Deterministic house proposal, with no mutation or model call                                    |
| `validate_design`        | Validate externally generated JSON before user review/import                                    |

Resource `ppw://design/contract/v1` serves the same contract. Tools are read-only and non-destructive; none accepts a customer design ID. No admin token is needed or accepted for broader powers. There is no OAuth discovery or account-linked MCP persistence in this version; clients that require OAuth rather than public HTTP cannot use this endpoint directly.

Browser Origin is checked against the exact production origin and deployment-provided preview origins; no arbitrary Host-header trust or blanket Vercel-domain allowance. Local development adds only localhost:5173 and 127.0.0.1:5173. Native clients may omit Origin. Payloads are bounded to 128 KB, public calls are rate limited where KV is available, and all geometry arrays and text fields have independent bounds. Public tools do no paid or private work even when rate limiting is unavailable.

## Extension points

- `src/designer/aiDesignContract.ts`: pure Zod version 1 contract, guided generator, geometric validation and public schema description. Add new object types here first; retain import compatibility or increment the version.
- `src/designer/aiDesignProperty.ts`: converts a **validated** draft into existing property/room/opening/stair/roof/garden data. It does not overwrite stores or pages. Existing physical-wall projection mirrors a single canonical door to the neighbouring wall face.
- `api/_lib/designAssistant.ts`: authentication, prompt bounds, provider call and validated proposal response.
- `api/_lib/designMcp.ts`: stateless public proposal tools and protocol transport.
- `api/_lib/agent/openrouter.ts`: existing provider client, with opt-in structured JSON and bounded timeout.

Checks include room/plot bounds; overlapping room interiors; unique IDs; opening spans, jamb margins and overlap; connected door/stair paths to a ground entrance; adjacent floor elevations; stair footprints on both floors and a minimum conceptual tread/run check; known product IDs, cardinal rotations, fit and collision checks. They are geometry checks, not building-regulation approval. Upper floor support, complete MEP routing and real structural design are not inferred.

Catalogue references carry their actual placement type. Version 1 room proposals accept only floor products; a missing placement field preserves the existing floor default. Roof, wall, surface and ceiling products are rejected because the contract does not define their hosts. Both browser and server validate this, and the property converter also rejects direct conversion of a hosted product. The hosted model prompt only includes floor-eligible references. Add solar panels and other hosted products with the existing editor tools after applying the concept; this prevents a roof panel from being silently placed on a room floor.

The MCP catalogue currently contains the bundled public range and sourced Mauritius outdoor additions. Merchant uploads continue through the existing authenticated product API. Extending MCP to the live merchant catalogue should use that public active/non-retired product contract and the same client product-cache IDs; never include pending/private products or accept arbitrary client-supplied dimensions as supplier truth.

## Sources and validation

- [Official MCP Streamable HTTP specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — JSON responses, Origin validation, protocol negotiation and notification status.
- [Official OpenRouter structured output documentation](https://openrouter.ai/docs/guides/features/structured-outputs) — provider structured response options. This implementation requests JSON-object output and always validates it locally; it does not assume model output is trusted.

Production merchant-agent health was read on 2 October 2026 and reported OpenRouter configured. The new readiness endpoint independently checks sign-in and quotas; successful hosted inference must be verified with a real signed-in user. No paid inference was triggered during this implementation audit.
