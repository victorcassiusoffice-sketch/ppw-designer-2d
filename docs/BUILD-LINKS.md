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

<!-- oct4-sculpted:start -->
## Verified sculpted UI and realism preview — 4 October 2026

Current verified preview: **https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app**.
Application commit `ce9d9b6f3ab170ae6a7aa2ec37781fad76364bd3`; screenshot update `e3de30e`, final pitch-copy update `38c73e9`; verified recovery deployment commit `003ba173fa14f970efdbeab913d05c686842dc3b`, Vercel deployment `6835982201`. Work stays on `cursor/feat-3d-flooring-hud-bc95`. Production remains `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e`; no main/production publication was performed.

| Experience | URL |
|---|---|
| 2D demo | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/demo?view=2d |
| 3D demo | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/demo?view=3d |
| Designer | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/designer |
| Legacy TintEX / Demo | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/designer?demo=tintex |
| Standalone Studio + Shop | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/studio |
| Developer pitch | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/pitch/developers |
| Merchant pitch | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/pitch/merchants |
| Construction pitch | https://ppw-designer-2d-o0itp5zb4-victor-ppw.vercel.app/pitch/construction |

Landed: stronger ivory/mint sculpted controls and inset trays, consolidated building actions, narrow-phone Clear correction, measured furniture texture/bedding/occlusion, sharper canonical 2D product models, wall-height shadows and window daylight, collision-aware labels, fresh real-catalogue demo styling. View → Lighting offers Natural light and Colour check; choice persists and does not move the camera. Colour check pauses time-of-day shading; Natural restores it. Important phone placement feedback stays visible.

Verification: 297 files / 3,259 tests passed, then 22 focused final camera/wall and 28 pitch tests; client/API typechecks, changed-file lint and final build passed. Desktop and 390/320px local layouts checked. Final recovery host health confirms 003ba17; the furnished Plan and House render in its browser checks, all eight routes and three screenshot assets return HTTP200; standard Designer and legacy TintEX render at desktop/390px with no body overflow. Plan/House switching, Site & tools Escape and lighting/settings dismissal verified. Earlier aouziw3ca and 9kuay0rgv deployments passed visual checks; later both timed out, as did the pitch-copy hostname 6fj3qin0w and branch alias. A documentation-only recovery produced o0itp5zb4 above, now verified by browser and health. No application work was lost. No orders, customer saves, merchant writes, paid AI calls or enquiries were submitted.

Full locations:
- Active repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`
- Detailed continuation: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\SCULPTED-REALISM-2026-10-04.md`
- Saveable checkpoint: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Checkpoint-2026-10-04.md`
- Source inventory: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-AI-File-Locations.md`
- Actual captures: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Plan-Refined-2026-10-04.jpg`, `Room-Designer-3D-Refined-2026-10-04.jpg`, `Room-Designer-AI-Refined-2026-10-04.jpg`, `Room-Designer-Phone-Refined-2026-10-04.jpg`.
- UI tokens/layout: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\styles\designerStudio.css`
- Rendering profiles: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\components\three\renderPresentation.ts`
- Fresh demo: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\src\demo\homeInterior.ts`

Remaining visual gap: these are improved dimensional previews, not photographic manufacturer CAD. Exact supplier meshes/PBR textures and a sourced residential floor catalogue are still needed for the reference-level interior finish. Do not invent purchasable flooring SKUs, resize product envelopes for styling, or overwrite saved customer designs. Existing demo data is preserved; the styled generic home applies on a fresh demo. Shared live pitch embeds inherit app changes; static showcase assets were refreshed from actual captures.

Earlier notes below are historical. Preserve the original checkout and recovery stash `649569db5766b86c5880321f6cfea782f356da1f`.
<!-- oct4-sculpted:end -->

<!-- oct4-studio:start -->
## Verified tactile Studio preview — 4 October 2026

