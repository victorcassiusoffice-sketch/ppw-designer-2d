# One Live Build — shared sustainable project workflow

15 October 2026. Active repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`; feature branch `gpt/designer-2026-10-15`, PR48; starting commit `a4fa615`. Victor explicitly chose to extend the existing Neon/Postgres and Clerk stack. No Supabase migration is planned.

## Dependency order

1. Fix presentation modes first: pipes alone, walls with electrical/plumbing, independent structure surfaces, routes and equipment. Visibility never changes the canonical model or estimates. Preserve camera, selection safety, Show all and escape controls.
2. Define a shared spec contract before dashboards. Distinguish the server project identity, local build identity, stable source component identity and optimistic revision. Geometry-derived quantities use existing metre-based engines; material, responsibility, dates and evidence remain editable spec data. Deleted geometry is a review event, not silent supplier-data deletion.
3. Build a new authenticated project API. Reuse Clerk identity and Neon/Postgres, never the legacy unauthenticated designs endpoint. Use project memberships, field capabilities, immutable revision history and atomic expected-revision writes. Repeated requests must be idempotent. A read-only preview remains read-only. Prepare an additive migration and integration tests without applying it to the shared production database.
4. Add one shared-project workspace with role stations for architect, engineer, supplier, contractor and client. Local pilot and authenticated shared project are visibly distinct. All stations read the same spec register; role selection in the demo must never become server authorization. Updates received while editing cause explicit conflict handling, not silent overwrites.
5. Add a gated pilot checklist: brief, geometry/scale, material evidence, engineering review, supplier confirmation, logistics, client decision and release. Missing responsibilities/evidence/reviews block readiness; a completed local checklist is not legal approval or an external order.
6. Add environmental screening with explicit units, source evidence, coverage and uncertainty. Condensation screening is not a transient hygrothermal solver. Drying time needs measured material data. Carbon totals require compatible declared units and lifecycle boundaries. Unknown local production is not assumed. Moss, piezo and roadside turbines are compared using separate evidence/energy/carbon metrics, not a fabricated green score.
7. Validate model calculations, permissions, concurrency, durable revisions and scope failures. Run build, tests, headless 1280/390 interaction and screenshot review. Publish only the feature preview; update links and the one-folder handoff. Ask for any remaining live-database activation only after concrete scripts and deployment evidence are ready.

## Delivery boundary

Existing preview and production share one Neon database. Writing migration files is part of this implementation; running them is a separate live action. No migration, environment edit, production merge, supplier order, invoice or email has been authorized by this workflow. Do not describe a local pilot as multi-user cloud collaboration. Cloud readiness must report the actual configuration/storage status.

## Continuation

Implementation completed locally on16 October 2026. The model, authenticated API, role stations, local pilot, environmental engines and working views are integrated. Full suite: 366 files / 4,116 tests passed. Client/middleware/API typechecks, build and changed-file lint pass. The actual SQL migration and concurrent write behavior were tested in isolated in-memory PostgreSQL, never the live Neon database.

Headless local verification includes26 working-view captures and30 shared-project captures at1280px/390px. Working-view filtering restores identical camera pixels and preserves canonical geometry. Shared workflows cover all six role stations, component save, moisture screening, sourcing, surface scenarios, pilot acknowledgements, history and connection choice. Zero console/page errors, attempted API writes and horizontal overflow were observed. Visual fixes: selected-hover contrast, scroll reset between sections, phone discipline shortcut, and full material labels. Further feature-preview verification and pinned links are recorded in SHARED-PROJECT-LINKS-2026-10-16.md once deployed.

Remaining integration: isolated Neon deployment and real two-account acceptance, then approved production activation. Live migration and production/main changes are held. Polling is three-second active-browser refresh; geometry collaboration, private supplier pricing segregation, automatic orders/emails and transient assembly physics are not implemented. Detailed technical prose remains English. Read SHARED-PROJECT-GUIDE-2026-10-16.md and SHARED-SPECS-BACKEND-2026-10-16.md before extending.

## Release checkpoint

Application `be9203ab030c34f4cab9b61cf94240a508fe9025` is live on https://ppw-designer-2d-r6tbj4111-victor-ppw.vercel.app. See SHARED-PROJECT-LINKS-2026-10-16.md and qa-shared-live-2026-10-16/REVIEW.md for exact proof. GitHub typecheck/tests/secrets/Vercel pass. Lighthouse remaining assertions are documented; no thresholds were weakened. Current main remains480c56e1ba940ebef6546928d89f232a5ea2b207. Migration0032 and real two-account cloud activation remain pending; no production data was touched.
