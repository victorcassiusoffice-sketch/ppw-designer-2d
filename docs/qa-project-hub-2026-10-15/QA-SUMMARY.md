# One Live Build Project hub — local QA, 15 October 2026

Repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`

This record covers local implementation verification. It does not establish that a feature preview or production deployment has been published. No database migration, supplier order, invoice or email was performed by this QA.

## Evidence and result

| Evidence | Confirmed result |
| --- | --- |
| `docs/qa-project-hub-2026-10-15/vitest-all.json` | **350 test files and 3,875 tests passed**; zero failed, pending or todo tests. JSON reports 1,160 nested suites; that is not the file count. |
| `docs/qa-project-hub-2026-10-15/build-final.log` | `npm run build` passed: client TypeScript, middleware TypeScript and Vite production bundle. Vite reports large chunks as a warning, not a failed build. |
| `docs/qa-project-hub-2026-10-15/final-focused-tests.log` | A subsequent focused run passed 22 tests covering preferences, review localization and project hub contracts. |
| `docs/qa-project-hub-2026-10-15/report.json` | Both headless Chromium cases passed on local preview `http://127.0.0.1:5173`; reported bundle **`App-3EzNlsx8.js`**. |
| Same browser report | **30 final screenshots**: 15 desktop and 15 phone. Zero recorded console errors, uncaught page errors, assertion/overflow failures or attempted API writes. |
| `tools/project-hub-shot-2026-10-15.mjs` | Desktop **1280 × 900**, phone **390 × 844**, touch/mobile enabled for phone, disposable browser storage and API write interception. The script rejects non-local target hosts. |

The full test count is taken directly from the saved JSON, not inferred from a terminal excerpt. The screenshot count is taken from each case's `shots` array. Two old `desktop-failure.png` / `phone-failure.png` captures in this directory are not listed by the passing report and are not current acceptance evidence.

## Exercised workflow

- Developer, merchant, construction, plumbing, landscape and city company stations open against the same canonical project ID.
- Procurement quantities, delivery coordination dates and placed-product summaries read that build. Switching a company station does not replace geometry or create a second estimate model.
- The browser flow creates a department task and date, changes its review status, adds a measured tree and green-roof assembly, saves an engineering reference, exports a handover and imports a new same-build task.
- The handover uses the expected format and a SHA-256 fingerprint. Task import is additive: existing task IDs are preserved. It does not import or replace the informational design snapshot. Unit tests reject malformed dates, reserved/duplicate IDs, cross-project data, oversized files and stale revisions.
- All **12 combinations of four languages and three themes** preserve the serialized measured Property exactly. English, French, Simplified Chinese and Spanish headings are checked, as are persisted locale/theme values after reload.
- Escape returns to the existing designer. Reload preserves the entered model and preferences. Screenshots check page, header, card and content overflow.

The final screenshot set covers overview, department tasks, procurement quantities, delivery dates, placed products, ecology, engineering findings, design evidence and JSON handover. It also captures all three English themes and the French, Chinese and Spanish ivory interfaces at both widths. Representative desktop overview, phone overview and phone engineering findings were independently inspected: text and controls are readable, with no observed overlap in those captures; phone content scrolls beneath the persistent navigation.

## Calculation and model checks

The dashboard uses a per-storey polygon union for total floor area, a ground-only union for footprint, and the existing all-floor physical-wall measurement adapter for materials. Shared walls/openings are deduplicated by the established geometry engine. Roof and outdoor polygons do not inflate indoor floor area. Active floor/room selection does not alter project totals or the canonical handover fingerprint.

The work includes independent regression cases for paint coats, material allowances/pack rounding, foundation overlap and steel completeness, service connections, eco round trips and monthly solar weighting. Demonstrated fixes retain exact panel footprint before fit arithmetic, weight monthly daily solar values by month length, and withhold an incomplete foundation steel schedule when a run exceeds stock length without an entered lap allowance.

`assessProjectCalculationBudget` executes before material/union work in both metrics and review. Excessive or invalid geometry returns unavailable metrics with `null` quantities and an explicit reason; it is never truncated into apparently complete totals. Engineering review returns `screeningComplete: false` and a `calculation-budget` finding. Limits cover finite coordinates, cardinality, aggregate service points, wall/foundation work and actual polygon-intersection breakpoints.

Final source audit confirmed the mini-plan uses ground rooms, includes tree crown bounds and computes extrema without unbounded argument spreading. The parent also added a `metrics.available` guard so a rejected oversized model is not serialized into a large SVG. The final build and all 30 Project hub captures were repeated on `App-3EzNlsx8.js` after this guard. Valid-case appearance is unchanged.

## Engineering interpretation

Review outputs are versioned, deterministic screening evidence with entity IDs, severity, assumptions, missing information and source references. They remain **unverified** even when a user supplies an engineer's document reference or capacity value. No finite-element analysis, load-path design, bearing capacity, reinforcement adequacy, hydraulic/cable sizing, cyclone approval or permit certification is produced.

Tree screening uses the explicitly selected surveyed method or the sourced BS 5837 single-stem method. It is not asserted to be Mauritius law and is not a veteran/multi-stem shortcut. Green-roof loading uses the entered saturated assembly mass and only additional water excluded from that mass. It compares this with an entered, unverified incremental capacity; it does not establish structural reserve strength. The source research records the dated Mauritius permit guidance and the need to confirm current authority requirements.

## Remaining limits

- Department coordination is browser-local with bounded JSON task handovers. Secure multi-user/cloud department collaboration is **not connected**. The existing design API lacks server-derived ownership and conflict checks and must not be reused unchanged for confidential team projects.
- Supplier packages and dates are planning data. They do not prove that an external order, invoice, email or scheduled delivery has been issued.
- All 27 review headings/static recommendations and principal navigation controls have localization coverage. Detailed engine evidence, dynamic validation messages, supplier content and portions of legacy forms/pitch prose remain English. This is not full-app translation.
- Professional orthographic views and measured procedural tree models preserve scale. Procedural product/tree envelopes and current lighting are not photographic scans; the app does not yet reproduce all supplied photorealistic reference images exactly.
- Large valid models may exceed the synchronous browser summary budget. Their source design is preserved. A cancellable worker/shared geometry cache remains future work for bigger coordinated projects.
- The local Chromium checks do not constitute an exhaustive physical-device/browser matrix. Vite's large-chunk warning remains relevant to initial loading on slower connections.

## Related evidence

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\ONE-LIVE-BUILD-WORKFLOW-2026-10-15.md` — implementation and continuation workflow.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\ENGINEERING-RESEARCH-2026-10-15.md` — primary engineering/eco sources, contracts and calculation limitations.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\PROJECT-COLLABORATION-INTEGRATION-2026-10-15.md` — exact account/project endpoints, authorization gaps and staged integration plan.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\LANGUAGE-AND-THEME-COVERAGE-2026-10-15.md` — exact translation/theme coverage and residual English.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-professional-views-2026-10-15\BROWSER-QA.md` — separate camera/tree visual checks with their own bundle identities and residual observations.
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-preferences-2026-10-15\report.json` — pitch/preferences/studio checks, including company-context links.

Publication and live-domain status are intentionally left to the parent deployment checkpoint.
