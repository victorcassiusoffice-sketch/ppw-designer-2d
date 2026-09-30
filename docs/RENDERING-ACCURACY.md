# Rendering accuracy and extension points

Reviewed 30 September 2026. These are versioned application algorithms and regression tests, not transient instructions to an AI.

## Product scale

Catalog `dimensions_cm` define the **overall envelope**, with length along plan x, width along plan y and height up. Convert to metres once. A supplier reference is required before treating dimensions as verified; an exact envelope does not make a generated silhouette manufacturer CAD.

- `src/designer/fitToSize.ts`: fits all three axes after resolving the complete catalog/model facing. The final heading, including left/right fronts, determines whether source x/z need exchanging. Merely fitting before that heading used to exchange length and width accidentally.
- `src/components/three/productBody.ts`: measures actual transformed mesh vertices once per loaded GLB, then clones materials and fits without changing the cached supplier scene. Nested translation, rotation, authoring scale and alternate up axes are supported. Empty, nonfinite or flat source geometry is rejected so the dimensional fallback remains visible.
- `productEnvelope` rotates an actual length × width box. A rotated footprint AABB is used for collision/placement, never as the physical dimensions of a box. This prevents oblique products becoming oversized blocks.
- The outer body pivot remains floor-centred. `itemPreviewPose.ts` transfers gesture displacement and rotation when a GLB finishes loading, without copying the old placeholder's half-height pivot or scale. `roofItems.ts` tilts the whole product rigidly onto the roof.
- `furniturePreview.ts` owns original dimensional component geometry. New supported products are registered in `dimensionalPreview.ts`; outdoor IDs/shapes come from `mauritiusOutdoor.ts`. Parts merge by material to keep phone draw calls low. The new outdoor items use metal, polypropylene or fabric surface responses and open spaces between structural parts. They remain explicitly labelled planning previews.

Three.js documents that default object bounding boxes may be larger than necessary and provides the precise vertex option: [Box3 reference](https://threejs.org/docs/pages/Box3.html).

## Consistent lighting, with honest limits

`src/designer/lighting.ts` is the shared source for lamp radius, warm source colour and sunset fade. `lampSceneFactor` suppresses Plan lamp glows in neutral daylight, matching the 3D daylight rig, while respecting the chosen solar hour. The 3D caller also respects a placed product's `lightOn` switch.

`lightPreviewProfile` converts the horizontal Plan radius to a 3D spherical reach using `sqrt(radius² + mountHeight²)`, measured above the active storey's floor. This replaces the hardcoded 8 m reach that made all fixtures illuminate the same large area. A high pendant can now reach its intended floor footprint instead of stopping above it. This is a bounded visualization radius, not a measured beam angle.

The established daylight paint calibration remains unchanged: sRGB output, no tone mapping, exposure 1, the same hemisphere/sun/fill rig and measured 0.9 floor gain. Switching the Paint tool or presentation must never silently retint a priced surface. Finish maps affect roughness and surface normals rather than painting arbitrary lighting into the catalog swatch.

Night lighting still uses an illustrative 26 cd reference, inverse-square decay and a bounded radius. Supplier lumens, IES distribution, room reflections, shadowed lux and real display calibration are not present. Plan is an illustration and 3D a shaded view; neither is a certified lighting or electrical design. Three.js distinguishes candela intensity, lumens power and the nonphysical nature of finite cutoffs in its [PointLight reference](https://threejs.org/docs/pages/PointLight.html). Do not infer lumens from electrical watts when adding products.

## Regression coverage

- `productBody.test.ts`: transformed nested models, every front/up/length-axis combination, rotation containment, precise bounds, raised floors, clone ownership and invalid source rejection.
- `outdoorFurniturePreview.test.ts`: all five published outdoor product envelopes, arbitrary-angle containment, supported material/silhouette details and bounded draw count.
- `lightingCalibration.test.ts` / `dressing.test.ts`: Plan/3D radius and sunset agreement, storey-independent reach, invalid dimensions and inverse-square decay.
- Existing `renderPresentation.test.ts`, `itemPreviewPose.test.ts`, `fitToSize.test.ts`, utility model and furniture tests continue to protect color, roof mounting, async carry and catalog dimensions.

For higher fidelity, import a licensed supplier GLB through `npm run models:import-sketchup` and retain provenance; see `docs/SKETCHUP-MODELS.md`. The app cannot recover hidden product geometry or construction details from catalog dimensions alone.
