<!-- oct5-studio-release:start -->
## Studio release checkpoint — 5 October 2026

**Status: live verified on production.** Victor explicitly authorized this release to production on 5 October. Commit `f0943b1f0d82a3047c34313cb30559755171bee9` is deployed on `designer.ppwellness.co`. Production deployment `6847744765` succeeded; health and locked/unlocked access checks passed on the custom domain. Production browser verification also passed at 390 × 844: the code gate unlocked, the furnished 3D house rendered, switching to 2D preserved saved plans, and body width remained 390px with no horizontal overflow. Additional 320px/390px interaction checks below were performed on the verified feature preview. Continue development on `cursor/feat-3d-flooring-hud-bc95`; this release authorization is not a standing instruction to publish future changes to main. Preserve all existing checkouts and recovery work.

**Verified final feature preview:** https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app — Vercel deployment `6847665366`, commit `f0943b1`. Its app fully rendered in the browser after entry with the requested access code `2123`. The preceding application commit `5e4d873` and its `jymc` preview also passed full QA; use the final URL above for review and demos. **Live production Designer:** https://designer.ppwellness.co/designer. Unique production deployment: https://ppw-designer-2d-pi4q9uhuq-victor-ppw.vercel.app (deployment `6847744765`).

| Experience | Verified feature URL |
|---|---|
| Main Designer | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/designer |
| 2D demo | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/demo?view=2d |
| Premium 3D demo | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/demo?view=3d |
| Legacy TintEX / Demo | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/designer?demo=tintex |
| Guided design / AI workspace | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/demo?view=3d&panel=ai |
| Materials demo | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/demo?view=3d&panel=materials |
| Standalone Studio + Shop | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/studio |
| Merchant onboarding | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/studio/merchants/connect |
| Developer pitch | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/pitch/developers |
| Merchant pitch | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/pitch/merchants |
| Construction pitch | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/pitch/construction |
| Embeddable designer | https://ppw-designer-2d-jgra7by70-victor-ppw.vercel.app/embed/designer?scene=home&view=3d |

Landed: the original shared SVG icon family, sculpted ivory/mint controls, Plan Build / Finish / Arrange shelves, collapsed phone tools with a visible Select/Stop action, compact 3D phone header and expandable Build palette, independently scrolling plans with a fixed Delete icon, and fewer duplicate phone controls. Clear, cart/estimate, room list, floors/roof, Site tools and history remain accessible. Camera and zoom are preserved across tools. Natural 3D uses depth shading, refined upholstery/bedding/cabinet details and coherent material surfaces; Plan uses dimensional mesh renders and aperture-based daylight. Initial house framing and lawn depth are corrected. Geometry scale, calculations, quantities, catalogue identities and saved customer designs are preserved.

Access recovery is complete on preview: the old KV endpoint failed DNS with `ENOTFOUND`; changing the middleware runtime did not fix that storage failure. The failed Node variant was retired and Edge middleware restored. The gate now uses the existing Neon database and dedicated `studio_access_records` table for hashed opaque sessions and atomic attempt counters (additive migration `0030_studio_access_records.sql`). It no longer depends on the broken KV endpoint. Sessions are private, host-scoped and time-limited; merchant/customer authentication is separate. Wrong-code entry returns 401; private app assets are gated; protected responses use `no-store`. Correct-code entry, session reuse, all checked routes and screenshot assets passed on the final preview. An unlocked browser still receives client code; this is access control, not a claim that executable client code cannot be copied.

Validation: full baseline **301 files / 3,301 tests passed**, followed by **54 focused gate/header tests, 36 schema/storage tests, 13 ambient-occlusion/rendering tests, 34 pitch tests and 6 refreshed-asset tests**. These are separate targeted runs, not a newly summed full-suite count. Client/API/middleware typechecks, build and changed-file lint passed. Actual preview checks at **320px and 390px** covered tool Stop/Escape, cart dismissal, Clear cancellation, retained zoom and corrected lawn depth, with no page-width overflow. The final gated preview fully rendered; checked routes and assets returned 200 after authorized entry. No live orders, payments, customer enquiries or paid AI inference were submitted during these checks.

Shared live pitch embeds inherit the app release. Static Plan, 3D and AI showcase images were refreshed from the real verified app; pitch instructions and model-quality wording were updated. **Remaining visual gap:** these are improved dimensional previews, not exact photographic supplier CAD/PBR assets or an exact reproduction of the supplied references. Do not invent saleable products, alter product envelopes to improve appearance, or overwrite customer plans to make a screenshot look better.

