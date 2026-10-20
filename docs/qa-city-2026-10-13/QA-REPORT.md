# City Build — verification and release checkpoint

Date: 13 October 2026. Status: **BUILT-NOT-LIVE**. Branch: `gpt/designer-2026-10-13`, based on preserved checkout `9c82630`. Final local bundle: `App-BpEkIZbf.js`.

## Results

| Check | Result |
| --- | --- |
| Production build: `npm run build` | Passed; client and middleware TypeScript passed. Existing large-chunk advisory remains. |
| API: `npx tsc --noEmit -p api/tsconfig.json` | Passed. |
| Full suite: `npm test -- --maxWorkers=2 --minWorkers=1` | 340 files / 3,799 tests passed. |
| Final demo-entry/workspace/scrub regressions | 39 tests passed after the final startup and warning fixes. |
| Existing demo compatibility | 6 tests passed after those final fixes. |
| Changed source ESLint and whitespace checks | Passed. |
| Final headless visual evidence | 50 PNGs: 36 city-planning screens and 14 supplier-scheduling screens. |
| Viewports | 1280 × 900 desktop and 390 × 844 phone, terminal-launched Playwright Chromium. |
| Browser errors | 0 console errors, 0 uncaught page errors, 0 HTTP errors, 0 failed requests across both final scripts and both widths. |
| External actions | 0 API writes; no supplier orders, invoices, emails, database migrations, Git pushes or deployments. |

The full suite ran before the final demo-entry lifecycle fix; the final production bundle then passed the targeted 39 + 6 regressions and both complete visual scripts. Expected warnings in mocked unit-test environments are distinct from the zero-error browser captures. Authenticated database persistence was tested through mocked contract/store boundaries, not a deployed database.

## Interaction checks

The same measured model feeds city plan and 3D. Tests cover road and trench overlaps, sloping utility lengths, units, invalid geometry, unknown ratings, snapshot validation, history/Clear/Undo, and preservation of existing rooms. Data-centre demand, PUE, generation, battery and water calculations were independently checked. Dense overlap calculation was reduced from about 5.2 seconds to 1.7 seconds in the local stress example; this is not a physical-device performance guarantee.

Phone pinch/pan and desktop wheel/pan visibly change the camera. Selecting an item, editing its capacity and changing city sections preserve the view. Infrastructure → Overview → Plan retains the same canvas and had zero pixel change on both widths. Empty-space selection dismissal, visible phone controls, route editing and Back to building were exercised.

Orders checks cover dates, separate recipient emails, decimal quantities, local persistence, timeline ordering, recipient-free CSV, neutral demo isolation, merchant sign-in gating, and save/discard protection when leaving an unfinished package. The final demo link remains in City Build after demo loading. Entered recipients are disposable QA examples; nothing was sent.

## Visual findings

All 50 final captures were inspected. No blocking layout defect, overlapping dialog, clipped primary control, or horizontal page overflow was observed in the tested states. The initial phone tool strip hid equipment/Fit/Undo; it now uses two visible rows. Nested phone route scrolling, duplicate 3D hints, the stale saved-package warning and the demo-startup race were corrected. A headless action timed out under concurrent local browser load; the unchanged final application passed the full Orders rerun with a longer automation timeout.

The city graphics are **measured planning envelopes**, not photorealistic manufacturer assets. Small infrastructure needs zooming when the entire site is fitted. Native phone keyboards, real-device graphics performance and live merchant/provider delivery have not been verified by desktop headless emulation.

## Remaining implementation boundaries

- This is a bounded district/site planner: up to 10 km site dimensions, 128 road segments, 128 network segments, 300 assets and 64 building/data-centre envelopes. It is not complete certified-city CAD/GIS.
- Detailed house tools remain available. A city building link is a refreshed room/storey envelope snapshot, excluding roof projections; it does not maintain multiple detailed buildings or two-way transforms.
- The 28 supplier entries are primary-source references, not connected stock, guaranteed compatibility or confirmed quotations. Generic geometry remains explicit; linking a source does not silently change dimensions.
- Quantity and scenario calculations do not perform structural, pavement, hydraulic, electrical-protection, lighting-compliance, fire, reliability or authority-approval studies.
- Merchant draft storage requires migration `0031_city_procurement_plans.sql` and deployed authentication verification. Automatic purchasing, scheduled email dispatch and legal invoice issue remain unimplemented. Commissioning requirements, including the legacy email minor-unit issue, are in the backend notes.

## Full locations

- [http://127.0.0.1:5173/designer?panel=city](http://127.0.0.1:5173/designer?panel=city) - Room Designer City Build: developers, civil contractors, utility planners and infrastructure suppliers; local review only.
- [http://127.0.0.1:5173/demo?view=2d&panel=city&pitch=1](http://127.0.0.1:5173/demo?view=2d&panel=city&pitch=1) - Room Designer City Build: neutral employee and partner demonstration; local review only.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-city-2026-10-13/index.html](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-city-2026-10-13/index.html) - Room Designer City Build: 50-image desktop/phone gallery for design review.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-BUILD-WORKFLOW-2026-10-13.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-BUILD-WORKFLOW-2026-10-13.md) - Room Designer City Build: implementation and continuation workflow for product teams.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-PROCUREMENT-BACKEND-2026-10-13.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/CITY-PROCUREMENT-BACKEND-2026-10-13.md) - Room Designer City Build: merchant-storage contract and remaining ordering integrations.
- [C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/HANDOFF.md](C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/designer-2026-10-13-city-build/HANDOFF.md) - Room Designer City Build: one saved handoff for the Builder, Pitch-Maker and infrastructure-market team.

## Reproduce / continue

Run `npm run build`, then `npm run preview -- --host 127.0.0.1 --strictPort`. Run `node tools/city-shot-2026-10-13.mjs` and `node tools/city-orders-shot-2026-10-13.mjs`; regenerate the gallery with `node tools/city-qa-gallery-2026-10-13.mjs`. Raw counters are `city-browser-results.json` and `orders-browser-results.json`. The full-suite log is `tools/_scratch/city-full-final.log`; final build and regression logs share that scratch folder.

Publication remains held under Victor's explicit request to see the checks and then give Y. Do not publish, push main or apply the database migration based on this checkpoint alone.
