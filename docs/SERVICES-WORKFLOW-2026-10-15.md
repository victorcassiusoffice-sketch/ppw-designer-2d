# One Live Build — connected services and guided house build

Active branch: `gpt/designer-2026-10-15`, PR48, building on `bc57a4a`. Worktree: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. Existing production, other checkouts and the shared database remain untouched.

## Plan and dependency order

1. Extend the canonical service model before changing renderers. Store per-node metre elevations, preserve legacy interpolation, sum real three-dimensional segment lengths, and represent explicit fixture and junction connections. A visual crossing is not a connected tee. Unknown fitting dimensions or system suitability remain unknown.
2. Extend the measured services editor with plan/3D drawing, node dragging, angle constraints, numeric heights, vertical segments and cancellation. Both presentations edit the same routes; camera changes never rewrite geometry. Fixture and product references retain source dimensions and units.
3. Research primary Mauritian supplier/manufacturer sources for water pipes, HVAC, ventilation, water-based sprinklers, standalone powder extinguishers and cameras/network equipment. Add only defensible references; separate schematic geometry from verified envelopes. No assumed live stock, purchase, automatic system sizing or fire approval.
4. Add presentation-only discipline visibility shared by 2D/3D: structure, furnishing, foundations, plumbing, electrical, HVAC, fire, security/data, landscaping and solar. City infrastructure retains its separate workspace. Unticking hides, never deletes or changes quantities. Provide Only and Show all controls and prevent selection of hidden geometry.
5. Clarify rectangular excavation depth/width/length. Add independently measured cylindrical bores with diameter/depth and exact individual volume. Withhold overlapping aggregate volumes when an exact mixed-shape union is not supported; never silently sum overlapping excavation. Preserve existing foundations and estimates.
6. Add a resumable house-build tutorial that opens the real tools in sequence, explains what information to enter, and leaves the canvas usable. Include site/project evidence, excavation/foundations, walls/openings/storeys, services/HVAC/fire/security, roof/solar, finishes/garden, review and procurement planning.
7. Validate model migrations, API schemas, lengths, connections, bounds, visibility invariance and excavation quantities. Build, run headless desktop1280/phone390 screenshots and interactions, inspect real visual defects, then publish feature preview and update full links/handoff. No main merge, migration, outbound supplier action, paid images or environment change.

## Ownership

- Core services and dedicated 3D editor: model agent; root integrates main scene routes and visibility.
- Supplier research, equipment references and paired fixture envelopes: research agent.
- Excavation usability, circular bores and guided tutorial: rendering agent.
- Root: shared visibility, ordinary house/plan integrations, usability review, tests, deployment and one-folder handoff.

## Current checkpoint

Implementation complete and locally verified on production bundle `App-CDZDraaG.js`. The canonical route/junction schema, paired plan/3D editor, HVAC/fire/security references, main-scene routes and layer visibility, circular bore geometry and 19-step tutorial are integrated. The full suite passes: 360 files / 3,984 tests. Application and middleware typechecks/build and changed-TypeScript ESLint pass. Final desktop1280/phone390 evidence covers real route dragging, explicit junctions, node elevations, layer isolation, unchanged camera framing, direct cold demo links, foundation dimensions and tutorial navigation.

Defects found and corrected during QA: clipped Layers popover, Escape unintentionally leaving 3D, empty-room text obscuring service-only scenes, phone Foundation totals clipping, and demo initialization closing Services/Foundation deep links. Remaining scope: schematic equipment envelopes; no hydraulic/HVAC/fire sizing or structural approval, automatic cross-floor riser links, live inventory or supplier orders. Large initial bundles and some legacy English copy remain.

Release: feature commit `97146b738e3a649edac8597aecc7d9caec38231d` is live at https://ppw-designer-2d-i3ojsz3qo-victor-ppw.vercel.app. Cache-busted curl confirms exact commit and preview environment; all16 live desktop/phone cases pass with zero errors/writes/overflow. All30 existing links answer200 with gates distinguished. Main and production remain untouched. See `docs/CONNECTED-SERVICES-LINKS-2026-10-15.md`. GitHub Lighthouse is still a hardcoded-production audit failure; other quality checks pass.

Handoff destination: `C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-15-connected-services\HANDOFF.md`.
