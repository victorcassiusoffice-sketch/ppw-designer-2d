# Architectural plan presentation — 19 October 2026

This change follows the warm architectural-plan reference at `C:/Users/Victor/Documents/Claude/Projects/ppw-room-designer/Design/2D theme 2.jpeg`. It edits the live measured renderer, not a picture over the plan.

## What changed

- Unfinished floors use a warm mineral colour in both natural 3D and the 2D plan, with the existing deterministic four-metre surface grain. No purchasable flooring is assigned by this appearance change.
- Room walls and free-standing walls have warm cut caps, hairline highlights and softer contact shading. Explicit brick, concrete and glass colours keep their selected construction swatches. Glass thickness, wall geometry and opening gaps remain unchanged.
- Wall shadows scale in world units; product cast shadows are lighter. Drafting labels and exact overall dimensions have higher contrast.
- Verified raster top-down assets remain authoritative. Measured 3D overhead snapshots replace legacy SVG silhouettes when supported, while the existing image stays visible during rendering or WebGL failure.
- Imported model URL, front direction, length axis, up axis and preferred-mesh flag flow into plan snapshots and their cache identity. The same catalogue length, width and height define both 2D and 3D.

## Verification

`npx tsc --noEmit`; scoped ESLint; 28 focused tests covering presentation, scale, colour identity, physical envelopes, cache invalidation, sun projection, label layout and the canonical image binding.

`node tools/architectural-plan-shot-2026-10-19.mjs http://127.0.0.1:5174` captures the measured furniture room in 2D/3D and the actual five-room home demo at 1280 × 900 and 390 × 844. The script blocks mutation requests, checks zero console/page errors and horizontal overflow, and verifies zoom does not mutate saved room/product geometry. See `qa-architectural-plan-2026-10-19/report.json` for the latest result.

## Limits and visual observations

The warm surface is an unpriced unfinished slab illustration, not a new residential floor SKU. Existing rubber/EVA finishes remain their real selected colours. Procedural furniture is still a dimensional approximation until a reviewed supplier-derived model is available; those assets are a separate pipeline change. Many legacy home products initially show their existing silhouette while the browser queues its one-time measured-model photographs. Software WebGL can take several seconds; screenshot checks now wait for every product photograph instead of capturing a partially loaded scene. Rendering adds no new API requests or ordering behaviour.

Release follow-up: a wall-mounted product's successfully loaded dedicated raster overhead now overrides the old wall-bar shorthand. The Espace Maison basin can therefore use its baked measured model image. A mirror with only a front-view photo, unsupported wall fixture or failed overhead image keeps the previous wall-bar fallback. Dedicated overhead detection has regression coverage for PNG/WebP, extensionless merchant URLs, symbolic SVGs, empty values and perspective-photo-only products.
