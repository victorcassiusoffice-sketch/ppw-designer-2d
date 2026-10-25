# Fix round, 24 Oct — One Live Build

Recorded 25 October 2026. PR #50, branch `gpt/olb-sims-parity-2026-10-22`. This is a preview fix round. Production and PR #49 are separate.

## What changed

- Selection and carried-item controls overlay a stable 3D scene. Selecting an item no longer shifts the next drag target.
- A phone Plan rotation handle remains clear of the action row. Carried-object previews and their angle labels start together and advance in 45° steps.
- Remove highlights a single object, door/window, separate drawn wall or floor finish. A deliberate click/tap removes it in one undo transaction. Objects/openings use a hand cursor, walls a bulldozer and flooring a spade. Hover never deletes anything. Escape and Done leave the tool.
- Wall hover in idle 3D temporarily lowers the wall to a cutaway stub. Paint, drawing and placement retain their wall targets. The saved wall and its quantities do not change on hover.
- Choosing exposed brick now arms the shared Plan/House brush and removes paint or cladding that hid the material. Glass keeps its entered thickness. Wall Type has an adjacent height/thickness entry point, including phone Plan.
- Height uses the existing selected-floor control. The explicit whole-building masonry thickness uses the existing Materials input, is persisted on wall edges, and is inherited by newly drawn rooms/walls. Glass stays separate; centre lines do not move. Unchanged inputs preserve the supplier preset and quotation. Changed block specifications require the old rate to be reviewed.
- Supplier photographs take precedence over generated model thumbnails. Fallback pictures are labelled. Bathroom shows sanitary fixtures first. Products uses a cart icon; demo totals/counts remain hidden.
- Materials includes an evidence panel for **11 distinct existing calculation modules**. It reports input presence, sources, assumptions and missing validation. It does not manufacture a price-accuracy percentage from software test results.

## Acceptance evidence

| Request | Result and evidence |
| --- | --- |
| P1-1: selecting moves the 3D canvas | Passed at 1280×800 and 390×844. Canvas top/height unchanged; immediate same-point drag moves the selected chair. [Detailed before/after](INTERACTION-FIX-REPORT.md). |
| P1-2: phone handle obscured | Passed four of four consecutive turns with native Chromium touch events. [Phone after](interaction/phone-high-plan-turn-4.png). |
| P1-3: carried angle mismatch | Gessica and office chair show 0 → 45 → 90 in the ghost and control, and save 90. Desktop and phone passed. [Interaction JSON](interaction/report.json). |
| P1-4: default corner shading | See the actual AO frame measurements and matched comparison in [graphics evidence](GRAPHICS-AND-VIEW-FEEDBACK.md). Phones retain the lighter path. |
| P2: refusal, attachment and height feedback | Blocked turns explain why; attached assemblies require children to be moved first; clamped height shows the limit beside the field; indoor blinds refuse exterior placement. [Removal/P2 JSON](removal/report.json). |
| P2: catalogue photographs and Bathroom order | Four Plan/House × desktop/phone cases passed, with real supplier photographs and sanitary-first order. [Before/after and evidence](CATALOGUE-AND-ESTIMATE-EVIDENCE.md). |
| New: Remove tool | Four target types tested in 2D and 3D, with exact Undo, Escape and explicit room-perimeter refusal at both widths. Fourteen removal/P2 groups passed. [Removal/P2 JSON](removal/report.json). |
| New: wall-material application | Real pointer clicks applied brick and removed the covering paint in all four Plan/House × desktop/phone cases. [Wall material JSON](wall-material/report.json), [phone Plan before](wall-material/phone-2d-painted-before.png), [after](wall-material/phone-2d-brick-after-click.png), [dimensions](wall-material/phone-2d-height-thickness.png), [phone House](wall-material/phone-3d-brick-after-click.png). |
| New: shared dimensions and estimate integrity | New regression tests cover shared faces, floor isolation, glass thickness, save/load, invalid input, unchanged quotation, new-wall inheritance, and doubled concrete thickness producing doubled volume with unchanged area. Existing estimator equations are reused. |
| New: estimate evidence panel | Six desktop/phone groups passed. Input presence is explicitly distinct from empirical accuracy. Eleven modules are documented; no matched invoices have been supplied. [Evidence panel report](estimate-evidence/report.json). |

Final local functional capture reports contain zero console/page errors, zero attempted API writes and no document-width overflow. The live graphics baseline had an existing external exchange-rate error; it is recorded in the graphics report, not counted as a new-preview pass. These are Chromium desktop and phone-width/touch checks, not physical-device certification.

