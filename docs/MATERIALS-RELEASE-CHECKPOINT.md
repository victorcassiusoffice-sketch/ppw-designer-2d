# Room Designer — Materials release checkpoint · 30 September 2026

Active repository: C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer
Branch: cursor/feat-3d-flooring-hud-bc95. Starting commit: 643f0068e46fb60e728b63c2ea1320e5ab284735.

Victor explicitly authorized this release to main on 30 September: “Once done — Push to main, and demos where needed.” Previous no-main instructions are superseded for this verified release only. Feature preview must be built and checked before production. No production push yet at this checkpoint.

Implemented, currently under verification:
- Versioned pure Materials engine, editable block/mortar/plaster/site-mix/ready-mix/base/pillar/RC roof/rebar/sheet roof estimates; real Mauritius supplier sources, no invented prices or structural approval.
- Property geometry adapter deduplicates shared walls/openings and unions room footprints. Independent tests/review in progress.
- Optional Materials input persisted with property saves/history. Plan side/phone bottom dock and 3D Materials rail; report JSON export.
- Five sourced outdoor catalog products; original dimensioned procedural bodies and images; Mr. Bricolage Mauritius and JKalachand.
- 3D model orientation/envelope accuracy; shared plan/3D lamp brightness/radius/day-night controls and light-off behavior.
- New /pitch/construction using independent UBP reference branding and the actual embedded Materials designer; existing pitch pages updated.

Pending: finish integration tests, desktop/phone visual checks, full build/typechecks, scoped lint (repo-wide lint has existing unrelated failures), feature commit/push and unique Vercel verification, authorized main release and production verification, all build-link/handoff synchronization.

Local Vite server: http://127.0.0.1:5173, exec session 61837. CUA tab12 local Materials demo. Do not lose or overwrite existing user designs; demos use isolated demo workflow.

Permanent extension docs: docs/MATERIALS-RESEARCH-MAURITIUS.md, docs/MAURITIUS-OUTDOOR-SOURCES.md, docs/RENDERING-ACCURACY.md. Materials lives in src/designer/materials; geometry in src/designer/propertyMaterials.ts; optional UI in src/components/MaterialsPanel.tsx. Routes all use one application source, not separately forked builds.

Preserve recovery stash 649569db5766b86c5880321f6cfea782f356da1f and its ^3 untracked snapshot. Original repository C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d remains preserved; sync docs only unless explicitly needed.
