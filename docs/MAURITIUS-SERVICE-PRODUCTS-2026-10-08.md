# Mauritian plumbing and electrical product references — 8 October 2026

This is a public catalogue evidence record, not a partnership, supplier stock feed, installation approval or purchase offer. These suppliers have relevant Mauritian ranges; no independent market-share ranking establishing “the biggest” was found. Prices below are public reference snapshots in MUR per individual item, including the supplier-stated tax. Confirm the SKU, offer, delivery and installation directly with the supplier before procurement.

## Five paired products

Every row has one canonical definition in `src/data/serviceProducts.ts`. That definition produces the catalogue dimensions in centimetres, plan SVG and the 3D envelope in metres. Simplified original graphics preserve the published envelope; they are not manufacturer CAD, exact appearance, connection coordinates, or installation clearances.

| Product | Published dimensions and axis mapping | Reference price | Source and observed listing |
| --- | --- | ---: | --- |
| Resiglas 1000L A water tank | 1,600 L × 1,050 W × 1,085 H mm. Catalogue X=160 cm, plan depth=105 cm, vertical=108.5 cm. Working capacity 1,000 L; external envelope is not the usable volume. | 14,500 MUR / piece, VAT included | [Manufacturer product page](https://resiglas.mu/product/water-tank-1000l-a/); listed in stock. |
| Resiglas 1000L C water tank | 1,320 L × 1,320 W × 1,055 H mm; empty weight 36 kg, working capacity 1,000 L. | 21,850 MUR / piece, VAT included | [Manufacturer product page](https://resiglas.mu/product/water-tank-1000l-c/); listed in stock. |
| Emilia toilet, retailer SKU 4067116351545 | 650 L × 395 W × 400 H mm, 25.9 kg. Shown as a bowl without an invented cistern. Supplier lists diameter 110 mm but no verified drain centre or rough-in. | 7,156 MUR / piece, VAT included | [Espace Maison product page](https://www.espacemaison.mu/products/toilet-1); shop quantities listed on the public page. |
| Legrand Belanko S surface mounting box 613351 | Face width 146 mm, face height 86 mm, projection from wall 35 mm. Catalogue X=14.6 cm, plan depth=3.5 cm, vertical=8.6 cm. | 105 MUR / piece, tax included | [Electrical.mu product page](https://electrical.mu/products/legrand-belanko-s-surface-mounting-box-bs-standard-2-gang); listed in stock. [Manufacturer dimensions](https://www.legrand.com.vn/en/catalog/products/belanko-s-surface-mounting-box-bs-standard-1-gang-86x146x35mm-613351). Empty box only; no electrical device included. |
| HEX HEP polymer earth inspection pit, housing only | 308 L × 308 W × 214 H mm; 2.5 kg. Earthing electrodes, conductor and earth bar are separate. | 2,735 MUR / piece, tax included | [Electrical.mu product page](https://electrical.mu/products/polymer-earth-pits); listed in stock. |

Source checks were performed on **2026-10-08**, using the public pages/search-index representations supplied by the web research tool. These are not live-inventory API responses. Several retailer pages contain template text such as “Sale Sold out” alongside explicit “Availability: In Stock”; the app deliberately promises no current availability. The explicit availability field was recorded, not the template badge. The durable schema retains date, unit, tax status, price source and availability provenance together.

## References retained without inventing scale

- [Espace Maison ERA CPVC 20 mm × 4 m](https://www.espacemaison.mu/products/cpvc-pipe-20-mm-x-4-m), SKU 6091242233206: 282 MUR per 4 m piece, VAT included. The retailer supplies a 20 mm designation and height/width fields, but no explicit distinction between OD and bore. Use the reference for a stock-length cost only; do not silently turn nominal 20 mm into measured outside diameter. Existing HPL pipe presets explicitly sourced as OD remain separate.
- [HPL technical catalogue](https://hplpipes.mu/wp-content/uploads/2025/04/HPL-Catalogue-View-2.pdf): existing catalogue presets distinguish OD, pressure pipe, drainage, sewer and electrical conduit. No verified current HPL retail price was supplied in this research, so none was invented.
- [Legrand 613350 official catalogue](https://www.legrand.com/ecatalogue/en/catalog/products/belanko-s-1-gang-surface-mounting-box-bs-standard-1-gang-86x86x35mm-glossy-thermoplastic-ivory-for-fast-surface-installation-613350): headline and retailer say 86 × 86 × 35 mm, while the official technical table reports width 146 mm. **Deferred** pending corrected technical evidence; do not silently choose one.
- [Espace Maison DuraStyle washbasin](https://www.espacemaison.mu/products/washbasin-1): description says 60 × 44 cm while width field says 44 mm. Other basin/toilet pages have width 0 or transposed heights. **Deferred** until exact SKU drawings reconcile the fields; an automatically scraped numeric field is not a measured truth.
- Existing Duraco 1000 L entry retains its disclosed retailer conflict: 1,140 × 1,305 mm versus 1,130 × 1,260 mm. It is not promoted as a newly verified manufacturer envelope. [Duraco official supplier information](https://www.duraco.mu/) confirms the manufacturer and reseller network, but not a matching exact drawing resolving this conflict.
- [HEX concrete inspection pit](https://electrical.mu/products/concrete-earth-housing-pit): clear dimensions are available but the selected listing says out of stock; not included in this starter five.

## Accuracy and onboarding rules

1. Record supplier SKU, all three envelope dimensions, unit, measured-axis convention, source and review date before publishing a 2D/3D pair. Reject zero, NaN and negative dimensions. A pipe nominal size, a connector size, a socket face size and a packaged shipping box are different measurements.
2. Generate both views from the same record. Tests compare the actual 3D vertex bounds, plan aspect ratio, catalogue centimetres, placement elevation and rotation. Never resize a product by matching a photograph.
3. Keep tank capacity and full operating load separate from outer envelope volume and empty weight. Unknown weights use the existing catalogue's zero sentinel and an explicit note; never use that as a structural load.
4. Keep each purchase basis explicit: item, metre, stock length or pack. Price the required purchase quantity after waste/stock-length rounding. Snapshot unit price is not a supplier quote; unknown prices must stay unknown rather than silently total zero.
5. Service ports are separate reviewed data. Envelope provenance does not establish pipe connection position, hydraulic suitability, outlet height, electrical protection, earth resistance or installation compliance. User-planned mains and fixture routes must remain coordination geometry until reviewed.
6. New merchant records should carry permission for supplied media, technical verification and both renderers together. Exact manufacturer CAD can replace the simplified body after fitting to the same approved dimensions.

## Implementation locations

- Canonical records and paired plan assets: `src/data/serviceProducts.ts`.
- Original measured 3D factory: `src/components/three/serviceProductPreview.ts`.
- Schema price provenance: `src/data/products.schema.ts`, `ProductPriceSnapshot`.
- Catalogue integration: `src/data/products.ts`.
- Dimension/price/rotation regression coverage: `src/data/__tests__/serviceProducts.test.ts`.

Prices are intentionally confined to the product repository/application. Do not copy this table into the Obsidian handoff because that handoff has a separate no-prices rule.