## Verification

- `npm test`: **394 files / 4,279 tests passed** after the final graphics correction. [Full log](full-tests.log).
- `npm run typecheck`: passed root and middleware types. [Log](typecheck.log).
- `npx tsc --noEmit -p api/tsconfig.json`: passed. [Log](api-typecheck.log).
- `npm run build`: passed; existing large-bundle warnings remain. [Log](build.log).
- Scoped ESLint on every changed TypeScript/TSX file: passed, zero warnings.
- Existing geometry/material/foundation/services regression sources remain unchanged by this round. No API, dependency or migration files changed. [Boundary check](BOUNDARY-CHECK.json).
- No paid generation, login, supplier order, message/email dispatch or production deployment occurred.

The user's latest dimension request intentionally changes saved measurement inputs and therefore resulting quantities when the user edits them. This is not a new estimator equation. Hover, selection, rotation controls and presentation do not alter quantities.

## Limits and remaining work

- Default graphics parity is not achieved on this laptop. Auto measured its AO trial below 45 FPS and correctly fell back to direct rendering (60.04 orbit FPS); manual High retained AO at 40.16 FPS. Both remain visibly lighter than live. See the matched-camera sheet and measured first-frame times in the graphics report. This is not a full-parity or all-checks-green release.
- Removing a closed room's perimeter edge is refused. Rebuilding room topology safely is a separate change; the tool does not delete the whole room as a substitute. Separate drawn walls are removable.
- Floor removal removes the selected finish or tile, retaining the room/base structure.
- A parent with attached items explains why it cannot rotate; rotating an entire attached assembly is not implemented.
- Masonry thickness is one explicit whole-building setting; mixed per-wall masonry costing is not newly implemented. Glass retains its own specification. Existing object-placement collision tolerances are unchanged.
- Brick appearance does not certify a stock brick specification. Unit dimensions, joints, mix ratios, supply method and quotation rates still require review in Materials. Structural approval and real invoice accuracy are not inferred.
- Some products still lack supplier photographs, models, measured dimensions or live availability. Their fallback labels remain visible.
- Phone Plan's floor-name label can still truncate. Cold-load performance is recorded, not optimized in this round. Existing Lighthouse issues remain outside this fix scope; no thresholds were weakened.
- PR #49 is not folded in. It overlaps `RoomCanvas.tsx`, `ThreeStage.tsx` and `apiCatalogAdapter.ts`; any later integration needs a separate review.

## Release record

Application commit `43b3e3a`; automatic Vercel deployment commit `a71ac23c830347efed8d1f9499cb4ff56308b863` (verification logs only after the application commit). Pushed remote feature HEAD equalled that exact SHA. Later documentation-only commits retain the same app; final remote equality is recorded in the existing vault handoff.

[https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=3d&pitch=1](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=3d&pitch=1) - One Live Build: verified immutable preview for construction, design and merchant teams.

Cache-busted `/api/healthcheck` returned `env: preview`, commit `a71ac23c830347efed8d1f9499cb4ff56308b863`. Both production domains returned `env: production`, commit `fcefc73bd75abe995b379e825ff715d439da2ca8` at 00:03 UTC on 25 October. Production is unchanged.

The deployed headless check passed at 1280×800 and 390×844 using the actual bundled app, ordinary controls and fresh browser storage: Plan/House, Remove/Done, 11-module Materials evidence, the cart SVG, public price/name/count guards, and both protected Designer entry routes. Zero console/page/HTTP/network errors, writes or document overflow. [Deployed report](preview-smoke/report.json), [desktop](preview-smoke/desktop-3d.png), [phone](preview-smoke/phone-3d.png), [phone Remove](preview-smoke/phone-2d-remove-ready.png), [phone Materials](preview-smoke/phone-materials-input-evidence.png). Phone Plan floor-name truncation is visible and remains a limitation.

GitHub typecheck, full suite, secrets scan and Vercel passed on the deployment commit. [Lighthouse CI](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/40145092986) remains failed: demo manifest/CSP/robots/payload/source-map/accessible-label findings and plumbing-pitch image/console findings. Those are separately recorded and are not hidden by the successful demo smoke checks. No thresholds were weakened. Draft PR50 is **not all-checks-green**.

Release remains Victor's explicit **“merge 50”**. PR49 is not included. The current task ends at the preview and handoff for Claude to retest.
