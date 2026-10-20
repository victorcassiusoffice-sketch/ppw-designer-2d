# Live City Build browser verification — 13 October 2026

Approved deployment: https://ppw-designer-2d-21ijghs0m-victor-ppw.vercel.app

Verified application commit: `3f046cc655ab6e79803444038c8567dbe88dd445` (Vercel Preview).

## Browser results

Four headless Chromium cases passed using normal DNS and normal TLS, without a resolver override:

| Demo entry | Viewport | Console errors | Page errors | Failed requests | HTTP errors | API/form writes |
| --- | --- | --- | --- | --- | --- | --- |
| `/demo?view=2d&panel=city&pitch=1` | 1280 × 900 | 0 | 0 | 0 | 0 | 0 |
| `/demo?view=3d&panel=city&pitch=1` | 1280 × 900 | 0 | 0 | 0 | 0 | 0 |
| `/demo?view=2d&panel=city&pitch=1` | 390 × 844 | 0 | 0 | 0 | 0 | 0 |
| `/demo?view=3d&panel=city&pitch=1` | 390 × 844 | 0 | 0 | 0 | 0 | 0 |

The checks verified actual City Build controls, all five City sections, return to the building and reopening City. The eco district was loaded only in disposable browser-local storage. No form was submitted and no API write was attempted. Normal font and exchange-rate GET resources were allowed in the final run.

City opens in its 2D plan in both entry URLs. Use the **3D button inside City** to display the measured district; the outer `view=3d` parameter does not automatically select City's own 3D mode. The final 3D screenshots show rendered roads, utility routes, building envelopes, PV area and landscaping. Select/pan keeps that 3D scene visible.

## Visual inspection

Eight PNGs were captured and inspected, with an entry and district screenshot for each case. No toolbar overlap, clipped controls or horizontal overflow was observed. Phone layout scrolls vertically below the canvas. Full-site labels and assets are small on the 390 px overview, so detailed inspection requires zooming; this is a remaining presentation limitation rather than a failed layout. The models are planning geometry, not photoreal manufacturer models. Physical-device GPU and native-keyboard behavior were not tested.

Files: `city-live-{desktop|phone}-{2d|3d}-{entry|district}.png` and `live-browser-results.json` in this folder.

## Connectivity and health evidence

Connectivity was intermittent during verification. An early Node health request failed at TCP connection; a later normal-DNS attempt returned HTTP 200 with the exact expected SHA. The final browser interaction run passed all four cases using normal DNS, but its separate Node health precheck again timed out. That attempt is retained as `initialNodeHealth` in the JSON.

A final cache-busted Chromium health GET returned HTTP 200, `env: preview` and the expected SHA at `2026-10-13T17:32:58.083Z`. This health-only confirmation used a temporary process-level host mapping to Vercel edge `76.76.21.61`, preserving the original hostname and normal TLS validation. The mapping did not alter machine DNS or the browser interaction tests. The parent release verifier also recorded a normal-DNS cache-busted curl HTTP 200 with the same SHA at `2026-10-13T17:10:33Z`, separately from these child-agent screenshots.

The initial test intentionally blocked two existing external GET resources and therefore induced console errors; that artificial restriction was removed before the successful final run. The initial desktop canvas assertion was also too short for the lazy 3D load; the final check waits for the actual canvas and rendered geometry. The obsolete failure PNG was removed so the gallery contains only the final eight captures.

No product source, deployment setting, customer data, supplier order, migration or live message was changed by these checks. No commit or push was performed by this verifier.
