# Professional views and measured vegetation — 15 October 2026

Local headless Chromium verification at `http://127.0.0.1:5173`: full camera sweep on `App-CJFqqJkz.js`, followed by the final theme recapture on `App-BLprWb7G.js` at 11:08 Mauritius time. Scripts: `tools/professional-views-shot-2026-10-15.mjs` and `tools/professional-theme-shot-final-2026-10-15.mjs`. Machine-readable results are in `report.json` and `theme-final-report.json` beside this file. No publication, backend writes, orders or emails were performed by this QA.

## Verified

- 1280 × 900 desktop and 390 × 844 phone: perspective, above/front perspective, axonometric, orthographic top, and four cardinal elevations render. DOM projection checks distinguish real orthographic from perspective cameras.
- Elevation zoom retains the selected elevation. Pan works. No horizontal page overflow or view-switch overlap remains in the English captures.
- Ground-plan canopies, tree-height labels and protection-area outlines share the saved metre coordinates with the 3D tree bodies. Geometry tests verify exact canopy envelope, entered height and terrain elevation; 300 trees use two instanced draw groups.
- Ten rendering/interaction test files pass 98 focused tests, including product dimensions, tree bounds, phone pinch stability, lighting/camera preservation, openings and garden behavior. Typecheck and assigned-file lint passed.
- 29 screenshots captured; 0 console errors, 0 uncaught page errors, 0 failed network requests and 0 attempted API writes. Full-size examples and contact sheets were visually inspected.
- Final French/ocean theme recapture adds 8 price-free pitch screenshots at both sizes: plan, 3D house, view controls and north elevation. All nine preset labels are translated. No displayed-price matches, header overlaps, horizontal overflow, console/page errors, failed requests or API writes.

## Visual review

The new Project hub and Preferences controls initially crowded the 3D phone header. Scoped spacing now keeps both 2D/3D labels and all actions reachable; the desktop labels no longer wrap.

The extra French/ocean captures revealed low-contrast dark-theme camera/rail/Clear controls and a pale 2D Furnish pill with light text. The final recapture verifies these controls now have readable light text/icons on dark surfaces, and the view-settings panel and camera labels are translated. The older `phone-*-french-ocean.png` captures record the pre-fix state; use `*-final-*-french-ocean-pitch.png` for the updated presentation.

The final eight images verify that the desktop secondary 3D scene actions (Select, Walls, Draw room, Door, Window and Details), brand mark/title and scene caption now have readable contrast. The 2D phone viewport +/-/Fit controls are legible, and the Furnish launcher and its capsule now use one coherent dark surface. Both the French camera controls and existing English scene-action labels are readable; the interface is not claimed to be completely translated.

The last desktop 2D contrast corrections are also verified in the final bundle: Share/Capture icons (`share-render`, `capture-screen`) and the Floors caption now use readable light foregrounds on navy. All eight final screenshots were visually inspected. No remaining camera, projection, tree-envelope, header-overlap or scoped control-contrast defect was observed in the exercised views.

Trees outside the house-focused view can be cropped at the edge. Preset changes intentionally retain the user's scale and target rather than zooming out to fit vegetation. The tree models are illustrative crown/stem envelopes, not species-specific scans. The existing Cutaway control is visual wall visibility, not a certified structural section.

## Test harness correction

The first attempt assumed `/designer?view=3d` initialized 3D on a fresh local project; it remained in plan mode. The script now enters 3D through the actual 3D House button. Obsolete failure screenshots from that harness assumption were removed after the successful rerun.
