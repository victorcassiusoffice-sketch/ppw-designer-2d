# Espace Maison measured product pairs — 9 October 2026

This catalogue expansion uses one millimetre envelope per product for the plan and the original procedural 3D model. It adds five items alongside the existing Emilia toilet bowl. These are planning representations, not manufacturer CAD, stock reservations, partnerships, certified installations or completed merchant integrations.

## Evidence and scope

| Catalogue identity | Supplier/manufacturer evidence | Canonical X × plan Z × height Y | Price/availability snapshot |
| --- | --- | --- | --- |
| `espace-emilia-toilet-bowl` (existing) | [Espace Maison toilet, SKU 4067116351545](https://www.espacemaison.mu/products/toilet-1) | 650 × 395 × 400 mm | Existing 8 October snapshot: MUR 7,156 per piece, VAT included. Bowl only; no invented cistern. |
| `espace-durastyle-washbasin-800` | [Espace Maison cabinet washbasin, SKU 4021534850721](https://www.espacemaison.mu/products/washbasin-for-cabinet) | 800 × 480 × 170 mm | Observed 9 October: MUR 10,262 per piece, VAT included. Listed in stock across several branches. 23.7 kg. Cabinet, tap and trap are not included. |
| `espace-duravit-dcode-bidet-224110` | [Espace Maison PROBOOK, page 279](https://fliphtml5.com/nzna/dieq/PROBOOK/); [Duravit exact reference 22411000002](https://pro.duravit.in/pro/html/default/402880943a1b6e1b013a1bd282eb0051.in-en.html?ncat=bidets&nser=7120&product=245285) | 560 × 360 × 385 mm | Quote required. The supplier reference is an older catalogue, not current stock evidence. No Mauritius price was verified. Manufacturer mass: 20.5 kg. |
| `espace-seville-garden-sofa` | [Espace Maison Seville four-piece set, SKU 3700103115997](https://www.espacemaison.mu/products/seville-acacia-wood-garden-sofa-set-4-pieces) | 1140 × 670 × 870 mm | Quote required for this sofa component. The published MUR 29,595 / SET VAT included is for the sofa, two armchairs and table together and is **not** assigned to this one component. Individual sale is unverified. |
| `espace-era-pvc-pn16-110-6m` | [Espace Maison PVC PN16 pipe, SKU 6091242230786](https://www.espacemaison.mu/products/pvc-pipe-pn-16-6-m-x-110-mm) | 6000 × 110 × 110 mm | Observed 9 October: MUR 3,579 per complete 6 m piece, VAT included. Listed stock in Tamarin, Flacq and Beau Vallon. |
| `espace-pvc-electrical-conduit-20-6m` | [Espace Maison conduit, SKU 6091242230939](https://www.espacemaison.mu/fr/produits/tuyau-lectrique) | 6000 × 20 × 20 mm | Observed 9 October: MUR 161 per complete 6 m piece, VAT included. Listed stock in Tamarin, Forbach and Flacq. The listing does not identify a manufacturer. |

Stock changes after observation; the app does not claim real-time inventory. Prices are dated public references, not a live checkout offer. All unknown prices use `price_on_request: true`, absent `price_snapshot`, and the existing excluded numeric-zero sentinel.

The Seville page has a conflicting set-level specification table. The sofa uses the explicit sofa component dimensions in its product description; the set-level dimensions and 40 kg set weight are deliberately not reused for the individual sofa.

Pipe diameters are **published planning widths**, used only for the circular outside drawing envelope. The listing does not verify internal bore, wall thickness, socket enlargement, cable fill, pressure duty or installation approval. No nominal-bore-to-outside-diameter conversion is performed. `pipe.boreVerified` remains false. A placed stock-length object is separate from a routed service run; cutting waste and fittings are not silently added or counted twice.

The cabinet basin's 680 mm bottom elevation is an editable placement aid, giving a nominal 850 mm top for this 170 mm-high body. It is not a mounting recommendation; support and installation height must be checked against the manufacturer drawing. Bidet and toilet port locations are not inferred from overall dimensions.

## Source images and OpenArt

The official product pages were researched for photographic references. Their web-readable image links returned a placeholder, direct page retrieval was blocked by Cloudflare, and the IAB browser was unavailable in this research agent. No placeholder was published as a real product photo. No OpenArt generation was performed, and no generated raster is represented as engineering geometry.

The existing generation entry point is `src/lib/topdown/openArtTopDown.ts`: it builds a photo-conditioned request for an injected transport. It is not itself a connected public API. Workflow notes are in `docs/TOPDOWN-IMAGE-WORKFLOW-2026-08-24.md`; `scripts/slot-topdown.mjs` normalises framing while retaining canonical measurements. Future verified photos can populate the source-photo metadata without replacing the dimensional definition. A separately authorised generated asset should retain its original reference and quality-control record.

## Implementation and verification

- `src/data/serviceProducts.ts`: canonical IDs, dimensions, evidence, quote status and original SVG plan views.
- `src/components/three/serviceProductPreview.ts`: matching ceramic basin/bidet, acacia sofa and pipe bodies. Decorative geometry is fitted to the verified envelope; bore and omitted accessories are never invented.
- `src/data/__tests__/serviceProducts.test.ts`: actual 3D vertex bounds, plan dimensions, price-unit semantics, quote-required cases, empty-pipe classification, placement and rotation.
- Catalogue regressions cover each passive product's zero electrical demand and Seville's outdoor placement.

The supplier shelf and ordinary catalogue use the same product records; all views retain one identity and one measured envelope. Real photo retrieval and generated photo-conditioned visuals remain a separate incomplete step.

## Quote-required cost audit

The supplier bidet and sofa have no payable price. Cart line rendering, Stripe/PayPal client payload builders and checkout controls already excluded/blocked quote-required products. A follow-up fixed unqualified zero/partial total displays in the cart strip, mini pill, drawer, cart and checkout summaries, HouseCostPanel and analysis footer using `quoteAwareAmount`. A quote-only design reads "Quote required"; a mixed design shows its known amount plus "quote" and an incomplete estimate label. The quoted portion is never converted into a zero-price marketplace fee.

Regression coverage uses the actual bidet and sofa IDs rather than only mocks: quote-only and mixed carts reject both payment payload builders. Server payment repricing rejects their reference IDs and SKUs even when a caller supplies a positive amount. These reference products are not added to the server's payable inventory. The same repricer protects Stripe, PayPal and Gumroad. Preview transaction guards remain independent of the browser URL or client flags.

Verification: 122 catalogue/model tests and 98 focused cart/payment/showcase tests passed; changed files lint clean. The root integration owner is updating the remaining HouseWorkspace/RoomCanvas toolbar amount labels and saved lead quote metadata in concurrently owned files.
