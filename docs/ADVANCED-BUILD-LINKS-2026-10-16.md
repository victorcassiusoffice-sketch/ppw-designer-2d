# One Live Build — complete preview and source directory,16 October 2026

Pinned application preview: https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app. Application commit `a07178f260ea7eb767ea4042ef743f323a70c590`. Branch `gpt/designer-2026-10-15`, PR48. Main and production remain unchanged. Later documentation commits may deploy identical application builds; use this pinned origin for this release.

## Latest measured authoring release

Door selection and direct drag/drop, measured curves, shaped wall openings, custom roof footprints and overhang, sourced glass thickness, outdoor layers and rectangular pools, plus three tactile tool skins and scene backdrops. All share measured geometry across 2D/3D. Source and quantity contracts are described in the workflow and QA documents below.

- https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&pitch=1 - One Live Build main all-in-one demo: architects, developers, merchants, installers, landscapers and city teams; use the app menus to reach every existing tool.
- https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&pitch=1 - One Live Build measured plan: designers, engineers and material suppliers.

## New shared sustainable project

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=shared&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=shared&pitch=1) - One Live Build Shared project: architects, engineers, suppliers, contractors and clients coordinating sustainable construction; interactive local pilot.
- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=shared&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=shared&pitch=1) - One Live Build Shared project: the same register entered from the3D house, for construction and environmental project teams.

Open Layers for Pipes only, Walls + plumbing + electrical or independent part toggles. Open Project hub → Shared project to reach the register from a current build. Supplier references, technical analysis and pilot reviews are explicit user-entered decisions.

**Activation limit:** the secure Neon/Postgres API and migration are implemented and tested in isolated PostgreSQL. Migration 0032 has not been applied live; feature-preview writes are blocked. The public pilot stores data in this browser. This is not a deployed multi-user service yet. After activation, visible stations refresh every 3 seconds; no simultaneous geometry co-editing, supplier dispatch or automatic emails are claimed.

## Existing app, demo, pitch, embed and repository locations

Public demo/pitch/embed URLs render interactive app shells. Designer and Studio URLs intentionally show their existing access gate to new visitors; an HTTP200 from that gate is not proof of authentication. No access credentials are stored here. Existing static pitch images were not replaced in this feature; their interactive Designer embeds inherit the new build.

- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/48](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/48) - One Live Build: feature review for the development team.

- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/tree/gpt/designer-2026-10-15](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/tree/gpt/designer-2026-10-15) - One Live Build: all feature source for builders and other AI chats.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=services&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=services&pitch=1) - One Live Build 3D services: plumbing, HVAC, fire and security installers; editable measured routes and equipment.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=services&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=services&pitch=1) - One Live Build 2D services: plumbing/electrical planning and supplier coordination.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=foundation&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=foundation&pitch=1) - One Live Build Foundation: circular hole diameter/depth and rectangular excavation/concrete coordination.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&pitch=1) - One Live Build house tutorial: open Site & tools → Guide; design teams and employee training.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/plumbing](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/plumbing) - One Live Build interactive pitch: plumbing merchants, installers and bathroom showrooms.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&pitch=1) - One Live Build 3D: property developers, architects, showrooms and design consultants.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=developers&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=developers&pitch=1) - One Live Build company Project hub: property developers and off-plan apartment teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=merchants&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=merchants&pitch=1) - One Live Build company Project hub: retailers, manufacturers and distributors.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=construction&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=construction&pitch=1) - One Live Build company Project hub: contractors, estimators and building-material suppliers.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=plumbing&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=plumbing&pitch=1) - One Live Build company Project hub: plumbing suppliers, installers and bathroom showrooms.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=landscape&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=landscape&pitch=1) - One Live Build company Project hub: landscape designers, nurseries and living-roof suppliers.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=city&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?panel=project&company=city&pitch=1) - One Live Build company Project hub: municipal, infrastructure, utility and data-centre planning teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=city&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=city&pitch=1) - One Live Build City: road, utility, energy and district planning.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=materials&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=materials&pitch=1) - One Live Build Materials: measured material quantities for construction and supply teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?scene=paint&view=3d&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?scene=paint&view=3d&pitch=1) - One Live Build Paint: paint suppliers, decorators and finish selection.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=import&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=2d&panel=import&pitch=1) - One Live Build plan import: architects, survey and design teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=ai&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/demo?view=3d&panel=ai&pitch=1) - One Live Build AI/guided design: design consultants; hosted AI needs its configured service.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/embed/designer?view=2d&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/embed/designer?view=2d&pitch=1) - One Live Build 2D embed: merchant websites and product pages.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/embed/designer?view=3d&pitch=1](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/embed/designer?view=3d&pitch=1) - One Live Build 3D embed: merchant websites and showrooms.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/developers](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/developers) - One Live Build interactive pitch: off-plan developers and property teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/merchants](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/merchants) - One Live Build interactive pitch: retailers, manufacturers and product suppliers.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/construction](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/construction) - One Live Build interactive pitch: builders, estimators and building-material suppliers.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/developers?client=cap-tamarin](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/developers?client=cap-tamarin) - One Live Build developer pitch: Cap Tamarin example, not a claimed partnership.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/merchants?client=spa-concept](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/pitch/merchants?client=spa-concept) - One Live Build merchant pitch: Spa Concept example, not a claimed partnership.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/designer](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/designer) - One Live Build Designer: general design and building teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/designer?demo=tintex](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/designer?demo=tintex) - One Live Build legacy Demo entry: paint companies and decorators.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio) - One Live Build Studio: clients, designers and merchant teams.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/designer](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/designer) - One Live Build Studio Designer: design consultants and merchant staff.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/shop](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/shop) - One Live Build shop showcase: multi-merchant retail; preview orders disabled.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/sales](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/sales) - One Live Build employee starter pack: sales staff and design consultants.