### Release completion

- [x] Explicitly authorized main release and successful production deployment/health at `f0943b1`.
- [x] Wrong-code rejection, successful entry/session, private asset gating and no-store behavior.
- [x] Feature 320px/390px interaction checks and live production 390 × 844 rendering/view-switch checks.
- [x] Full baseline plus focused regressions, client/API/middleware typechecks, build and changed-file lint.
- [x] Shared pitch copy, verified live embeds and actual app screenshot assets refreshed.
- [x] Workspace build links, full file inventory and saveable continuation checkpoints updated.
- [ ] Future visual enhancement: obtain accurate, licensed supplier meshes/PBR textures to approach the photographic references. The current dimensional previews do not claim that asset fidelity.

### Full file locations for continuation

- Active repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`
- Current links: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\CURRENT-WORK-LINKS.md`
- Repository handoff: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\DESIGNER-HANDOFF-ROOM-DESIGNER.md`
- Build links: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\BUILD-LINKS.md`
- Workflow log: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\DESIGNER-WORKFLOW-LOG.md`
- Release/access detail: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\STUDIO-ACCESS-2026-10-05.md`
- Saveable checkpoint: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Checkpoint-2026-10-05.md`
- Full source inventory: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-AI-File-Locations.md`
- Saveable workflow: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Workflow.md`
- Shared UI layout: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\styles\designerStudio.css`
- Shared icon family: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\StudioIcon.tsx`
- Access gate: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\middleware.ts`
- Access/session implementation: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\server\accessGate.ts`, `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\server\accessStorage.ts`, `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\server\accessPage.ts`
- Additive database migration: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\api\_db\migrations\0030_studio_access_records.sql`
- Shared pitch captures: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\showcase\designer-plan.webp`, `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\showcase\designer-3d.webp`, `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\public\showcase\designer-ai.png`

Actual app captures saved for reuse:

- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Plan-2026-10-05.jpg`
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-3D-2026-10-05.jpg`
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-AI-2026-10-05.jpg`
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Phone-Plan-2026-10-05.jpg`
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Phone-3D-2026-10-05.jpg`
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Access-Phone-2026-10-05.jpg`
- `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Live-Phone-2026-10-05.jpg` — verified production at 390 × 844

Production evidence: `/api/healthcheck` reports `env=production`, commit `f0943b1f0d82a3047c34313cb30559755171bee9` and storage configured/reachable. An unauthenticated demo request is locked; wrong code `1111` returns 401; correct code `2123` returns 303 and the session cookie unlocks the app with 200. The feature pitch live iframe and refreshed capture assets are also verified. Production browser checks are complete at 390 × 844: code entry, 3D rendering, 2D switching with saved plans preserved, and no horizontal overflow. The live capture is listed above. Desktop handoff and current-link copies are synchronized. The released application remains f0943b1; subsequent continuation-document commits do not change this verified release. Earlier notes below are preserved history and do not override this dated checkpoint. Preserve the original checkout and recovery stash `649569db5766b86c5880321f6cfea782f356da1f`.
<!-- oct5-studio-release:end -->

## Historical implementation checkpoints (superseded by the release status above)

# Studio release — 5 October 2026

Status: feature implementation and local validation complete; access-gate deployment verification remains in progress. Production has NOT been published for this release.

Checkpoint: feature HEAD is `65f5804` (`Fix lawn depth and diagnose access storage connectivity`). Gate commits `bdf8cf5` and `2c817a3`, the UI/rendering commit `38e58c1`, and runtime/history correction `d91beac` are on the feature branch. The first preview login returned 503. The attempted Node middleware variant failed; `middleware.ts` now explicitly uses the restored Edge runtime. Do not reinstate the failed Node variant as a pending fix.

The diagnostic preview for `65f5804` is deployed but its access/storage acceptance checks are still pending. The gate binds the existing KV environment variables and reports safe failure categories/statuses without exposing credentials. Configured KV variables alone do not prove a working Redis connection; the new storage connectivity diagnostics must be checked. Verify locked pages/assets, wrong-code rejection, successful entry and session reuse on that preview before production publication. No final verified deployment URL has been recorded yet; do not treat an earlier preview URL as the approved release.

The visual implementation is complete locally. Plan now uses Build / Finish / Arrange with a collapsible phone shelf and a visible stop/Select control; 3D uses a compact phone header and expandable build palette. Original shared SVG icons replace mixed glyphs. Plan tabs scroll independently of the fixed Delete icon. Duplicate phone history controls are hidden at rest and available in Site tools / expanded plan controls.

Natural 3D now has bounded GTAO depth shading, richer curved upholstery/chairs and folded bedding, cabinet details, broad wood grain and shared mineral floors. Initial camera framing fits the house rather than the surrounding lawn; explicit Garden Fit still fits the plot. Camera changes are only initial or user-requested. The lawn depth correction in `65f5804` has been visually verified at 320px. Plan shadows come from the actual dimensional 3D meshes; window light is projected using aperture heights. No dimensions, pricing, quantities, catalog SKUs or saved customer designs were changed for styling.

Validation so far: the full suite passed 301 files / 3,301 tests, followed by 29 passing focused tests for the latest changes. API/client/middleware typechecks and the production build passed. These are local build/test results, not confirmation of a successful production publication or deployed storage connection. Existing large-bundle advisory remains. Browser checks covered desktop, 390px and 320px: no body overflow at 320px, paint shelf collapses and Stop paint exits, and 3D Walls returns to Select. `data-shading=natural-depth` confirms actual WebGL AO ran, with no JS render errors. Reference-level photographic supplier geometry remains a separate asset-quality gap; do not call these photoreal CAD models.

Victor explicitly requested production publication on 5 October with access code `2123`, deeper reference-led UI and 2D/3D realism changes, and mobile validation. Continue in `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer` on `cursor/feat-3d-flooring-hud-bc95`. Remote main was inspected at `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e` before work. Original checkout/stash remain preserved.

## Access architecture

`middleware.ts` protects app pages and assets before Vercel's CDN; the server renders the access form from `server/accessPage.ts`. No app JavaScript or code verifier is included in the locked page. `server/accessGate.ts` verifies the requested four-digit code server-side. The default server digest is replaceable with `DESIGNER_ACCESS_CODE_SHA256`.

Successful entry creates a random 256-bit token. Only its SHA-256 hash is persisted for 12 hours in the existing Neon database, in a dedicated `studio_access_records` table and `ppw:studio-access:v1` namespace. Migration 0030 is additive; first use may initialize only this table under a transaction lock. Merchant/customer tables are unaffected. An HttpOnly, Secure, host-bound, SameSite=None, Partitioned cookie supports embedded demos. The access gate fails closed on unavailable storage and permits ten attempts per client IP per ten-minute bucket. IP values are hashed before being used as keys. Preview and production sessions are independent. No new external accounts, auth provider or API quota is needed. Atomic database counters preserve rate limits across server instances; expired records are cleaned in bounded batches.

Existing `/api/*` and Vercel infrastructure endpoints retain their existing service authentication; payment webhooks, merchant sessions, cron and public read-only MCP are not silently replaced by the shared presentation code. The code is a studio presentation gate, not a replacement for private customer or merchant authentication. An unlocked browser necessarily receives the app's client code; this does not claim to prevent copying executed browser code.

The access page preserves app deep links and provides numeric phone entry, inline errors, no external assets and a new-tab fallback for embedding environments that block cookies. Unsupported storage produces a retry screen, never an unlocked app.

Primary platform reference: https://vercel.com/docs/routing-middleware/api (read 5 October 2026).

## Historical completion checklist at the earlier checkpoint

- [x] Local server access tests, typechecks, full regression suite and production build; latest focused tests also passed.
- [ ] Unique feature preview: locked / wrong code / correct code / session reuse / asset gate.
- [x] Local desktop and 390px / 320px: Plan/House layout, shelf and tool dismissal checks; lawn depth fix verified at 320px.
- [ ] Final accepted-preview smoke check: cart, Clear, camera retention and protected entry across the published routes.
- [ ] Actual screenshot assets refreshed for shared pitches.
- [ ] Production publication after successful preview, then locked/unlocked live verification.
- [ ] Update all build links and saveable continuation files with verified URLs and commit IDs.

Gate recovery: 65f5804 diagnostics proved the old KV endpoint fails DNS (ENOTFOUND), in both Edge and Node. The existing Neon catalog is healthy (14 products, schemaMissing=false). The pending release now uses Neon for opaque sessions and atomic attempt counters; broken KV is no longer a gate dependency. 54 access/storage/header tests passed after the change. Natural desktop supersampling and denoising were also refined within the same render budgets; phone resolution stays unchanged.
