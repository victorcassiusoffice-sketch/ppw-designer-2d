# Local pitch visual QA — 10 October 2026

Local preview: http://127.0.0.1:5173. These are built-app screenshots, not proof of a live deployment. No authentication bypass, form submission, order or publishing action was performed. A local preview does not validate deployed middleware or backend availability.

| Route | Width | Outcome | Horizontal overflow px | Console errors | Page errors | HTTP failures |
|---|---:|---|---:|---:|---:|---:|
| /pitch/plumbing | 1280 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/construction | 1280 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/merchants | 1280 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/developers | 1280 | Loaded | 0 | 0 | 0 | 0 |
| /studio/sales | 1280 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/plumbing | 390 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/construction | 390 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/merchants | 390 | Loaded | 0 | 0 | 0 | 0 |
| /pitch/developers | 390 | Loaded | 0 | 0 | 0 | 0 |
| /studio/sales | 390 | Loaded | 0 | 0 | 0 | 0 |

## Captures

- [pitch-plumbing-desktop-overview.png](./pitch-plumbing-desktop-overview.png) - Room Designer: plumbing suppliers and installers.
- [pitch-plumbing-desktop-your-catalogue.png](./pitch-plumbing-desktop-your-catalogue.png) - Room Designer: plumbing suppliers and installers.
- [pitch-plumbing-desktop-work-together.png](./pitch-plumbing-desktop-work-together.png) - Room Designer: plumbing suppliers and installers.
- [pitch-construction-desktop-overview.png](./pitch-construction-desktop-overview.png) - Room Designer: construction companies and estimators.
- [pitch-construction-desktop-foundation.png](./pitch-construction-desktop-foundation.png) - Room Designer: construction companies and estimators.
- [pitch-construction-desktop-plumbing.png](./pitch-construction-desktop-plumbing.png) - Room Designer: construction companies and estimators.
- [pitch-merchants-desktop-overview.png](./pitch-merchants-desktop-overview.png) - Room Designer: merchants and retailers.
- [pitch-developers-desktop-overview.png](./pitch-developers-desktop-overview.png) - Room Designer: property developers.
- [pitch-employees-desktop-overview.png](./pitch-employees-desktop-overview.png) - Room Designer: employee training and sales.
- [pitch-employees-desktop-demo-lab.png](./pitch-employees-desktop-demo-lab.png) - Room Designer: employee training and sales.
- [pitch-employees-desktop-all-links.png](./pitch-employees-desktop-all-links.png) - Room Designer: employee training and sales.
- [pitch-plumbing-phone-overview.png](./pitch-plumbing-phone-overview.png) - Room Designer: plumbing suppliers and installers.
- [pitch-plumbing-phone-your-catalogue.png](./pitch-plumbing-phone-your-catalogue.png) - Room Designer: plumbing suppliers and installers.
- [pitch-plumbing-phone-work-together.png](./pitch-plumbing-phone-work-together.png) - Room Designer: plumbing suppliers and installers.
- [pitch-construction-phone-overview.png](./pitch-construction-phone-overview.png) - Room Designer: construction companies and estimators.
- [pitch-construction-phone-foundation.png](./pitch-construction-phone-foundation.png) - Room Designer: construction companies and estimators.
- [pitch-construction-phone-plumbing.png](./pitch-construction-phone-plumbing.png) - Room Designer: construction companies and estimators.
- [pitch-merchants-phone-overview.png](./pitch-merchants-phone-overview.png) - Room Designer: merchants and retailers.
- [pitch-developers-phone-overview.png](./pitch-developers-phone-overview.png) - Room Designer: property developers.
- [pitch-employees-phone-overview.png](./pitch-employees-phone-overview.png) - Room Designer: employee training and sales.
- [pitch-employees-phone-demo-lab.png](./pitch-employees-phone-demo-lab.png) - Room Designer: employee training and sales.
- [pitch-employees-phone-all-links.png](./pitch-employees-phone-all-links.png) - Room Designer: employee training and sales.

## Browser findings

No page errors, console errors or HTTP failures were recorded.

## Visual inspection — completed 10 October 2026

Status: **BUILT-NOT-LIVE**. Final captures use the local build containing `App-DMQdCeGK.js`; the existing 9 October work folder is retained for continuity. Publication remains pending the user's Y.

- Employee Demo lab: the 390px menu keeps each exercise title and duration inside its own row. The corrected menu scrolls instead of shrinking its buttons. Desktop layout remains readable.
- Construction: foundation copy has clear paragraph spacing at 1280px and 390px. Plan import, plumbing and electric chapters retain their interactive Try this step entry points, with redundant empty screenshot placeholders removed. No clipped text or overlapping controls were found in the inspected captures.
- Plumbing catalogue and collaboration cards wrap correctly on phone and remain aligned on desktop. Supplier/model limitations are visible in the catalogue copy.
- Merchant and developer overview pages keep navigation, meeting links and primary actions visible at both widths. Their concept imagery is labelled; it is not evidence of exact manufacturer model rendering.
- Employee All links displays the current origin, which is localhost in this local review. Public sharing links must be generated from a verified deployment after publication is authorized.

The final run produced 22 screenshots across ten route/viewport combinations, with zero console errors, page errors, failed requests, HTTP failures, broken images, horizontal overflow or capture retries. The 20 price-free captures were visually inspected and copied unchanged to `C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-09-foundations-services\shots`; source and destination hashes match. Both construction overview captures remain in the repository QA folder only because their existing app screenshot contains a cart price.

Scope: read-only page loads, pitch tabs and construction section navigation. No form was submitted, and no ordering, merchant integration, authentication middleware or deployed backend was validated by this local static preview. Existing construction image assets were retained; the new screenshots above are QA evidence only and have not been published as application assets.
