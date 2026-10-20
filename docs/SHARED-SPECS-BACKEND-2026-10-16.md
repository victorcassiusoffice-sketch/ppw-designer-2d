# Shared project specifications — Neon / Clerk integration

Implemented in the existing One Live Build repository and Vercel orders router. This is a new authenticated API boundary; it never calls the legacy unauthenticated design save/read routes.

## Deployment state

The application code and reviewed migration are prepared. **Migration 0032 has not been applied to Neon.** The existing preview and production share a database, so no database, identity-provider configuration, environment variables, domains, orders, invoices or email have been changed. A feature preview rejects every shared-project POST before reading its body, authenticating, or opening storage. An unavailable database/migration is reported as unavailable cloud storage; local rehearsal is not represented as a shared project.

The embedded PostgreSQL tests execute the actual migration and queries in a private, in-memory PGlite instance. They never use `DATABASE_URL`, Neon, customer records or a live Clerk account.

## Source locations

All paths are absolute to allow other chats to continue this work.

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\designer\sharedSpecsContract.ts` — common validated document, operation schemas, role permissions, measured synchronization and pilot reducer.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_lib\sharedSpecs.ts` — verified Clerk identity, authorized origins, request limits, role checks, error boundaries and handler.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db\sharedSpecsStore.ts` — member-constrained reads and atomic SQL save calls.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db\migrations\0032_shared_project_specs.sql` — new current-head/revision tables and transactional save function; not applied to the shared database.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\__tests__\sharedSpecs.test.ts` — real isolated SQL and request-boundary tests.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\orders.ts` and `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\vercel.json` — dispatch and rewrites; no extra serverless function.

## Routes and propagation

All routes require `Authorization: Bearer <Clerk session JWT>` and resolve the actor from verified `sub`. Page access codes, supplied emails, local demo roles and request-body user IDs are not authority.

| Method | Relative API path | Result |
| --- | --- | --- |
| GET | `/api/shared-projects` | `{projects}`; latest 100 projects with active membership. |
| POST | `/api/shared-projects` | Create a server UUID project with the verified caller as sole owner. |
| GET | `/api/shared-projects/:uuid` | Current document, revision, timestamp and verified project role. |
| GET | `/api/shared-projects/:uuid/changes?after=N` | Up to 50 change metadata records plus `latestRevision`, `nextAfter`, `hasMore`. |
| GET | `/api/shared-projects/:uuid/revisions/:revision` | Full historic snapshot, subject to **current** membership. |
| POST | `/api/shared-projects/:uuid/changes` | Bounded, role-checked operation with UUID request ID and expected revision. |

Propagation uses explicit saves followed by change polling and reload. It is not a websocket or a promise of instant propagation. A client with pending edits must surface incoming revision conflicts rather than silently replacing the editor. Lost-response retries return the exact historic result and `latestRevision`; clients reload the current head before subsequent edits. Change metadata excludes the full project document to keep polling small.

Every response is private/no-store. Reads require active membership in the same SQL query; unknown and inaccessible projects return the same 404. Revoked users cannot read current/historic data or replay requests. POST requests are limited to 800,000 UTF-8 bytes; a document is limited to 500 components, 100 members and 1,000,000 bytes. Dates, dimensions, units, financial fields, source URLs and analysis inputs have strict finite bounds. Only HTTP(S) source links are stored.

## Roles and source of truth

The project UUID is independent of the browser build ID. Each component has a stable source key/fingerprint, measured quantity/unit and separate manual material/commercial/analysis fields. Missing measured sources are marked `sourceRemoved`; they are never deleted from an assigned specification. Synchronization preserves manual fields. A changed quantity unit clears carbon and per-unit cost unless an explicit replacement is submitted; total-cost declarations retain their declared basis.

A changed material clears its prior engineering analysis and carbon declaration unless the caller explicitly supplies authorized replacements. This invalidation is performed by the shared reducer and checked by the SQL boundary, including when a supplier is not permitted to edit analysis directly. The editor does not carry an unchanged old carbon declaration across a product substitution.

