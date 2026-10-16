One Live Build adds independent discipline/part views and a shared sustainable-project workspace for owners, architects, engineers, suppliers, contractors and clients. It derives measured specifications from the current build, preserves supplier metadata, retains removed sources for review, and records role-gated pilot decisions.

Implemented: stable-camera 2D/3D/Services filters; canonical quantity-to-spec mapping; Clerk-verified memberships; supplier-scoped edits; atomic Neon/Postgres revisions and immutable history; conflict-safe forms/polling; evidence-qualified moisture/carbon/local-import/surface-energy tools. Material substitutions invalidate superseded engineering and carbon evidence. The branch retains its prior connected-services, foundation, City, project-hub and guided-house work.

Cloud activation is pending: migration 0032 was tested in isolated in-memory PostgreSQL but NOT applied to the shared live database. Feature previews reject cloud writes and provide a clearly labelled browser-local pilot. After activation, active stations refresh every 3 seconds; this is not websocket propagation or simultaneous geometry co-editing. Members can read the project's commercial metadata; private supplier quotation segregation and order/invoice/email dispatch are not implemented.

Validation: 366 test files / 4,116 tests passed locally; application, middleware and API typechecks, build and changed-file ESLint pass. Focused accessibility/workspace suites pass. CI's generated-theme drift was corrected with the normal generator; the parity test passes. 56 local captures at 1280px/390px cover role stations, editing, environmental tools, pilot/history and working views with zero console/page errors, attempted writes or horizontal overflow. Filtering/restoring camera pixels is unchanged.

Pinned preview: https://ppw-designer-2d-r6tbj4111-victor-ppw.vercel.app/demo?view=2d&panel=shared&pitch=1
Application commit: be9203ab030c34f4cab9b61cf94240a508fe9025
Full demo/pitch/source directory: https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/blob/gpt/designer-2026-10-15/docs/SHARED-PROJECT-LINKS-2026-10-16.md
Activation guide: docs/SHARED-SPECS-BACKEND-2026-10-16.md . Live evidence: docs/qa-shared-live-2026-10-16 .

Lighthouse now audits the PR build instead of production, with unchanged thresholds. Local accessibility scored 100 for both audited routes; overall assertions remain red for documented performance, payload, PWA/robots and image/header limitations. Detailed technical prose remains English. Scientific results are qualified screening, not engineering or environmental certification. No main push, production deployment, live migration, order, invoice or email was performed.
