# City Build — local visual and interaction review

Date: 2026-10-13. Final checked production bundle: `App-BpEkIZbf.js`.

Local entry: <http://127.0.0.1:5173/designer?panel=city>.

Repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.

Evidence folder: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-city-2026-10-13`.

Run command: `node tools/city-shot-2026-10-13.mjs` after `npm run build`, with `npm run preview` serving port 5173. This run used terminal-launched headless Playwright Chromium, including SwiftShader for WebGL. Each viewport used fresh disposable browser storage; the user's working project was not changed.

## Result

**Passed** at 1280 × 900 desktop and 390 × 844 phone. The final run regenerated 36 PNGs: 18 screens per viewport. Every screen was manually inspected during validation; entry/return, mobile layout and 3D notification states were rechecked after the final navigation-fix rebuild. Both viewports recorded:

- 0 browser console errors.
- 0 uncaught page errors.
- 0 HTTP errors or failed requests.
- 0 API write requests.
- No horizontal page or panel overflow, clipped toolbar controls, or 3D caption clipping in the captured states.

Machine-readable evidence: `city-browser-results.json`. Supplier order-editor checks are separately recorded by `city-orders-shot-2026-10-13.mjs`; they are not included in this 36-image count.

## Screens inspected

Both `city-desktop-` and `city-phone-` prefixes have these PNG suffixes:

| Screenshot suffix | What was checked |
| --- | --- |
| `entry` | Empty city, initial actions, return to existing building |
| `sample-message` | Explicit sample insertion and its dismissible notice |
| `plan-2d` | Scaled district, road/network/asset footprints, unobstructed plan |
| `plan-3d` | Measured 3D envelopes, utility reveal, full-site fit |
| `3d-selected` | Zoom and pan followed by element-list selection |
| `3d-return-from-sections` | Infrastructure → Overview → Plan retains camera |
| `road-section` | Two-point road with edited width and layer depths |
| `utility-route` | Physical pipe diameter and trench inputs |
| `utility-elevations` | Independent surveyed endpoint elevations |
| `data-centre-inputs` | Rack, utilisation, PUE, PV, battery and WUE inputs |
| `data-centre-results` | Independently checked energy/water scenario outputs |
| `infrastructure-solar` | Real supplier references, source links and reference attachment |
| `supplier-message-3d` | 3D remains visible with reference confirmation banner |
| `supplier-linked` | Reference attached while the measured envelope stays unchanged |
| `overview` | Site, roads, trenches, footprints and known capacities |
| `overview-review` | Utility takeoff and explicit engineering limitations |
| `back-to-building` | Existing room and tools remain available |
| `reopened` | Re-entry preserves city geometry and supplier reference |

## Interaction and arithmetic evidence

- Desktop wheel zoom/right-drag and phone two-finger pinch/pan visibly changed the rendered scene. Selecting an asset afterwards changed only about 0.34%/0.19% of pixels, consistent with the selection outline rather than a camera reset.
- A non-geometric array-capacity edit changed less than 0.001%/0% of pixels. Infrastructure → Overview → Plan kept the same canvas DOM instance and changed **0 pixels** at both widths.
- Select / pan keeps the user in 3D. Clicking empty space removes selection; the inspector remains outside the drawing area.
- The UI created a 65 m road with 4 m width, 0.08 m surface and 0.25 m base. Stored points and dimensions matched the entered values.
- The UI created a water route with 110 mm outside diameter and endpoint elevations −0.6 m and −1.1 m. Its sloping length is `sqrt(70² + 0.5²)` metres; the two elevations persisted independently.
- The test scenario used 20 racks × 5 kW × 50% utilisation = 50 kW IT load. PUE 1.4 produced 70 kW facility load and 613.2 MWh/year at 8,760 hours. Specified 60 kWp × 1,400 kWh/kWp/year produced 84 MWh/year. WUE 0.5 L/IT-kWh produced 219 m³/year. These are editable test assumptions, not Mauritius design guarantees.
- Attaching the Reneworld source reference preserved all PV-envelope dimensions, position, rotation and entered capacity. No manufacturer dimensions or performance were silently inferred from the supplier family.
- Returning to the building preserved the original four-point room; re-entering City Build preserved three roads and the attached reference.

## Visual defects found and resolved before the final run

1. Phone tools initially scrolled horizontally, hiding Place equipment, Fit and Undo. They now occupy two visible rows; every toolbar button is within the 390 px screen.
2. Phone route coordinates initially introduced a second nested scroll region. They now flow within the inspector's single scroll area.
3. The parent 2D caption initially competed with the 3D orbit/pan caption. Only the correct view-specific caption is shown.
4. Select / pan previously changed 3D to 2D; corrected and verified.
5. Switching sections previously recreated the 3D view; the final run verifies preserved canvas and camera.

No blocking visual defects remained in these tested states. Longer forms and inspectors intentionally scroll. At full-city scale, asset labels and slender streetlights are small; zoom and the Site elements list provide access. City 3D currently shows measured generic planning envelopes, not photoreal or manufacturer-certified product models.

## Limits of this check

This is local Chromium desktop and touch emulation, not physical iOS/Safari or Android hardware validation. It does not certify road, foundation, drainage, electrical, fire or data-centre design. Live supplier inventory, utility approvals, invoice fiscalisation, supplier dispatch and real email delivery were not exercised. No deployment, external order, invoice or email was made by this QA script.
