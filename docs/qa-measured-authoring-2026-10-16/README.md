# Measured authoring visual verification

Tested the built local preview at `http://localhost:5173/designer?view=2d&pitch=1` using headless Chromium, 1280 × 900 desktop and 390 × 844 phone. The harness uses the normal buttons, dropdowns and pointer events. Coordinates come from read-only DOM render attributes; it does not import development modules or call stores to perform edits. A blank local fixture is loaded before navigation. Unexpected API writes are blocked.

Reproduce from the product repository:

```powershell
node tools/measured-authoring-shot-2026-10-16.mjs http://localhost:5173
```

`report.json` lists the 14 screenshots and results. Both widths passed: a three-tap curve in plan, a circular 0.8 m wall opening with 1.1 m sill, the same opening in 3D, another three-tap curve in 3D without moving the camera, a four-point roof outline with 0.5 m overhang, and return to plan with the same saved roof geometry. The final run recorded zero console errors, zero page errors and no horizontal document overflow.

All 14 PNGs were visually inspected. The phone drawing controls are in normal layout flow; the separate build palette collapses while measured drawing is active. Cancel closes the drawing panel. The empty-furniture prompt no longer obscures measured drawing or the roof.

Known rendering limit: curved walls still have fine chord seams/faceting from separate wall slabs. The large artificial vertical corner-shading bands at shallow joins were removed. A continuous mitred mesh is a later rendering improvement and does not change stored measurements.

Screenshots exercise geometric authoring; they do not demonstrate structural approval, supplier ordering, production publication or a live shared database.