- [https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/merchants/connect](https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app/studio/merchants/connect) - One Live Build catalogue onboarding: merchant teams; publishing requires authenticated integration.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer) - One Live Build: complete active product checkout, shared by all app, demo, pitch and embed surfaces.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/ServicesWorkspace.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/ServicesWorkspace.tsx) - One Live Build: plumbing, electrical, HVAC, fire and security route editor.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/ServicesThreeEditor.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/ServicesThreeEditor.tsx) - One Live Build: measured 3D routing and node manipulation.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/buildingServices.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/buildingServices.ts) - One Live Build: canonical services model and actual spatial lengths.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/buildingServicesContract.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/buildingServicesContract.ts) - One Live Build: shared bounded services validation for browser and API.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/serviceConnections.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/serviceConnections.ts) - One Live Build: explicit ports and junctions; connection persistence.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/data/buildingServicesCatalog.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/data/buildingServicesCatalog.ts) - One Live Build: pipe, duct and cable references for supply planning.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/data/buildingEquipmentCatalog.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/data/buildingEquipmentCatalog.ts) - One Live Build: Mauritius supplier and manufacturer equipment evidence.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/DisciplineVisibilityControls.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/DisciplineVisibilityControls.tsx) - One Live Build: shared 2D/3D hide and isolate controls.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/FoundationWorkspace.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/FoundationWorkspace.tsx) - One Live Build: excavation dimensions and foundation coordination.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/foundationExcavation.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/foundationExcavation.ts) - One Live Build: measured excavation quantities and overlap safeguards.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/HouseBuildTutorial.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/HouseBuildTutorial.tsx) - One Live Build: dismissible user tutorial and local progress.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/houseBuildTutorial.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/houseBuildTutorial.ts) - One Live Build: 19-step English/French/Chinese/Spanish guide content.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/RoomCanvas.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/RoomCanvas.tsx) - One Live Build: full 2D building and discipline overlays.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/RoomView3D.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/RoomView3D.tsx) - One Live Build: full 3D building view and integration.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/ProjectWorkspace.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/ProjectWorkspace.tsx) - One Live Build: company-specific department project stations.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/sales](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/sales) - One Live Build: plumbing pitch and employee starter pack.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/pitch) - One Live Build: developer, merchant and construction pitches.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/studio](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/pages/studio) - One Live Build: standalone Studio, shop and merchant entry points.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api) - One Live Build: existing backend and MCP API; shared database, no migration in this release.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/HOUSE-BUILD-GUIDE-2026-10-15.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/HOUSE-BUILD-GUIDE-2026-10-15.md) - One Live Build: employee and customer house-build walkthrough.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SERVICES-RESEARCH-2026-10-15.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SERVICES-RESEARCH-2026-10-15.md) - One Live Build: primary supplier evidence and measured-envelope limitations.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SERVICES-WORKFLOW-2026-10-15.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SERVICES-WORKFLOW-2026-10-15.md) - One Live Build: implementation and continuation record.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SERVICES-SPATIAL-EDITOR-2026-10-15.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SERVICES-SPATIAL-EDITOR-2026-10-15.md) - One Live Build: route controls, connections and interaction QA.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/FOUNDATION-TUTORIAL-WORKFLOW-2026-10-15.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/FOUNDATION-TUTORIAL-WORKFLOW-2026-10-15.md) - One Live Build: foundation and tutorial technical handover.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-services-live-2026-10-15) - One Live Build: deployment health, live desktop/phone screenshots and checks.

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SOURCE-LOCATIONS-2026-10-13.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SOURCE-LOCATIONS-2026-10-13.md) - One Live Build: historical checkout inventory; older checkouts are not this active source.