**The redesign is live on the feature preview. Production is unchanged.** Application commit `51c2b64336a923dad15668ef08b3a4ed1aa58900`; verified deployment commit `67cb97882711bfd264a0949a49d2e50afcc40d8d` (documentation only), Vercel deployment `6834611046`. Continue on `cursor/feat-3d-flooring-hud-bc95`. Later documentation commits do not change this application. Production health still reports `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e`.

| Experience | Verified preview URL |
|---|---|
| Designer | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/designer |
| Legacy TintEX / Demo | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/designer?demo=tintex |
| Furnished 2D demo | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/demo?view=2d |
| Furnished 3D demo | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/demo?view=3d |
| Standalone Studio | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/studio |
| Developer pitch | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/pitch/developers |
| Merchant pitch | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/pitch/merchants |
| Construction pitch | https://ppw-designer-2d-31cpgr056-victor-ppw.vercel.app/pitch/construction |

Landed: shared ivory/sage tactile Plan/House controls; labelled perimeter tools and expandable Site & tools; canonical measured top-down furniture/solar/tank models; richer 3D upholstery and material surfaces; corrected contact/corner shadows; coordinated Studio and pitches. Actual app screenshots replace the static Plan/House/AI pitch images. No dimension, quantity, energy or pricing algorithms were changed for appearance.

Validation: 295 files / 3,239 tests, followed by 21 focused navigation/surface and 5 screenshot-asset tests; client/API typechecks, changed-file lint and production build passed. Local desktop, 390 px and 320 px layouts checked. Deployed Designer and legacy TintEX loaded on desktop and 390 px phone with no body overflow; Plan/House switching and Site & tools Escape dismissal verified. Furnished Plan/House and developer pitch rendered, all eight routes above returned HTTP 200, and health confirms the recorded deployment commit. The first `pyrd1d3ge` hostname timed out; the replacement above is verified. These remain dimensional planning previews, not photographic supplier CAD. No orders, payments, enquiries, merchant writes or paid AI calls were made.

Full file locations:
- Active repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`
- Checkpoint: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\STUDIO-REDESIGN-2026-10-04.md`
- Saveable checkpoint: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Checkpoint-2026-10-04.md`
- Full source inventory: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-AI-File-Locations.md`
- Actual deployed screenshots: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Plan-Live-2026-10-04.jpg`, `Room-Designer-3D-Live-2026-10-04.jpg`, `Room-Designer-Phone-Live-2026-10-04.jpg`.

Older release notes below are historical. Preserve the original checkout and recovery stash documented there. No production/main publication was performed for this redesign.
<!-- oct4-studio:end -->

<!-- oct2-release:start -->
## Live phone + AI + merchant release — 2 October 2026

Production and feature preview are verified. Application commit `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e` includes the AI/phone/pitch work. The checkout remains on `cursor/feat-3d-flooring-hud-bc95`; the same application is on main under Victor's earlier explicit instruction to push the completed app and demos to main. Do not force-push or overwrite other work. Older release notes below are historical.

| Experience | Live URL |
|---|---|
| Main Designer | https://designer.ppwellness.co/designer |
| AI / guided house demo | https://designer.ppwellness.co/demo?view=3d&panel=ai |
| 2D demo | https://designer.ppwellness.co/demo?view=2d |
| Materials demo | https://designer.ppwellness.co/demo?view=3d&panel=materials |
| Legacy paint demo | https://designer.ppwellness.co/designer?demo=tintex |
| Standalone Studio + Shop | https://designer.ppwellness.co/studio |
| Merchant connection wizard | https://designer.ppwellness.co/studio/merchants/connect |
| Developer pitch | https://designer.ppwellness.co/pitch/developers |
| Merchant pitch | https://designer.ppwellness.co/pitch/merchants |
| Construction pitch | https://designer.ppwellness.co/pitch/construction |
| Embeddable AI designer | https://designer.ppwellness.co/embed/designer?scene=home&view=3d&panel=ai |
| Public MCP endpoint | https://designer.ppwellness.co/api/mcp |
| Unique feature Designer | https://ppw-designer-2d-328mv0s8r-victor-ppw.vercel.app/designer |
| Unique feature paint demo | https://ppw-designer-2d-328mv0s8r-victor-ppw.vercel.app/designer?demo=tintex |
| Unique feature AI demo | https://ppw-designer-2d-328mv0s8r-victor-ppw.vercel.app/demo?view=3d&panel=ai |

Vercel Preview deployment `6805264942`; Production deployment `6805478562`, unique production host `https://ppw-designer-2d-2ba1kqcy0-victor-ppw.vercel.app`. Production health reports the application commit above. Later documentation-only commits may have a newer build hash without changing the app.

