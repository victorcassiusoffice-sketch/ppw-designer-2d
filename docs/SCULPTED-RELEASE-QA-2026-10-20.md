# One Live Build — Sculpted Ocean release QA

Release batch: 20 October 2026. Review continues into 21 October Mauritius time. This report describes the working application and verified assets, not generated marketing mockups.

## Verification status

| Check | Result / evidence |
| --- | --- |
| Full automated suite | **4,205 tests passed across 378 test files**, reported by the release runner. |
| Compilation | Application build and API TypeScript checks passed. |
| Lint | Scoped lint on changed application files passed. |
| Focus regression | 20 Shared workbench/focus tests passed, including fresh direct opening, Preferences-first Escape, and hidden/reopened ownership. |
| Compiled desktop/phone routes | **Final 18 cases passed** after the services/materials skin bridge and final product calibration: zero console/page/network errors, attempted writes or horizontal overflow. See `qa-sculpted-compiled-2026-10-20/report.json`. |
| Product placement | Compiled basin checks at 1280px and 390px passed with zero recorded errors or writes. 2D, 3D, selection, product details and quarter-turn captures: `qa-merchant-basin-2026-10-19-compiled/`. Served GLB, overhead PNG and source photo returned HTTP 200. |
| Live feature preview | **Pending release-runner confirmation.** Local captures do not establish that a new deployment is live. No production claim is made here. |

The route harness uses a new browser context per route, blocks mutation requests, records console/page/network errors, checks horizontal overflow, and exercises dashboard dismissal. Screenshots are real Playwright captures at 1280 × 900 and 390 × 844. The last services/materials change is CSS only; it preserves layouts and drawing colours.

## Reference fidelity

| User reference | Implemented match | Evidence |
| --- | --- | --- |
| `Design/Theme 2.jpeg`: mineral blue background, dark navy spine | Shared semantic Ocean palette, fine surface grain, navy build rails and dashboard navigation | `qa-sculpted-compiled-2026-10-20/desktop-shared.png`, `desktop-project.png`, `desktop-plan.png` |
| Raised frosted controls and four softly coloured cards | Directional soft shadows, highlights, rounded controls, teal active states; four metric cards use actual measured project data | Shared/Project captures; tokens in `src/i18n/preferences.css` and `src/styles/tactileSkins.css` |
| Consistent application appearance | 2D/3D chrome, preferences, catalogue, Project/Shared dashboards, services controls and material summaries use the same selected skin | Compiled desktop/phone route captures; existing Ivory and Slate preferences are retained |
| `Design/2D theme 2.jpeg`: warm architectural plan | Mineral unfinished surfaces, cut-wall caps, lighter contact shadows and readable dimensions; model-derived overhead images where supported | `qa-architectural-plan-2026-10-19/`, `ARCHITECTURAL-PLAN-2026-10-19.md` |
| Product-specific realism | Espace Maison / Duravit DuraStyle basin uses a reviewed photo-derived textured model and matching measured overhead image | `qa-merchant-basin-2026-10-19-compiled/`, `MERCHANT-3D-PIPELINE-2026-10-20.md` |

## Contrast and interaction

- Token tests require at least **4.5:1** for normal text and **3:1** for focus against their specified flat surfaces. All three skins, four metric backgrounds and navigation colours are covered.
- Axe reported **zero definite contrast violations**, but **36 incomplete gradient/texture contrast nodes per skin** in the Shared workspace. Those require visual review; this is not a claim that every rendered pixel or every application screen passes a complete accessibility audit. See `qa-sculpted-ui-2026-10-19/theme-contrast.json`.
- Ocean now uses dark logo lettering on light surfaces. Shared direct-route focus ownership was repaired; Preferences closes before the workbench, and inactive workbenches release keyboard control. The phone floor selector retains readable space.

## Scale, calculation and scope preservation

The UI skin does not change saved wall/room geometry, flooring assignments, quantities or estimating algorithms. Model renderings use the same canonical product dimensions in both views, including rotation and imported-axis metadata. The basin envelope is 800 × 480 × 170 mm. Physical-envelope and cache-identity tests guard against appearance changes altering the measured footprint. Zoom checks preserve stored geometry.

Merchant descriptions and exact product identity remain authoritative. Product API enrichment affects matching response rows; this release does not migrate/seed the shared database or create supplier orders. Cosmetic unfinished-floor changes do not assign a purchasable floor product.

## Known limits and continuation

- This is a substantial match to the reference palette, hierarchy, tactile depth and plan treatment, **not an exact reproduction of its rendered realism**. Embossed vector icons are not fully modelled 3D icons, and no invented people, progress figures or charts fill the dashboards.
- Cold 2D plan loading can retain legacy silhouettes while measured mesh thumbnails are generated and cached. Software WebGL makes this especially visible. QA waits for image completion; that wait is not a performance promise for physical phones.
- Many existing sofas, outdoor sets and other products remain procedural dimensional approximations. Only individually reviewed product assets should be presented as product-specific models.
- The basin mesh was generated through the established Fal/Hunyuan pipeline, not OpenArt. Its overhead PNG is rendered from that same mesh. Photo-derived fitting does not validate hidden geometry, connection points or manufacturing tolerances; it is not manufacturer CAD.
- Additional product replacements need exact isolated source photos, verified dimensions and reviewed generation. The matching Courts Comfy source image remains blocked by merchant access; no generic replacement was substituted.
- A failed asynchronous plan snapshot currently retains its fallback until reload or cache eviction. A future retry policy is still useful. Future solar/tank onboarding should also align model precedence between plan and 3D; no conflicting current manifest entry was found.

Live confirmation requires the deployed commit and unique feature-preview URL below before this report can be used as publication evidence.
