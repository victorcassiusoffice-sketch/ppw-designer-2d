# One Live Build — shared sustainable project guide

## Opening and working views

Open Designer → Project hub → Shared project, or use the public demo URL with `panel=shared`. The first mode is **Local pilot · this browser**. It is an interactive rehearsal, not a cloud session. Existing company department dashboards remain available in Project hub.

In the plan, house or Services editor, open **Layers**. Choose **Pipes only**, **Walls + plumbing + electrical**, or a working-role preset. Untick floors, roofs, stairs, equipment or routes independently. **Show all** restores the model. These settings are personal presentation settings: they do not remove components or alter quantities, carbon inputs or estimates. Hidden objects cannot remain selected for editing. Camera position is retained.

## A pilot walkthrough

1. Draw or open a measured build. The shared workspace derives deduplicated wall packages and floor footprints per storey, horizontal roof footprint, drawn foundation concrete, spatial route lengths, fixtures and placed products. Wall packages are currently grouped by storey, not individual wall-face procurement records.
2. Open **Components**. Choose a record, enter its exact material, responsible organisation, desired delivery date, supplier assignment and source links. Quotation and declared carbon fields are optional. Their units and lifecycle boundary are explicit. Save creates a new version; Cancel leaves saved data unchanged.
3. Use **Environment** for measured air/surface conditions, material-specific threshold/test evidence and qualified drying projections. Local/import candidates are evidence leads, not stock promises. Surface scenarios compare measured net energy and declared carbon per area; missing data remains missing.
4. Rehearse the architect, engineer, supplier, contractor and client stations using the role selector. This selector grants no cloud permissions. Supplier edits require assignment; client edits are comments. The owner cannot impersonate every required pilot reviewer.
5. Follow **Pilot workflow** from brief through coordinated release. Material/source gaps, missing supplier assignments, missing responsible parties/dates and stale reviews explain why acknowledgement is blocked. A material or measured-spec change makes earlier acknowledgements stale. Release is a coordination milestone, not engineering certification or purchasing authorization.
6. Review **Change history** or export current specs and the change log as JSON. Local rehearsal retains the latest150 change records. Server history, once activated, stores full immutable version snapshots. Saved material changes invalidate superseded carbon and engineering evidence; previous versions remain auditable.
7. **Build** returns to the designer. Save or explicitly cancel/discard a draft before changing role, project or section. Escape first cancels a component draft; another Escape returns to the build. Changing visibility never publishes geometry.

## Connecting real stakeholders

The backend extends the existing **Neon/Postgres + Clerk + Vercel** stack. There is no Supabase dependency. The new tables have not been applied to the live shared database. Public feature previews intentionally reject database writes.

After the reviewed activation sequence in `SHARED-SPECS-BACKEND-2026-10-16.md`, sign in under **Shared connection**, create a shared project from the current measured build, and add existing verified Clerk user IDs with project roles. No invitation email is sent. Open the same server project from each stakeholder account. Explicit saves update its shared specification; optional measured-change publishing debounces for0.8seconds. Active visible stations poll revisions every3seconds. This is not websocket propagation, offline synchronization or simultaneous geometry co-editing.

A stale save is rejected and the editor retains its draft. Account changes/revocation clear private cached views. Supplier edits do not arbitrarily reshape another person's building. Members can read the entire project specification, including entered commercial metadata; there is no private per-supplier quotation segregation in this version.

## What can be demonstrated

- Independent 2D/3D working views with stable camera and invariant measured quantities.
- One component register, role-specific editing, evidence-qualified environmental calculations and pilot gates.
- A browser-local rehearsal plus separately tested authenticated API, revision history and concurrency behavior.

## What still needs activation or further engineering

- An isolated Neon test deployment, then two-account Clerk acceptance and approved production activation. Migration0032 is prepared and tested only in isolated in-memory PostgreSQL.
- Real supplier stock/order/dispatch connections and invitation email. This release sends no orders, invoices or messages.
- A transient multi-layer hygrothermal solver and professionally reviewed material/cyclone/fire/structural data. The implemented screening does not certify construction or environmental approval.
- Full translation of technical prose; core navigation supports the existing four languages, but detailed new explanations remain English.
- Large initial app bundles remain a performance limitation. Public pitch mode retains the existing supplier/name anonymisation policy; source evidence links are still provided.

## Full source locations

- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/SharedProjectWorkbench.tsx — stations, conflict handling and navigation.
- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sharedBuildAdapter.ts — canonical measurement-to-spec mapping.
- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sharedSpecsContract.ts — shared roles, schemas and pilot rules.
- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainability.ts — scientific screening and unit calculations.
- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainabilityEvidence.ts — sourced Mauritius/import leads and scientific references.
- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_lib/sharedSpecs.ts — authenticated API boundary.
- C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/migrations/0032_shared_project_specs.sql — reviewed additive migration, not applied live.