Landed: stable two-finger zoom/pan baseline and inverse zoom steps; visible Clear in Plan and 3D with confirmation, keyboard isolation and full-design Undo; measured guided layouts; signed-in hosted AI briefs; validated JSON import; public MCP schema/catalogue/draft/validation tools; authenticated merchant CSV/JSON catalogue onboarding; three refreshed interactive AI pitches with real app imagery, private feedback/project enquiries, one-hour Calendly and in-person meeting requests. AI concepts open as a separate plan, preserving existing pages. At 390px and desktop, the new controls are verified. Final 320px-only fixes are on feature commits a7fd7e9 and 14f61ec; those are not yet on production. Their Vercel build succeeded but unique host https://ppw-designer-2d-52dg7ucgp-victor-ppw.vercel.app times out. Automatic approval review rejected publishing those corrections until a unique preview loads successfully. Do not bypass that block; obtain a healthy preview or explicit approval.

Validation: 292 files / 3,226 tests passed on the core release, followed by the five-test Clear keyboard check. Client/API typechecks, changed-file lint, production build and GitHub Quality gates/Secrets scan passed. CSS-only follow-ups were visually checked at 320px and built by Vercel. Desktop and 390px views, two-storey guided generation/apply, previous-plan preservation, Clear/Undo, twelve paired zoom cycles, embedded AI and merchant example validation were checked. Preview and production MCP tools respond; provider/authentication/quotas all report configured. Sign-in UI renders; **paid hosted inference was not exercised with a real signed-in customer**. Physical-phone pinch remains a useful hardware check; repeated pointer-event pinch tests pass.

Boundaries: proposals are conceptual design, not engineered/approved construction plans. MCP uses the bundled public reference catalogue and cannot read private saved designs, publish products, send messages or place orders. It rejects unsupported roof/wall/surface hosts in room proposals. Real hosted AI uses configured Gemini through OpenRouter after sign-in and quota checks; guided generation is explicitly rule based. Merchant publication requires an owned merchant session and confirmation; ERP/webhook scheduling is not claimed. Pitch requests are saved to the existing private leads backend; no automatic email or calendar booking is made. No live enquiries, paid inference, merchant writes, orders or payments were submitted during verification.

