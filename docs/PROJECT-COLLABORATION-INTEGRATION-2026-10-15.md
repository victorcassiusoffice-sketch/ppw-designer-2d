# Shared-build department collaboration: integration audit

Checked on 2026-10-15. Repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.

This is a source-code audit. No production API, customer record, database, email, order or migration was exercised. A route's presence in the repository does not confirm that its database table or identity provider is configured in a deployed environment.

## Decision

The project dashboard can coordinate the current measured build locally and exchange bounded, fingerprint-matched task handover files. It must not claim authenticated, simultaneous collaboration between departments or companies. **There is no existing design endpoint that can safely be connected unchanged for that purpose.**

The current `/api/designs` implementation has no server-verified project ownership or optimistic concurrency control. Adding UI sign-in, requiring an email in a form, or protecting the website with an access code does not fix these API gaps. Keep the new department register local until the integration below is commissioned and verified.

## Existing endpoints and reusable parts

All endpoint paths below are exact repository routes; `vercel.json` rewrites designs and procurement requests to `api/orders.ts`.

| Endpoint | Current behavior | Safe scope today |
| --- | --- | --- |
| `GET /api/designs?email=...` or `?userId=...` | Lists up to 50 full design rows using the caller's supplied filter. No bearer verification or owner predicate derived from a verified identity. | Not a confidential team project listing. |
| `GET /api/designs/:id` | Reads by numeric ID alone. | Not an authenticated shared-build reader. |
| `POST /api/designs` | Accepts caller-supplied `userId`/email, a property snapshot and optional cart/status. Inserts a design and may send the design-saved email. | Existing legacy save flow; do not repurpose it for departmental identities. Preview writes are blocked. |
| `PUT /api/designs/:id` | Replaces property/cart/name/status using an ID-only SQL predicate. No owner check, expected revision or conditional update. | Not suitable for multi-user editing; stale saves can overwrite newer work. Preview writes are blocked. |
| `GET /api/merchants/:slug/city-procurement/:id` | Verifies signed merchant session; checks live approved merchant/contact ownership; reads the merchant-scoped plan. | A merchant's procurement plan, when storage is provisioned. Not the house design or department register. |
| `PUT /api/merchants/:slug/city-procurement/:id` | Same ownership checks; strict 400,000-byte input bound, revision compare-and-save, request-ID/hash retries and project-ID reassignment guard. | Reusable implementation pattern for concurrency and retries. It does not send an order, invoice or email, and preview writes are blocked. |
| `POST /api/design-assistant` | Hosted AI mode verifies a Clerk bearer token and reserves per-user quotas. Guided/validation modes are separate. | Reusable verified-identity pattern; no shared-design permission model. |
| `/api/mcp` | Measured proposal schemas, catalogue references and calculation tools. | Not a saved-project reader/writer or user/department permission service. |
| `/api/admin/*` | Clerk-backed admin verification and admin roles. | Administration only. Do not grant departmental staff global admin rights to obtain project access. |

`middleware.ts` excludes `/api/` from the page/assets access-code gate. `api/_lib/showcaseSafety.ts` blocks transactional writes on preview deployments or `DEMO_ONLY`, but is not authentication and does not make design GET routes private.

## Exact implementation locations

Paths below are relative to the repository root stated above.

| File | Relevant responsibility |
| --- | --- |
| `api/orders.ts` | `validateDesignPayload`, `handleDesigns`, route dispatch and showcase write guard. |
| `api/_db/schema.ts` | Existing `designs` columns: ID, caller-associated user/email, name, property JSONB, cart JSONB, status, creation/update timestamps. No design revision, membership or department permission fields. |
| `api/_db/migrations/0009_designs_leads.sql` | Original design/lead schema. Read only during this audit. |
| `src/lib/designsApi.ts` | Client save/list/read/update wrappers; no Authorization header on design requests. |
| `src/lib/cloudDesigns.ts` | Captures the outgoing page safely, opens a cloud snapshot as a new local page and checks email client-side. Read-before-write does not provide an atomic concurrency check. |
| `src/store/designsStore.ts` | Local saved pages and cloud links. |
| `src/lib/pages.ts` | Page bundle includes property and legacy wall/zone/treatment stores. A property-only document is not a complete legacy page backup. Modern free walls are migrated to property. |
| `src/designer/projectHub.ts` | Stable canonical fingerprint, department task schema and task-file import. Snapshot is informational, never applied as a design import. |
| `src/store/projectHubStore.ts` | Browser-local department registers with local revision checks. These are not server or cross-tab locks. |
| `api/_lib/designAssistant.ts` | Existing Clerk `verifyToken` with explicit authorized origins. |
| `api/_lib/merchantSession.ts` | Signed merchant bearer verification. |
| `api/_lib/cityProcurement.ts` | Live merchant ownership revalidation, input limits, idempotency and conflict responses. |
| `api/_db/cityProcurementStore.ts` | Atomic SQL owner/public-ID/revision predicate for procurement. |
| `api/_db/migrations/0031_city_procurement_plans.sql` | Procurement storage definition; deployment state is not established by this audit. Do not run against the shared database. |

## Minimum staged integration

### 1. Secure existing designs before adding collaboration

