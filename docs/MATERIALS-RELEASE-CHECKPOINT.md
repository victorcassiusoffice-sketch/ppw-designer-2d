# Materials release checkpoint

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

All requested changes in this release are implemented and live. Continue from the feature branch, preserving source and saved designs. Documentation-only follow-up commits may have newer HEAD hashes while the application release remains the commit above.
