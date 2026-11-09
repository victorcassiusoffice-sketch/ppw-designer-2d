# Build dashboard: local acceptance evidence

This is a **local coordination pilot**, not a hosted collaboration, supplier notification or payment service. Tests used compiled builds on two dedicated loopback servers: the Designer on `127.0.0.1:5293` and [Trade Folder](https://github.com/victorcassiusoffice-sketch/tradefolder) main `911c0e7918d97ffcb22e4d6af91250937c20638f` on `127.0.0.1:5294`. No accounts, codes, production data or real clients were used.

## Final results (9 November 2026)

Tested the rebuilt candidate after bringing main `228ac97` forward. All **3/3 exchange journeys and 10/10 public-route probes passed**. The latter cover Plan and House on both `/demo` and `/embed/designer`, plus `/pitch/plumbing`, at 1280 and 390 pixels. Tampered public URLs requesting the private panel/answer fragment did not expose the dashboard or fetch private assets (including `/assets/studio/` styles and scripts). Across the runs: zero browser console/page/HTTP errors, zero attempted non-read requests and zero calls to a real backend.

| Width | Text scale | Effective control targets audited across three states | Minimum width × height | Horizontal overflow | Lowest sampled normal-theme text contrast | Result |
|---|---:|---:|---:|---:|---:|---|
| 1280 | 100% | 63 | 48 × 48 CSS px | 0 | 6.01:1 | Pass |
| 390 | 100% | 55 | 48 × 48 CSS px | 0 | 6.01:1 | Pass |
| 360 | 115% | 53 | 48 × 48 CSS px | 0 | 6.01:1 | Pass |

Contrast was sampled from computed foreground and background colours for the main title, focal-block heading/body/kicker/action, money label, row metadata and quote chip. All eight samples exceeded 4.5:1. The short request in the 390 px run was **731 characters**; it decoded to the same request hash and its QR rendered. The desktop request included a **16,634-byte room sketch** and correctly used a file rather than offering an oversized link or QR. All widths detected the revised route, issued a new request with revision 2, and preserved the first send. The desktop CSV and backup checks were run offline.

## What was exercised

- [Desktop, 1280 × 800](journey-1280.json): open a real fixture plan, make draft work packages, review the measured pipe/fixture lines and download the `.olbpackage.json`. The file is then chosen in **the actual Trade Folder app**. A tester confirms the job, enters separate line rates, creates the quote, downloads Trade Folder's signed file and imports it into One Live Build. Trade Folder also creates a progress file against that same request and quote. One Live Build requires a named decision maker, and the invoice and recorded payment are separate actions. Real prices, payment details and raw answers are not included in this public evidence.
- [Phone, 390 × 844](journey-390.json) and [360 × 844, text at 115%](journey-360.json): repeat the dashboard workflow with a fresh property and fresh local ledger. For these two cases the same pinned Trade Folder signing code creates the quote, progress and invoice fixtures. At 390 the actual encoded `#w=` answer URL prefills the review sheet but does not save anything until confirmation.
- Every run checks that a repeated file changes nothing, private budget/notes do not enter the work file, Hide amounts conceals financial values, money totals match the accepted files in their currency, and the changed service run requires review before sending revision 2. The new request keeps the same package identity; the earlier send and signed content remain intact. The desktop case also checks backup export, refusal of a corrupt restore, and successful restore of the valid backup. Invoices are test files signed by the pinned protocol; no money moves.
- The test seeds **only** the normal property storage shape. It never injects an exchange ledger or vendor job. The plan-change test edits that property fixture, then reloads the actual editor; this tests hydration, fingerprint/revision handling and refreshed quantities, not a simulated wall gesture. Real application dialogs, inputs, button actions, downloads and file imports are used everywhere else.

## Pictures and checks

Compare [the original 2D plan](01-original-plan.jpg) with [the exported plan picture](02-exported-plan.jpg). Both have the small bathroom at upper left, wider kitchen to its right and utility wing **below** the bathroom. The sink sits at the left, next to a route extending downward. The test checks every exported room vertex against the source: same metre coordinates, no recentering or Y inversion. The [Trade Folder file preview](tf-checked-work-desktop.jpg) is a separate, genuine receiver screenshot. Its optional image is one existing room sketch, not a photo of the entire building or a premium-view bypass.

[Desktop dashboard](dashboard-1280.jpg) · [Phone dashboard](dashboard-390.jpg) · [Enlarged phone text](dashboard-360.jpg) · [Greyscale focal-point check](dashboard-focal-point.jpg). Dark “Needs you” is intended to be the focal point; the money strip and register are secondary. Amounts are hidden in dashboard pictures. The layout audit measures document and active-sheet width and effective pointer target area (including associated labels) for the dashboard's rendered controls at empty, populated and inspector checkpoints.

Tasks from an already open dashboard, excluding text entry and the native file chooser: **send** = select package → build file → download; **add answer** = Add an answer → choose file → save after preview; **decide** = open package → name/select role → confirm. The three-tap figure describes the designed command path, not a human timing study. Updating quantities, typing a new scope, preparing the first draft and recording more financial detail are separate actions.

## Reproduce

Start your own builds/servers on the stated ports with `--strictPort`. Never point the harness at production or at another builder's server. From this product checkout:

```text
node tools/link/qa-dashboard.mjs
node tools/link/qa-public.mjs
```

`qa-helpers.mjs` permits only the two local origins; any API GET gets a local empty response, the optional existing external FX startup GET gets a local unavailable/empty-rate response, and any attempted write is aborted and counted. No API data or exchange rate is fabricated for a quantity or financial total. The initial desktop rehearsal aborted the FX request instead of returning that unavailable response; its resulting browser network error was retained outside Git at `../olb-link-scratch/browser/first-desktop-aborted-fx.json`. [Public boundary checks](public-routes.json) exercise direct attempts to open the pilot via a public route. Phone tests are viewport/touch emulation, not physical-device results.