- Reuse server Clerk verification, not client-supplied `userId`. On create derive the owner ID from verified claims. On every read/update constrain the SQL query by that owner ID and the design ID; list only the verified user's records.
- Resolve legacy email-only records through an explicit verified-email account-claim process. Do not let a typed email claim another person's stored designs. Existing user IDs also require review because the legacy create endpoint accepted them from callers.
- Add `Cache-Control: private, no-store`, strict numeric IDs, full canonical property validation, bounded UTF-8 request size, rate limits and generic server errors. Existing optional City/Foundation/Eco validators do not validate all legacy rooms, vertices or products.
- Add an atomic conflict predicate before enabling edits from more than one browser. Without a migration, the existing `updated_at` can support a server-issued opaque comparison token if its exact database precision is preserved end to end and compared in the same SQL UPDATE. A client read followed by an unconditional PUT is insufficient. Do not round a database timestamp through JavaScript Date and assume it remains an exact token.
- Retain showcase write rejection before database/email side effects. Exercise all integration tests against an isolated test store/database, never the production-linked preview database.

This first stage can harden single-owner saving without changing the table schema. It does **not** create department access, invitation, project membership or a durable audit history.

### 2. Commission the actual shared-project boundary

Choose the organization's identity provider and durable server-controlled membership store. Define company/project membership, invitations/revocation and per-project capabilities for design, engineering, procurement, delivery and client review. The repository does not currently have those records or verified organization claims wired to designs.

Keep one server-owned build identifier separate from a browser page/copy identifier. Define which fields each capability may change and an explicit revision/conflict workflow. Persist department tasks with the same build identity and a checked version. An imported JSON task's stated department is not authorization; neither a local SHA fingerprint nor a client-generated property ID authenticates a person.

Use the procurement compare-and-save and idempotency pattern, but do not put arbitrary house models or department data into procurement records to avoid provisioning proper storage. Its schema and authorization describe one merchant's supplier plan, not a multi-company collaboration model.

Before production: test missing/expired credentials, cross-project and cross-company access, revoked membership, concurrent saves, retry after lost response, stale task revisions, snapshot-size limits and restore/recovery. Define a retention/audit policy and a backup/export contract that includes any required legacy page bundle fields. Run new migrations only on an isolated approved environment, with an explicit deployment plan; none are part of this preview work.

### 3. Connect order execution separately

Saving supplier packages, target dates and recipient information is planning. Dispatching orders, issuing invoices, sending email, scheduled execution and payment require separately configured, authenticated workflows with finalization/cancellation states and idempotency. The dashboard must not present saved dates as proof of scheduled or completed external actions.

## Large-project calculation audit

The City and Eco contracts have explicit entity limits, and the engineering review limits tree/geometry comparisons to 100,000 segments and ordinary findings to 2,000. During this audit a separate shared preflight was added in `src/designer/projectCalculationBudget.ts`, because the original eco comparison budget did not bound the earlier whole-property material geometry calculation.

`src/designer/propertyMaterials.ts` performs an exact polygon-union sweep. It tests every edge pair for intersections, then evaluates each resulting vertical strip. That preserves measured overlap semantics but can become expensive with many intersecting edges. Wall collinearity grouping also uses linear searches across groups. `projectMetrics` calculates floor unions and material geometry; `reviewProject` can calculate material geometry again. They run synchronously on the main thread.

Existing input boundaries differ:

- CAD plan import caps 150 rooms, 1,500 walls and 12,000 source vertices. A 12,000-edge union alone implies 71,994,000 edge-pair tests before sweep work.
- AI proposals have much smaller room/storey bounds.
- Persisted/legacy Property loading has no global room, free-wall or polygon-vertex limit. Cloud validation currently checks only that property is an object plus the new optional submodels. Local geometry can therefore exceed CAD limits.
- Services permit up to 2,000 routes with 500 points each. Per-route finite coordinate validation does not by itself provide a small whole-project summary budget.
- Several helpers use `Math.max(...points)` / `Math.min(...points)`; sufficiently large unbounded legacy arrays can throw a call-argument limit error.

Read-only local timing samples (one union, warmed desktop runtime; not a performance guarantee): a 2,400-vertex circular polygon took about 25 ms; 80 intersecting thin rectangles (320 vertices) took about 82 ms. Intersections matter, so a vertex count alone is not a complete work bound. Phone and repeated dashboard calculations can be substantially slower.

Implemented summary/review safeguard: `assessProjectCalculationBudget(property)` returns `{ok, reason, counts}` before any union. It validates finite coordinates within the editor's ±10 km range; bounds rooms, vertices, walls, openings, objects and aggregate service points; estimates wall and foundation sweep work; and counts actual polygon intersection breakpoints with early exit. The conservative budget of 2,000,000 estimated work units covers the floor, ground and roof union calls across metrics and review. These are browser workload limits, not construction or city-size limits. A rejected model is preserved; review returns a critical `calculation-budget` finding and `screeningComplete: false`. The metric caller must surface unavailable quantities and must not replace them with apparently accurate zeroes.

Regression checks cover ordinary shared walls, finite-coordinate rejection, excessive legacy vertices, a self-crossing room, dense inter-room intersections below the vertex cap, malformed reinforcement records and aggregate service-point limits. A shared cancellable worker/cache is still the next step for larger valid models. Loop-based extrema and a shared measured-geometry cache can further reduce repeated work in legacy helper paths outside this dashboard.

These are implementation/performance findings, not a change to dimensional scale or an engineering approval.
