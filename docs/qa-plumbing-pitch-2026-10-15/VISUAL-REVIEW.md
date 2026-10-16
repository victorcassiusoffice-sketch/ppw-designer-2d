# Plumbing pitch and Foundation entry — final local QA

Date: 15 October 2026. Production build: `App-CDZDraaG.js`. Target: `http://127.0.0.1:5173`, served with the existing production preview. Headless Playwright Chromium, 1280 × 900 desktop and 390 × 844 touch phone. This is local verification, not a claim that this build is deployed.

## Result

All 12 captures passed and were visually inspected. Both viewport runs recorded **0 console errors, 0 page errors, 0 attempted network writes and 0 test failures**. The five changed pitch chapters have no horizontal overflow or broken images. Chapter selection and the actual demo-link destinations were checked. The live iframe stays unloaded until requested; this capture run did not launch it or submit enquiry forms. The Services editor itself has separate interaction verification in `docs/qa-services-spatial-2026-10-15`.

The Foundation demo link was then opened directly from a fresh page at each width. It remains open after demo startup. At phone width the drawing SVG is **240 px** high; the drawing panel and final totals row both end at **639.5 px**, exactly where the separately scrolling details panel begins. All four totals are visible. Desktop drawing height is 662.5 px with the inspector beside it. No clipping or overlapping controls were observed in these final captures.

The responsive pitch uses vertical scrolling inside its selected chapter on a phone. Labels, notes, launch buttons and navigation remain readable and reachable. The 3D illustration is an actual schematic services-editor screenshot; it is not a photoreal image or a claim of manufacturer CAD.

## Resolved defects

- A cold Foundation demo link opened before the demo project was installed, then closed on the project change. The workspace now waits for the demo-ready event; later project changes still close it. Four lifecycle regressions cover initial, late and StrictMode mounting, workspace handover, and returning to the originating 3D view.
- The first phone layout improvement kept a 240 px plan but a fixed drawing-panel height clipped 19 px of the totals. The final layout reserves the plan and lets the parent height include its totals/messages. The final screenshots and bounding-rectangle assertion confirm the overlap is resolved.

## Captures and reproducibility

Run `node tools/plumbing-pitch-shot-2026-10-15.mjs` from `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer` with the built preview on port 5173. The script allows only localhost targets, blocks network writes, and records evidence in `report.json`.

Full output folder: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\qa-plumbing-pitch-2026-10-15` - One Live Build: plumbing supplier, installer and bathroom-showroom pitch; Foundation entry for house-design coordination.

| Chapter / tool | Desktop | Phone |
| --- | --- | --- |
| The opportunity | `desktop-opportunity.png` | `phone-opportunity.png` |
| Try the tools | `desktop-tools.png` | `phone-tools.png` |
| Your catalogue | `desktop-catalogue.png` | `phone-catalogue.png` |
| Your website | `desktop-installation.png` | `phone-installation.png` |
| Work together | `desktop-coordination.png` | `phone-coordination.png` |
| Direct Foundation demo entry | `desktop-foundation-deep-link.png` | `phone-foundation-deep-link.png` |

No unresolved visual defect was observed within this capture scope. Supplier stock, real ordering, invoices, email delivery and structural/hydraulic certification were not exercised or claimed.
