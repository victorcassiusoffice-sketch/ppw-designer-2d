<!-- oct4-studio:start -->
## Tactile Studio redesign — 4 October 2026

Application commit `51c2b64336a923dad15668ef08b3a4ed1aa58900` is pushed to `cursor/feat-3d-flooring-hud-bc95`. Vercel Preview deployment `6834504765` reports success at https://ppw-designer-2d-pyrd1d3ge-victor-ppw.vercel.app. The unique hostname timed out in both the browser and an HTTP check; it is **not yet a verified working preview**. A documentation checkpoint push will request a fresh preview of the same application. Production/main remains `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e` and has not been changed by this redesign.

Changes: shared ivory/sage tactile Plan/House controls; labelled perimeter tools and expandable Site & tools; canonical measured top-down furniture/solar/tank models; richer 3D upholstery and material surfaces; corrected contact/corner shadows; coordinated Studio and developer/merchant/construction pitches. Actual app screenshots replace the static Plan/House/AI pitch images. No dimension, quantity, energy or pricing algorithms were changed for appearance.

Checks: client/API typechecks, changed-file lint and production build passed. Full regression: 295 files / 3,239 tests, then 21 focused navigation/surface and 5 screenshot-asset tests. Local desktop and 390/320 px layouts checked, including panel dismissal and Plan/House switching. These remain dimensional planning previews, not photographic supplier CAD. No live orders, payments, enquiries, merchant writes or paid AI calls were made.

- Active repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`
- Full checkpoint: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\STUDIO-REDESIGN-2026-10-04.md`
- Actual screenshots: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Plan-2026-10-04.jpg` and `Room-Designer-3D-2026-10-04.jpg`
- Shared demo routes: `/designer`, `/designer?demo=tintex`, `/demo?view=2d`, `/demo?view=3d`, `/studio`, `/pitch/developers`, `/pitch/merchants`, `/pitch/construction`.

Older release notes below are historical. Preserve the original checkout and recovery stash documented there. Continue this redesign on the feature branch; do not publish to main without applicable authorization.
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