Full source: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
Continuation: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\PHONE-AI-MERCHANT-2026-10-02.md`.
AI extension contract: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\AI-DESIGN-MCP.md`.
Actual production screenshot: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-AI-Live-2026-10-02.png`.
Preserve original checkout `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d` and stash `649569db5766b86c5880321f6cfea782f356da1f` (including `^3`). PR #36 is historical and already merged.
<!-- oct2-release:end -->

<!-- verified-preview:start -->
## Verified Materials release — 30 September 2026

**Production is updated and verified.** Application commit `2801861d4a6acfc332f2ecf77ed6ec64c7983a62` is on both `main` and `cursor/feat-3d-flooring-hud-bc95`. Victor explicitly authorized this release: “Once done — Push to main, and demos where needed.” This supersedes older no-main notes for this release. Future production changes still need their own applicable authorization. Development checkout remains on the feature branch.

- Production Designer: https://designer.ppwellness.co/designer
- Production Materials demo: https://designer.ppwellness.co/demo?view=3d&panel=materials
- 2D demo: https://designer.ppwellness.co/demo?view=2d
- Construction pitch, independent UBP example: https://designer.ppwellness.co/pitch/construction
- Developer pitch: https://designer.ppwellness.co/pitch/developers
- Merchant pitch: https://designer.ppwellness.co/pitch/merchants
- Standalone Studio + Shop: https://designer.ppwellness.co/studio
- Shop: https://designer.ppwellness.co/studio/shop
- Embed: https://designer.ppwellness.co/embed/designer?scene=home&view=3d&panel=materials
- Legacy paint demo route: https://designer.ppwellness.co/designer?demo=tintex
- Latest unique feature preview: https://ppw-designer-2d-dpt7ob6s5-victor-ppw.vercel.app/designer
- Feature Materials demo: https://ppw-designer-2d-dpt7ob6s5-victor-ppw.vercel.app/demo?view=3d&panel=materials
- Feature paint demo: https://ppw-designer-2d-dpt7ob6s5-victor-ppw.vercel.app/designer?demo=tintex
- Feature deployment: `6765248709` (Preview). Production deployment: `6765494476`, unique host `https://ppw-designer-2d-gtx0q9cov-victor-ppw.vercel.app`. Both Vercel deployments report success. Production-domain health confirms `2801861d4a6acfc332f2ecf77ed6ec64c7983a62` with `env:production`. New and previously working Vercel preview hosts timed out from this connection during the final check; use the healthy production domain for pitches. The core Materials preview `https://ppw-designer-2d-ffzgdd9ou-victor-ppw.vercel.app` was verified in the browser and by its healthcheck before that connectivity issue.

Landed: permanent/versioned Materials settings saved with designs; physical shared-wall/opening and footprint measurements; editable concrete-block/mortar/plaster/base/pillar estimates; concrete/rebar and profiled-sheet roof quantities; formula/source report export. Supplier references include UBP, Gamma, Kolos, Joonas, Grewals and Profilage. Five measured garden furniture products from Mr. Bricolage Mauritius and JKalachand have original dimensional previews and dated source records. Model-facing/envelope accuracy is corrected; Plan/3D lamp radius, colour and day/night behavior share one calibration. Plan camera and energy controls are docked, Materials/Solar reserve side/bottom space, basket totals use a fixed panel footer, and selected 3D items open full details only on request.

