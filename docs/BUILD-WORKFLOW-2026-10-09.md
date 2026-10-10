# Continuation — 10 October 2026

## Current checkpoint — BUILT-NOT-LIVE

The user explicitly requested local headless checks and to wait for **Y** before publishing. This supersedes the publication step in the original plan below. No push, deployment or main change was made. Work and screenshots remain on `gpt/designer-2026-10-09`; keep this branch and folder name to preserve continuity.

Local repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
Local preview: http://127.0.0.1:5173 (this computer only; `npm run preview -- --host 127.0.0.1 --strictPort`).
Final application bundle: `App-DMQdCeGK.js`. Build succeeds; full suite passes 324 files / 3,655 tests. API typecheck and changed-source lint are recorded in `tools/_scratch`. The normal Vite large-chunk warning remains. Full-repository lint has existing unrelated findings; changed-source lint is the scoped check.

Completed implementation:
- Foundation excavation and fill stages with measured depth, overlap-safe excavation/concrete union volumes, UBP/Premix references, editable nominal mix assumptions and entered rebar schedules. Empty holes do not become concrete purchase quantities until filled.
- Persistent Floors / Materials / Undo in Plan; Foundation and Plumbing & Electric selectors preserve the original view on exit. Expanded Site & tools now occupies its own row. Camera orbit is in View; rotation appears beside a selected rotatable product.
- Closed wall graphs form rooms using existing/shared boundaries, including non-rectangular rooms and subdivisions. Product positions, openings, finishes and undo are preserved by tested adapters.
- Canonical paired product envelopes for sourced Mauritian fixtures, pipes and furniture; quote-only products remain excluded from payable totals. Quantity/API/MCP validation prevents duplicate concrete cost bases and incomplete estimates from pretending to be complete.
- Loading 3D stays visible until the first rendered frame; depth-label ambient-occlusion artifact is fixed. Services links follow moved/rotated fixtures and flag missing references.
- Plumbing/construction/merchant/developer pitches and employee exercises describe the implemented workflow and its limits. Local starter-pack links are generated from localhost and must be regenerated for a verified deployment after authorization.

QA evidence: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-2026-10-09`. Capture scripts: `tools/designer-shot-2026-10-09.mjs`, `tools/products-shot-2026-10-09.mjs`, `tools/foundation-shot-2026-10-09.mjs`, `tools/pitch-shot-2026-10-09.mjs`. Screens use 1280×900 desktop and 390×844 phone. Initial failed selectors/timed-out captures are retained under `initial-checks`; current JSON reports identify final results.

Handoff folder: `C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-09-foundations-services`. Contains one HANDOFF, employee starter pack and price-free screenshots; source code stays in this repository.

Remaining limits / next implementation work:
- Supplier views are dimensionally measured, simplified procedural models, not exact manufacturer CAD or photorealistic OpenArt assets. OpenArt browser access was declined; generated supplier imagery is unfinished and must not be claimed as delivered.
- 2D free-wall line thickness is 10 cm while some 3D room caps use 14 cm. This visual inconsistency remains; measured wall centre-lines and takeoff inputs are independent. Unify the render adapters without changing physical inputs in a later pass.
- Nested room holes are unsupported; partitions crossing existing doors conservatively remain walls rather than inventing new rooms. Cross-floor services require separately measured risers and verified connection data.
- Foundation/rebar output is a quantity estimate from entered project specifications, not structural approval. Nominal mixes do not determine a certified strength grade; hydraulic and electrical engineering calculations/authority approval are outside this workflow.
- Headless Chromium software-WebGL checks do not measure physical-phone GPU performance or deployed API/authentication/payment behavior. No orders, forms, merchant writes or paid AI calls were submitted.

Next release sequence after explicit Y: review this branch, push it and open its PR, attach the PR to the chat, verify the unique preview and read-only deployed endpoints, regenerate employee pack URLs from that verified origin, update build indexes and handoff. Main publication requires the scope of Victor's explicit authorization; never force-push or overwrite other work.

## Original implementation plan (historical)

Branch: `gpt/designer-2026-10-09`, carrying all unpublished 8 October work without discarding changes. The 7 October preview does not contain the new foundation editor yet.

Implementation order and dependencies:
1. Keep foundation, service, product and cost quantities in the canonical metre-based property. Recover and verify the final omitted-quantity/roof-rebar checks before publication.
2. Make Floors, Foundation, Plumbing & Electric and Materials discoverable in Plan. Keep the same floor selector in specialist workspaces, preserve the originating 2D/3D view, and leave a clear Back action. Distinguish Undo from camera orbit and selected-object rotation.
3. Extend foundation geometry with separately measured excavation and concrete stages, exact union volumes, depth inspection, and sourced UBP/Premix references. A supplier family or nominal ratio is not structural approval; the professional supplies the grade, reinforcement and project specification.
4. Form bounded rooms from the per-floor wall graph, splitting at intersections and using existing room edges. Preserve existing item positions and edge finishes; test adjacency, non-rectangular closure, subdivision and one-step undo. Material adapters must continue counting shared physical walls once.
5. Verify Espace Maison sanitaryware, furniture and physical pipe references. Both representations share one dimensional definition. Real photographs condition any generated visual; no generated image supplies engineering dimensions. Unconfirmed stock, component-versus-set prices and manufacturer connection positions stay explicit.
6. Replace the blank 3D transition with an accessible, theme-matched loading animation until the first rendered frame; honour reduced motion and fallback rendering.
7. Run calculation/geometry/interaction tests and desktop/390 px browser checks, publish the dated feature branch/PR, verify actual Vercel routes and API, update link files and one Obsidian handoff. Main and production remain untouched.

OpenArt browser access was explicitly declined on 9 October. No alternate access path will be attempted. A question about using the available image generator is pending; source research, canonical geometry and UI work continue independently.