- Owner manages project membership and component fields. The sole owner cannot be removed or silently reassigned.
- Architect synchronizes measured quantities and edits design/commercial metadata; engineer also edits hygrothermal/surface analysis inputs.
- Supplier edits material, declared cost/carbon, delivery, sources and status **only on components assigned to its verified Clerk user ID**.
- Contractor edits scheduling, responsibility, status and notes. Client edits notes.
- All active project roles can read the shared specification. This is project-wide visibility, not private supplier price segregation. Do not onboard parties needing hidden commercial data until a separately reviewed visibility model exists.

Membership setup uses existing Clerk user IDs supplied by the owner after account identity is established. This version does not create accounts, send invitation emails, validate stock, execute purchases or schedule supplier emails. Recorded commercial statuses/dates are coordination declarations, not evidence that an external transaction occurred.

Measured sync is an explicit import into the specification register; it does not push supplier edits into arbitrary house geometry or substitute another person's entire browser page. Two-way geometry co-editing is a separate model and conflict boundary.

## Concurrency and history

One database function takes a transaction-level create key, locks the current project, revalidates current membership, checks the expected revision, writes the immutable full revision and advances the head. Membership changes share the same revision/lock, preventing a revoked user's write from racing through an earlier API read. Field and supplier-assignment permissions are also checked inside the SQL function.

Request IDs and hashes are retained per project for every revision, not just the last request. Different content or actors cannot reuse a request ID. History UPDATE/DELETE is blocked by a trigger. This is application-level immutable history; privileged database administrators still require governed backups, retention and recovery procedures.

## Pilot gate and engineering limits

Brief, geometry, materials, engineering, supplier, logistics, client and release stages keep actor, timestamp and the measured specification revision. The owner cannot impersonate the engineer/supplier/contractor/client reviews. Accepted release requires current accepted reviews from all seven previous stages, authored by active appropriate roles. Component edits increment `specRevision` and make earlier reviews stale; member/stage edits do not spuriously change the measured revision. Revoking/changing a reviewer role invalidates its eligibility for release.

Materials acknowledgement requires material names and source links on active components. Supplier acknowledgement requires active supplier assignments. Logistics acknowledgement requires responsible parties and delivery dates. Geometry and release cannot proceed with an empty specification. The shared `pilotStageBlockers` helper exposes these requirements to the interface, and both the API reducer and SQL write function enforce them. The eight stages keep one coordination acknowledgement per role-stage, not separate contractual signatures from every employee/company.

These are coordination acknowledgements, not structural, fire, hygrothermal, legal or construction certifications. Saved analysis inputs and evidence links are shared; calculated screening outputs remain evidence-qualified. Missing evidence stays missing. Negative declared carbon factors require an evidence URL and an explicit boundary. Neither carbon factors nor supplier availability are invented by the backend.

## Reviewed activation sequence

1. Provision an **isolated** Neon branch/database for shared-project acceptance testing and deploy this migration through the normal reviewed process. Keep the production-linked preview read-only.
2. Configure the existing Clerk application and exact authorized origins in that isolated deployment; test two real accounts with membership, revocation and concurrency. Do not use the page access code as project identity.
3. Verify backups/recovery, membership onboarding, privacy requirements, account quotas and retention with the project owner before production activation. The tables/functions are server-only; do not grant direct browser SQL access.
4. Only after the independent activation is approved, enable the deployment against its intended database. Keep supplier dispatch/invoices/email as a separate, explicitly authorized integration.

## Verification

`npx vitest run api/__tests__/sharedSpecs.test.ts api/__tests__/schema-mirror.test.ts src/components/__tests__/SharedProjectWorkbench.test.tsx` executes 37 tests (20 backend, 5 schema mirror and 12 workbench interaction tests). Coverage includes migration syntax/SQL, immutable history, stale saves, parallel writes, late retries, cross-project access, revocation during a save, scoped fields, supplier assignments, metadata-preserving sync, material-evidence invalidation, pilot release gates, unchanged-content review stability, schema bounds and preview refusal. UI tests cover late account responses, stale polling responses after saves, role isolation, retained conflicting drafts, environmental draft cancellation, section scrolling and duplicate submissions. Scoped ESLint and a separate strict API TypeScript check are run alongside this suite. No live database was exercised.
