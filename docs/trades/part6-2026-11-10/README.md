# One Live Build · trade stations and City Build

## Try it

Open `/designer?panel=build`, choose a trade, take a package or add a job. Choose **Pin on plan** or **Pin in 3D**, tap the part, then save. Owner view combines all trades. **Progress on plan** and **Progress in 3D** show field status. Dashed outlines identify returned work-file stages. Records and building templates live in the current browser. Share a job using a v1 work file.

Open `/designer?panel=city` with an enclosed house already drawn. **My buildings → Save current house → Place**, then tap the city plan. Repeat to make another independent instance. Use **Frame selected**, switch to **3D**, or inspect **District connections** for plan distances to mapped roads and utility centrelines. Project snapshots carry the placed geometry. The device library holds up to 24 building templates. City uses measured room and storey massing. Furniture, roof details, traffic, population simulation and utility capacity are outside this representation.

## Local proof on 10 November 2026

- App and API typechecks and the production build passed. Full suite passed 4,799 tests across 462 files. After separating the City workbench, its five integration tests passed with the asynchronous entry point.
- Three real browser journeys at 1280, 390 and 313 × 567 px. The smallest ran in the dark skin at 115% text size. Each exercised both trades, two actual map picks, physical panel controls and both projections before and after an exchange. Minimum tested control height 48 px. Main text contrast measured 5.87:1 light and 11.07:1 dark. Secondary text measured 6.35:1 and 6.79:1.
- Trade Folder main supplied the quote and progress through its actual browser UI. The invoice was a signed protocol fixture. Local interfaces imported all three. These journeys neither place supplier orders nor initiate payments.
- 15 public smokes across demo, embed and plumbing pitch recorded zero console errors, page errors, failed requests and attempted network writes. The harness supplies empty local API reads and an offline currency response. No studio assets were requested.
- City proof exercised two placements, six room outlines, 3D, focus, utility distances and reload at 1280 and 390. The absence of a mapped utility is reported as **Unmapped**.
- Final pre-merge cold medians, three alternating pairs per width. Phone first canvas 2,284 ms vs 2,372 ms on main. Desktop 2,700 ms vs 2,437 ms. External ready was 2,354 vs 2,422 ms on phone and 2,789 vs 2,520 ms on desktop. The phone passed; the desktop timing target remains open. The candidate fetched one UI font (126,184 file bytes vs 216,680) and transferred 1,057,838 bytes vs 1,171,384 before first frame on the reported paired run. See `first-picture.json` for all individual results. `font-investigation.json` preserves the two intermediate comparisons.
- The studio theme is scoped to mounted Designer routes. Axe reported zero plumbing-pitch contrast violations at the three test widths. The standalone pitch keeps its own palette. Lighthouse CI also evaluates static-server CSP, total payload, unused CSS and public source maps. The repo intentionally forbids publication of source maps. The inherited CSP and total-byte checks evaluate informative audits with null scores. See the PR for final results.

## Evidence

`journey-*.json` contains tap targets, geometry, selected storeys, actors, returned work files, contrast and page diagnostics. `city-*.json` records city checks. `public-routes.json` contains the route results. `first-picture.json` contains every sample of the final timing campaign. The JPGs are real local browser captures.
