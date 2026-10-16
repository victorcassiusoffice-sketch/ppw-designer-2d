# One Live Build — advanced authoring verification

Branch: `gpt/designer-2026-10-15`, PR48. No main, production or live database change.

## Automated verification

- Full Vitest suite: 373 files, 4,167 tests passed.
- `npm run build`: passed, including application and middleware TypeScript. Existing large JavaScript chunk warning remains.
- `npx tsc --noEmit -p api/tsconfig.json`: passed.
- ESLint on every changed/new TypeScript file: passed. `git diff --check`: passed.
- Geometry tests cover curve error bounds, closed-room formation, actual opening union/deductions, glass thickness and material exclusions, shared pane rendering, roof pitch/overhang applied once, pool corner volume and outdoor/shared quantity integrity.

## Compiled desktop and phone checks

All captures use terminal Playwright against `npm run preview` on port5173, at1280×900 and390×844, with actual WebGL. Persisted local test fixtures contain no customer data. The scripts use public UI controls/read-only coordinate attributes, not development source imports. API writes are blocked during QA.

- `docs/qa-advanced-build-production-2026-10-16`:20 captures, three tool themes and three scene backdrops in bothviews, preferences/dismissal, glass supplier variant/custom thickness and measured totals.
- `docs/qa-authoring-2026-10-16`:8 captures, existing door selection/editing/dismissal in2D and cutaway3D, desktop/touch catalogue drops, separate product Details, exact single-item creation and unchanged camera.
- `docs/qa-measured-authoring-2026-10-16`:14 captures, three-tap curves in bothviews, circular hole width/sill, roof outline and overhang, unchanged camera and canonical2D/3D persistence.
- `docs/outdoor-production-qa-2026-10-16`:10 captures, below-grade pool cavity/water, pool stages, edited water depth, shell/lining/litres, tarmac/sub-base volumes, phone panel clearance and Garden Done dismissal.

These52 captures report zero console/page errors, attempted writes or horizontal document overflow. Reports are saved beside their images. Earlier development shots/logs are debugging history, not final release evidence.

## Visual defects fixed during this pass

Cutaway doors could not be picked at their visible threshold; the hit target now follows the shown cap. Direct3D product drops used hidden-plan coordinates; they now use the visible3D ground ray. Mobile product Details was clipped below its tile. Empty-room furniture prompts and duplicate drawing controls covered measured authoring. Custom openings inherited door-only labels/hinge controls. Phone Garden had16px overlap with the Furnish capsule and Done opened an unrelated inspector. Curved-wall segments each cast a false vertical corner stripe. Dark outdoor surfaces had low-contrast labels. These defects were corrected and checked again.

## Remaining visual and model limits

- Curved walls still show fine chord seams/faceting at close zoom; saved curves are measured tessellations, not a continuous rendered spline.
- The compact phone floor selector abbreviates its visible label. Its full option/accessibility name remains available.
- Fit can crop the decorative outer lawn on a narrow phone; designed pool/paving/build elements remain visible and the camera can be zoomed out.
- Long opening/material inspectors scroll within their panel; close controls remain available.
- Pools are rectangular planning basins. Openings cannot span several curved wall chords. Complex roof intersections/valleys and structural sizing are not inferred.
- Glazing, pool and roof quantities are planning estimates. Supplier data is dated reference evidence; no stock, quotation, endorsement, purchase or structural certification is claimed.

Public preview proof and application commit are added to the release-links directory after deployment. Existing secure shared-project cloud activation remains separately pending.
