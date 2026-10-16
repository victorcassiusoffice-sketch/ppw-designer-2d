# Authoring verification — 16 October 2026

Built preview checked: `http://localhost:5173/designer?view=2d&pitch=1`.
Bundle: `App-CRj0h05r.js` / `main-BZP_4LCK.js`.
Reproduce: `node tools/authoring-shot-2026-10-16.mjs http://localhost:5173`.

The script seeds an isolated, measured 8 × 6 m room, runs the actual UI at 1280 × 900 and 390 × 844, and saves eight PNGs beside `report.json`. It uses read-only DOM viewport/camera state, so it runs against a production build without development imports. Non-read API requests are blocked; no supplier order, email or shared project is created.

## Results

- Existing doors can be selected in plan and in the default 3D cutaway. Width edits update the canonical opening. Hinge changes and selection do not move the camera.
- A scene click dismisses opening properties in both views. Close and Escape remain available; measurements/removal use the same property-store validation and history.
- Catalogue dragging commits exactly one product directly in each view, at both sizes. There is no add/confirm step. Touch cancellation cannot place an item. Tap/keyboard choose-position remains the accessible alternative.
- The phone product information button is fully visible inside its tile and opens/closes details without adding anything.
- No horizontal page overflow. Zero console errors, page errors, external resource errors or attempted non-read API requests in the final run.

## Visual inspection

All eight final PNGs were opened and inspected. Desktop properties stay on the right edge. Phone properties remain within the scene, show a clear close control, and scroll internally for the lower actions. Selected product rotation controls appear beside the product in 3D; direct placement does not reset the camera.

Fixed during inspection: cutaway door thresholds had an unreliable pick target; the mobile catalogue's separate Details action was clipped beneath its fixed tile row. The threshold now has a visible cap-plane target, and Details uses its own labelled information button in the tile corner. The empty-room furniture hint no longer covers selected openings, measured drawing or Roof mode.

Non-blocking limits: the phone floor selector still abbreviates its text; the shared floating help launcher occupies unused space beside the lower opening fields in the phone plan screenshot. Lower opening actions require scrolling within the inspector. The local preview deliberately uses bundled catalogue fallback, shown by its availability notice; this run does not verify live supplier integrations.

## Focused regression evidence

37 focused tests passed across RoomView3DOpenings, catalogWorkspace, dragLift, placementIntentStore and FloatingCluster. After the final measured-tool UI fixes, 38 focused tests passed across HouseWorkspace, RoomView3DOpenings and catalogWorkspace. Scoped ESLint and TypeScript checks passed. The release owner ran the full suite separately.

The later desktop opening-toolbar correction has 16 passing TopBarPanels tests, including four new cases for door/window/hole/doorway: the visible label follows the selected opening, only doors have hinge/swing controls, and Done exits to selection. This correction does not change geometry or the camera.

Curve, custom roof/opening and outdoor/pool geometry have their own QA folders and reports; this report does not claim those checks from the eight door/product screenshots.
