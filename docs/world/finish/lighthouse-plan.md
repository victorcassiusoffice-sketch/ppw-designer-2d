# World Finish: inherited Lighthouse triage

Read-only source/artifact review, 28 October 2026. No repository changes, builds, browser runs, thresholds or dependencies changed.

## Evidence and a necessary distinction

Reviewed final Fix 1 Walk artifacts in `work/world-fix1/lighthouse-walk-docs/lhr-1793180447047.json` and `lhr-1793180458762.json`, the corresponding assertion comparison, and both common source/configuration paths. The artifacts identify Lighthouse **11.4.0**, Chromium host **156.0.0.0**, a desktop preset and one run per audited URL. CI serves `dist` with LHCI's static SPA server, so it serves **index.html**, not production host middleware's OLB shell or Vercel response headers.

There are **22 route/assertion failures but 14 distinct audit IDs**. Four assertions target audits with `score: null` and `scoreDisplayMode: informative`: `csp-xss` and `total-byte-weight`, on each route. LHCI's inherited recommended `minScore >= 0.9` reports them as actual 0. These cannot be made into passing scored assertions merely by changing application content. Do not count a lower payload or a stronger CSP as fixing that assertion, and do not alter the forbidden configuration to suppress it.

The literal static byte gate independently constrains otherwise safe global markup/accessible-name improvements. Adding a manifest link or changing TopBar changes an early asset. Record this contract conflict; do not hide it with padding, an altered baseline, or a reduced-feature build.

## Recommended implementation order

### 1. Missing robots file: two failures, safe isolated fix

Add `public/robots.txt`. The actual failure is the SPA fallback returning HTML for `/robots.txt`, producing 21 syntax errors. Preserve existing effective crawl policy (`User-agent: *` with an empty `Disallow:`) unless an established repository policy requires explicit exclusions. This is a new static file, not a script or an initial-picture fetch, and does not touch estimates.

Add a focused test in a new file, for example `src/lib/__tests__/publicRobots.test.ts`: ensure real plain-text content exists, a crawler directive is present, no HTML markup is emitted, and no public demo/pitch is inadvertently disallowed. Confirm both Lighthouse routes pass `robots-txt` and the actual deployed request returns plain text instead of an HTML rewrite. Do not change LHCI's server or assertion settings.

### 2. Plumbing hero image: three failures, isolated pitch chunk

Source: `src/pages/sales/PlumbingPitchPage.tsx:50` (hero image `/showcase/plumbing-workspace.jpg`). Current JPEG is **69,202 bytes**, rendered **642 × 361** by the captured desktop run. It has no intrinsic width/height or priority. The audit attributes **51,799 bytes / 74.85%** potential responsive-image waste, and **168.3 ms** discovery opportunity.

Add the real intrinsic `width`/`height`, `fetchPriority="high"`, and `decoding="async"` to the hero. Supply a genuine smaller derivative and `srcSet`/`sizes` retaining the full-resolution image for high-density/wide layouts; inspect both sizes and avoid changing the screenshot's meaning or aspect ratio. Verify the original source dimensions before choosing attributes (not measured in this read-only pass). The second screenshot in the next chapter at line142 should also receive its real intrinsic dimensions as part of the same concern.

Add a new meaningful rendering regression in the existing sales/pitch test area: correct intrinsic ratio and eager/high priority only on the first hero; responsive candidates and sizes usable at desktop/phone; second chapter image retains its dimensions. Browser evidence should inspect `currentSrc`, natural size, rendered ratio, no horizontal overflow and legibility. These pitch-only edits do not load on `/demo?view=3d&pitch=1` if chunking remains intact.

`fetchPriority` may not remove the old Lighthouse11 `prioritize-lcp-image` discovery failure by itself. If it persists, a route-specific early preload can be considered, but do not put an unconditional plumbing image preload in either shared shell: it would add a request before the demo's first picture. A preload injected only after the hero renders is too late and must not be claimed as a fix. Keep the final failure if satisfying the exact old audit requires breaking the initial-byte contract.

### 3. Plumbing FX request: one failure, behavior fix but early-byte cost

Actual console error is a **401** from `https://api.exchangerate.host/latest?base=USD&symbols=MUR,EUR,GBP`. Source `src/main.tsx:72` calls `bootstrapFx()`. `src/store/currencyStore.ts:61` already skips `isPitchEmbed()` (public `/demo` and `?pitch=1`), but `/pitch/plumbing` without that query is not recognized. The pitch is price-free and has no use for exchange rates.

Safest behavioral repair is skipping FX bootstrap on **price-free public pitch routes only** while preserving existing designer/shop/cart behavior and all existing rates/math. Do not change the provider URL, fallback rates, estimates, or acquire an API key. New regression should exercise `/pitch/plumbing` and other supported public pitch paths with zero refresh calls, plus existing `/designer`, `/studio`, `/shop` refresh behavior. Existing tests: `src/store/__tests__/currencyBootstrap.test.ts`; preserve these and add a separate test file if keeping pre-existing tests byte-identical.