Validation: **282 test files / 3,118 tests passed** on core release `5b3f5f9`; client/API typechecks and build passed; changed-file ESLint passed; no public source maps. GitHub Quality gates and Secrets scan passed for that core release. Final follow-up `2801861d4a6acfc332f2ecf77ed6ec64c7983a62` fixes phone Solar contrast through theme variables; 17 existing Solar/Materials tests, typecheck and changed-file ESLint pass. Desktop and 390px phone UI checked; deployed Materials roof depth changed 91m²×0.15m×1.05 = 14.333m³ to 91m²×0.20m×1.05 = 19.11m³ and carried into Plan. Designer, legacy paint demo, Studio and all three pitches return HTTP200 on production. Actual screenshot: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Materials-Live-2026-09-30.png`.

Limits are visible in the app: quantities are planning estimates, not structural/cyclone design or supplier orders. One selected wall construction applies to the measured wall scope. Ground bases and roofs remain whole-building measurements. Roof penetrations/overhangs require a verified area override; irregular steel/sheet layouts need a checked rectangle/cutting schedule. Rebar allocation is conservative per-run stock, not optimized cut-and-bend. Models remain dimensional previews unless supplier CAD is provided; lighting is visual, not certified lux. No orders, payments, emails or supplier mutations were submitted. Global repository lint has existing unrelated issues; changed files are clean.

Active source: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. Preserve the original checkout `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d` and recovery stash `649569db5766b86c5880321f6cfea782f356da1f` (`^3` contains its untracked files). Do not restore/drop it wholesale. Historical PR #36 was merged externally on 26 September.

Extension contracts: `docs/DESIGNER-INTELLIGENCE.md`, `docs/MATERIALS-RESEARCH-MAURITIUS.md`, `docs/RENDERING-ACCURACY.md`, `docs/MAURITIUS-OUTDOOR-SOURCES.md`. No chat/AI service is required to run these algorithms. All routes use one source application.

<!-- verified-preview:end -->

# Room Designer — build links

Historical baseline: 2026-09-22 (Mauritius time)

One place for production and the feature builds Victor / Spa Concept / Cap Tamarin can open on phone or desktop. Prefer this file over hunting chat history.

## Production (live)

| What | URL |
|---|---|
| Live designer | https://designer.ppwellness.co |
| Repo | https://github.com/victorcassiusoffice-sketch/ppw-designer-2d |

Production is **main**. Do not treat preview branches as production.

## Historical feature snapshot — 22 September 2026

**Branch:** `cursor/feat-3d-flooring-hud-bc95`  
**Historical PR #36 (merged 26 September 2026):** https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/36
**Vercel preview:** https://ppw-designer-2d-git-cursor-feat-3d-flooring-hud-bc95-victor-ppw.vercel.app  

Open the preview, then go to `/designer` (same path as production).

### What's in this build

1. **Post-draw wall height** — after walls/room exist, left **Wall height** card (− / metres / +) in 0.1 m steps (2.0–4.0 m); same control under the 3D title. Still one property-wide height; paint panel field stays in sync. Paint litres and cladding area follow `wallHeightM`.
2. **Sample cladding** — three fictitious bardage SKUs (cedar / composite / fibre); apply on walls in plan and 3D; area → boards → packs → sample MUR. Not Spa Concept products; not Merchant Connect.
3. **3D flooring** — select and paint flooring in 3D the way paint works.
4. **Draw HUD left** — wall-pen card docks left so downward drawing isn't blocked.
5. **Sims floor drag in 3D** — drag a rectangle, live tile count; Shift fills room.
6. **3D item Turn** — clearer Turn chrome when Hand is armed.
7. **Cart display** — floor / paint / cladding lines show in cart; Stripe/PayPal still product-only (sample cladding not charged).

### Not in this build (held)

- Real Spa Concept cladding catalog (waiting on Marine's materials + supplier list)
- Effective cover width on cladding pack maths (sample still uses full board face)
- Merchant Connect / OMS checkout for cladding-floor-paint
- Clearer paint-finish realism on walls (finish + PBR exist; walls mostly hex)
- Garden Phase 1 (fence / paths)
- Ghost floor tiles in 3D (caption count only for now)
- Moving older Floor / Wall-paint phone cards off the bottom

### Cloud agent that built it

https://cursor.com/agents/bc-6f345182-6460-5e2f-bb82-6e133e6bbc95

## How to share

- **Victor / phone test:** send the **Vercel preview** URL + "open `/designer`".
- **Spa Concept (Marine):** production + this preview were already linked in the 2026-09-22 follow-up; ask again for cladding materials + merchant list before replacing sample SKUs.
- **Cap Tamarin:** they want embedded-3D "Sims in real life" — use the preview for demos until a dedicated embed landing exists.

## When a new build lands

1. Add a row under "Current feature build" (or archive the old one under "Previous").
2. Keep production at the top, unchanged unless main actually shipped.
3. Tell Victor the preview URL in one sentence; don't bury it.
4. Update Grok Bot memory with the new PR + preview URLs.

## Previous / related local branches (not the active preview)

These exist on the machine or as older worktrees; they are **not** the phone-test URL above unless a Vercel deploy is named explicitly:

- `feat/designer-3d-sims-paint-2026-09-17` (local)
- `feat/designer-3d-mode-2026-09-17`
- Older flooring / doors / paint branches under `feat/designer-*`

If you need a preview for one of those, deploy or open its PR first — don't invent a Vercel URL.
