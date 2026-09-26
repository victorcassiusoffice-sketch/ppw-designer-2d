# Pitch pages + Studio hub — frames (2026-09-26)

Shot on the branch's own dev server (`127.0.0.1:5186`) by `tools/shoot-pitch-pages-2026-09-26.mjs`; per-frame layout probe, image-load checks and console errors in `evidence.json`.

## What these pages are

| Route | Audience | Notes |
|---|---|---|
| `/pitch/developers` | Off-plan property developers (Trimetys / Cap Tamarin type) | Buyer plans the unit before handover; change deadline; orders route to the developer's suppliers (integration required) |
| `/pitch/developers?client=cap-tamarin` | Cap Tamarin | Same page, thin overlay: hero line, the Cap Tamarin two-bedroom scene in the live tab (`/demo?scene=captamarin`), a two-column *Managed by PPW / Run by your team* block with no numbers, a later-phase line (complexes, masterplans, unit-in-a-block, landscaping) |
| `/pitch/merchants` | Merchants across Solar / Build / Paint / Flooring / Lighting / Furniture / Garden | Embed on their site, standalone studio, connected shop |
| `/pitch/merchants?client=spa-concept` | Spa Concept | Same page, thin overlay: internal-tool-first framing, Build preselected, honest "in build" labels (wood/cladding quantity, staff dashboard, permission locks, hold-for-review ordering), customer access = later, locked phase |
| `/studio` | Hub | 2D / Premium 3D entry, Shop, both pitches |

No prices anywhere on these pages. "Meet Victor" links to `https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour`. The name outside is Victor Cassius Bhatoolaul / Victor.

## App captures

The developer page's "App screenshots" tab shows `public/showcase/designer-plan.webp` and `designer-3d.webp`, shot from the running app by `tools/shoot-pitch-captures.mjs` (`/demo?scene=home&view=2d|3d`, 1366×860, GL first frame + product bodies settled before the 3D shot). Before this pass the page referenced two `.png` files that did not exist and rendered "App view unavailable"; `src/pages/pitch/__tests__/showcaseAssets.test.ts` now fails the build if any referenced showcase asset is missing, is not a WebP, or is over budget (400 KB captures, 300 KB heroes).

The two hero images (`developer-vision.webp`, `merchant-vision.webp`) are the concept renders converted from 2.4–2.5 MB PNGs to ≤ 300 KB WebP; their "concept imagery" captions stay.

## Frames

Two viewports: `desktop-1366` (1366×860) and `phone-390` (390×844, touch). Every frame: `scrollWidth == innerWidth` (no horizontal overflow), hero image loaded. `*-captures-2d/3d` frames: the capture `<img>` loaded and the caption reads "Captured in the app" (not the fallback). `developers-cap-tamarin-desktop-1366-03-live-3d`: the embedded designer reached a GL first frame of the Cap Tamarin scene (software GL, SwiftShader flags). `merchants-spa-concept-desktop-1366-03-storefront`: the embedded designer mounted before the shot.

`developers-*-04-live-returns`: after browsing the app screenshots and pressing "Live designer", the embedded designer's canvas still exists at a real size. On the base commit it did not: parking the live stage with `display:none` gave the iframe a 0×0 canvas, the designer's `drawImage` threw, its canvas error boundary tripped and the designer never came back until a reload (probe, 2026-09-26). The stage is now parked at the panel's size, invisible and inert (`pitch.css`), no engine change.

Fixed on this pass from the first frame set: the Cap Tamarin "Build together" capability panels no longer scroll inside a scrolling stage under the A/B block; the Spa Concept in-build block is a compact two-column grid so the category panel keeps its call to action on screen at 860 px; the storefront frame waits for the embedded designer to mount.