## New implementation and handoff files

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/SharedProjectWorkbench.tsx](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/components/SharedProjectWorkbench.tsx) - One Live Build: stakeholder stations, conflict-safe editing and project connection.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sharedSpecsContract.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sharedSpecsContract.ts) - One Live Build: validated spec model, role permissions and pilot gates.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sharedBuildAdapter.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sharedBuildAdapter.ts) - One Live Build: canonical geometry-to-spec quantities.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainability.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainability.ts) - One Live Build: moisture, carbon and energy screening engine.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainabilityEvidence.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/src/designer/sustainabilityEvidence.ts) - One Live Build: Mauritius and international source evidence.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_lib/sharedSpecs.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_lib/sharedSpecs.ts) - One Live Build: Clerk-authenticated project API.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/sharedSpecsStore.ts](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/sharedSpecsStore.ts) - One Live Build: Neon/Postgres version storage.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/migrations/0032_shared_project_specs.sql](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/api/_db/migrations/0032_shared_project_specs.sql) - One Live Build: additive migration; not applied live.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SHARED-PROJECT-GUIDE-2026-10-16.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SHARED-PROJECT-GUIDE-2026-10-16.md) - One Live Build: employee and stakeholder walkthrough.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SHARED-SPECS-BACKEND-2026-10-16.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SHARED-SPECS-BACKEND-2026-10-16.md) - One Live Build: activation and two-account acceptance procedure.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SUSTAINABILITY-RESEARCH-2026-10-15.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/SUSTAINABILITY-RESEARCH-2026-10-15.md) - One Live Build: scientific/source methods and limits.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-shared-live-2026-10-16](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-shared-live-2026-10-16) - One Live Build: previous shared-project release evidence (historical).
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-shared-project-2026-10-16](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-shared-project-2026-10-16) - One Live Build: local dashboard desktop/phone screenshots.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-working-views-2026-10-16](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-working-views-2026-10-16) - One Live Build: 2D/3D filtering, camera and geometry proof.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-lighthouse-local-2026-10-16/REVIEW.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-lighthouse-local-2026-10-16/REVIEW.md) - One Live Build: accessibility and remaining performance audit findings.
- [C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-16-curves-glass-outdoors/HANDOFF.md](C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-16-curves-glass-outdoors/HANDOFF.md) - One Live Build: single team handoff and continuation pack.

## Current source and verification

- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/ADVANCED-BUILD-WORKFLOW-2026-10-16.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/ADVANCED-BUILD-WORKFLOW-2026-10-16.md) - One Live Build: workflow, user paths, data contracts and supplier evidence for all sectors.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/ADVANCED-BUILD-QA-2026-10-16.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/ADVANCED-BUILD-QA-2026-10-16.md) - One Live Build: test results and remaining visual/model limits.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/MEASURED-DRAWING-2026-10-16.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/MEASURED-DRAWING-2026-10-16.md) - One Live Build: measured curve, opening, glass and roof contracts for future developers.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/OUTDOOR-POOLS-RESEARCH-2026-10-16.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/OUTDOOR-POOLS-RESEARCH-2026-10-16.md) - One Live Build: outdoor/pool formulas and supplier references for landscape and pool companies.
- [C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-16-curves-glass-outdoors/NEXT-AI.md](C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-16-curves-glass-outdoors/NEXT-AI.md) - One Live Build: next-AI continuation instructions.

373 files / 4,167 tests pass; application build, API typecheck and changed-file lint pass. 52 compiled desktop/phone captures report zero console/page errors, attempted writes or horizontal document overflow. Fine curve seams, phone opening-editor clearance and compound geometry remain follow-ups. Existing Lighthouse performance/PWA issues remain; no all-green CI claim. Supplier evidence and engineering outputs are qualified planning references, not certification, stock or quotations. Main, production and live database remain untouched.

## Final preview proof

Pinned application: https://ppw-designer-2d-3pnq6uesz-victor-ppw.vercel.app; commit a07178f260ea7eb767ea4042ef743f323a70c590. Cache-busted /api/healthcheck returned 200, env preview and the exact SHA. Eight terminal Playwright desktop/phone live cases pass with zero console/page/network errors, writes or horizontal overflow; screenshots inspected. All 34 directory URLs return 200. GitHub application/API typechecks, Vitest, secret scan and Vercel pass. Existing Lighthouse performance/PWA assertions remain failing. See docs/qa-advanced-live-2026-10-16/report.json and links.json. Verification used a process-only Vercel edge resolver with the original host and TLS; no machine DNS changes.
