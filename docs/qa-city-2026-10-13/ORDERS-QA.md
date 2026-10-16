# City Orders visual and interaction checks — 13 October 2026

Final local production bundle: `App-BpEkIZbf.js`, served at `http://127.0.0.1:5173`.
Run: `node tools/city-orders-shot-2026-10-13.mjs`.

Both desktop (1280 × 900) and phone (390 × 844) completed successfully. Fourteen screenshots were captured and visually inspected. Final counters for each viewport: **0 console errors, 0 page errors, 0 failed requests, 0 HTTP errors, 0 API writes, 0 horizontal-overflow defects**. The machine-readable result is `orders-browser-results.json`.

## Verified interactions

- The `/demo?view=2d&panel=city` direct link stays in City Build after the demo property loads.
- Add a supplier package, edit equipment quantities and units, and choose order, invoice-target and delivery dates.
- Incomplete email typing stays in the editor. Switching City sections, Back to building and Escape are blocked until save/discard; the entered value survives.
- Save a reviewed package with separate chosen order and invoice recipients. The navigation warning clears after saving.
- The local persisted plan retains its quantities, review state and Mauritius civil dates.
- Timeline orders the three target dates, including a proforma target before the order date.
- Download CSV excludes recipient addresses by default and states that execution requires manual review.
- Public demo shows neutral supplier/equipment labels and disables cloud writes.
- Main `/designer` exposes supplier, description and supplier-reference fields. Decimal measured quantity and unit persist.
- Main merchant Connection uses an identifier and existing sign-in. Secure save/load remain disabled without an authenticated merchant session. No credentials were entered and no backend write was attempted.

## Screenshots

Each suffix has `orders-desktop-` and `orders-phone-` versions in this folder:

- `empty.png` — local draft overview and package navigation.
- `equipment.png` — public demo equipment editor.
- `dates-recipients.png` — target dates and separate recipients during editing.
- `timeline.png` — reviewed package timeline after saving; no stale navigation warning.
- `connection.png` — read-only demo Connection view.
- `supplier-fields.png` — main Designer supplier references and measured quantities.
- `merchant-connection.png` — main Designer sign-in-gated storage controls.

## Findings and fixes

The first inspection found a demo-startup race closing the requested City panel and a navigation warning remaining after a successful package save. Both were corrected in CityWorkspace and verified in the final bundle. One desktop automation attempt exceeded the initial action timeout during route loading; the same final bundle passed the complete rerun with a longer headless action timeout.

No remaining clipping, overlapping controls or unusable field layout was observed in these Orders screenshots. Phone forms intentionally scroll vertically while the City section bar remains accessible. The separate recipients and equipment fields remain readable at 390 px. Native mobile keyboards and physical-device GPU performance were not exercised by this headless run.

Focused automated verification: 29 procurement contract/store/client/API/component tests and 25 demo-scrub tests passed (54 total). Root verification records the application-wide suite separately.

No database migration, supplier order, invoice, email, deployment or Git push was performed by this QA run. Authenticated cloud persistence remains pending migration and backend commissioning; the browser screenshots do not assert live provider delivery.