This edits an early module and therefore cannot be waved through the literal static-size gate. A change to `isPitchEmbed()` itself would affect broader demo behavior; prefer a narrowly scoped bootstrap guard if authorized by the eventual baseline contract. Report that static cost honestly.

### 4. Rooms trigger accessible name: one failure, real accessibility fix but early-byte cost

Actual node: `src/components/TopBar.tsx:1779`, `data-testid="rooms-trigger"`. Its explicit accessible name is `Demo · Living room · 5 — Open rooms list`; the two breakpoint-specific child labels and truncation lead axe to reject matching the visible label. Avoid guessing that changing punctuation fixes all viewport/locales.

Use the visible responsive label as the accessible-name source, with a separate visually-hidden action label or description and a valid icon-only phone name. Do not maintain a competing `aria-label` that can diverge from displayed text. Test natural/accessibility names with property and room names containing punctuation, desktop and icon-only phone states, translated action, and expanded menu behavior. Existing trigger behavior must remain intact. A DOM-only string test cannot prove CSS-selected visible labels; capture the browser accessibility tree/axe result at both breakpoints.

This changes the early App/TopBar bytes; record its conflict with exact static equality. It is not an export-alias exception.

## All inherited assertions and final disposition criteria

| Audit ID | Routes/count | Source/cause | Safe disposition / reason to remain |
|---|---|---|---|
| robots-txt | demo + pitch /2 | No `public/robots.txt`; SPA HTML fallback | Fix as above; requires real deployed plain-text response. |
| unsized-images | pitch /1 | Hero at PlumbingPitchPage:50 | Fix actual width/height and verify rendered aspect ratio. |
| uses-responsive-images | pitch /1 | 69,202-byte full-size hero at 642×361 | Genuine responsive source variants; verify currentSrc and visual quality. |
| prioritize-lcp-image | pitch /1 | Script-discovered hero;168.3ms opportunity | High fetch priority first; only route-specific preload if needed and compatible with demo gate. Never add global unused preload. |
| errors-in-console | pitch /1 | Unneeded exchange-rate request returns401 | Narrow price-free-pitch bootstrap skip; preserve all estimate/FX behavior elsewhere; early-byte contract must be measured. |
| label-content-name-mismatch | demo /1 | TopBar rooms trigger responsive labels versus explicit aria-label | Correct accessible name from visible content; test desktop/phone/localization; early-byte contract conflict remains explicit. |
| installable-manifest | demo + pitch /2 | PPW `index.html` lacks manifest link | OLB shell already has valid manifest with192/512icons; don't relabel PPW as OLB just to pass CI. A correctly branded PPW manifest/link is behaviorally reasonable but changes early HTML, adds browser manifest work, and requires actual installability proof. Do not claim service-worker support without implementing/testing it; no service-worker cache was added. |
| maskable-icon | demo + pitch /2 | No fetched manifest | Same PPW manifest issue; OLB existing maskable icon is not proof PPW audits pass. |
| splash-screen | demo + pitch /2 | No fetched manifest | Same PPW manifest issue; required manifest properties and icon must be real. |
| themed-omnibox | demo + pitch /2 | Existing theme meta exists but no manifest | Same PPW manifest issue; current meta already#0F766E, OLB#1E3D32. |
| valid-source-maps | demo /1 | Public source maps intentionally forbidden | **Keep.** `vite.config.ts` uses hidden maps only for configured private Sentry upload, deletes them and fails builds if any public map remains. Existing `src/lib/__tests__/buildSourcemapSafety.test.ts` enforces this policy. Publishing maps to satisfy audit would reverse a security/disclosure policy. |
| unused-css-rules | demo + pitch /2 | Demo App CSS86.56% unused; shared main76.26%; pitch main89.82% and pitch-tactile100% on first chapter | Route/chapter CSS splitting is potentially safe but needs full responsive/all-panel visual regression, not deletion based on one captured frame. It also changes early CSS file/bytes. Keep any residual unless substantive split proves all styles remain and literal static contract permits it. |
| total-byte-weight | demo + pitch /2 | Informative score-null audit; demo1,261,522bytes | **Keep inherited assertion:** payload reduction is worthwhile but cannot change null into0.9. Threshold/config unchanged. Preserve numeric transfer evidence separately. |
| csp-xss | demo + pitch /2 | Informative score-null audit; LHCI static server lacks enforcement header | **Keep inherited assertion:** strong CSP needs route/provider/worker/reporting coverage; Vercel-header edits don't affect LHCI static server. It is not safe to insert a simplistic restrictive global meta that breaks map/workers/checkout, and the informative minScore remains unscored anyway. |

Counts sum to22. Final classification must use new actual artifacts after any repairs; do not predeclare the number fixed from this plan. Keep the baseline assertion IDs and unchanged thresholds alongside each final list. Application and test changes should be ported identically where shared; branch-specific static bytes measured separately.

## Cross-cutting lesson

Inspect the full audit JSON, not just `assertion-results.json`: null informative audits and the static-server PPW shell explain several inherited failures. Genuine end-user fixes should be verified even if an old minScore assertion cannot become green. A fixed screenshot/pitch route is not permission to add early demo requests or expose source maps.
