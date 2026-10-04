# Studio release — 5 October 2026

Status: implementation in progress; production has NOT yet been updated for this release.

Checkpoint: gate commits `bdf8cf5` and `2c817a3` were pushed to feature only. Preview `https://ppw-designer-2d-n1u320rmh-victor-ppw.vercel.app` serves the locked screen, but the first deployed login returned 503. Do NOT publish this version to production. API readiness reports configured KV variables but does not verify working Redis. The pending fix explicitly selects Node middleware, binds KV environment names and emits safe failure-category/HTTP-status headers (never credentials). Verify wrong-code rejection and successful entry on the next preview before live publication.

The visual implementation is complete locally. Plan now uses Build / Finish / Arrange with a collapsible phone shelf and a visible stop/Select control; 3D uses a compact phone header and expandable build palette. Original shared SVG icons replace mixed glyphs. Plan tabs scroll independently of the fixed Delete icon. Duplicate phone history controls are hidden at rest and available in Site tools / expanded plan controls.

Natural 3D now has bounded GTAO depth shading, richer curved upholstery/chairs and folded bedding, cabinet details, broad wood grain and shared mineral floors. Initial camera framing fits the house rather than the surrounding lawn; explicit Garden Fit still fits the plot. Camera changes are only initial or user-requested. Plan shadows come from the actual dimensional 3D meshes; window light is projected using aperture heights. No dimensions, pricing, quantities, catalog SKUs or saved customer designs were changed for styling.

Validation so far: 301 files / 3,301 tests passed; API/client/middleware typechecks and production build passed. Existing large-bundle advisory remains. Focused final gate/header/phone tests follow minor last edits. Browser checked desktop, 390px and 320px; no body overflow at320, paint shelf collapses and Stop paint exits, 3D Walls returns to Select. `data-shading=natural-depth` confirms actual WebGL AO ran, with no JS render errors. Reference-level photographic supplier geometry remains a separate asset-quality gap; do not call these photoreal CAD models.

Victor explicitly requested production publication on 5 October with access code `2123`, deeper reference-led UI and 2D/3D realism changes, and mobile validation. Continue in `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer` on `cursor/feat-3d-flooring-hud-bc95`. Remote main was inspected at `71db6af8cfdd6f0128ae8ea663c69fab104b6e5e` before work. Original checkout/stash remain preserved.

## Access architecture

`middleware.ts` protects app pages and assets before Vercel's CDN; the server renders the access form from `server/accessPage.ts`. No app JavaScript or code verifier is included in the locked page. `server/accessGate.ts` verifies the requested four-digit code server-side. The default server digest is replaceable with `DESIGNER_ACCESS_CODE_SHA256`.

Successful entry creates a random 256-bit token. Only its SHA-256 hash is persisted for 12 hours in the existing private Upstash/KV connection, in a new `ppw:studio-access:v1` namespace. An HttpOnly, Secure, host-bound, SameSite=None, Partitioned cookie supports embedded demos. The access gate fails closed on unavailable storage and permits ten attempts per client IP per ten-minute bucket. IP values are hashed before being used as keys. Preview and production sessions are independent. No new external accounts, auth provider or API quota is needed.

Existing `/api/*` and Vercel infrastructure endpoints retain their existing service authentication; payment webhooks, merchant sessions, cron and public read-only MCP are not silently replaced by the shared presentation code. The code is a studio presentation gate, not a replacement for private customer or merchant authentication. An unlocked browser necessarily receives the app's client code; this does not claim to prevent copying executed browser code.

The access page preserves app deep links and provides numeric phone entry, inline errors, no external assets and a new-tab fallback for embedding environments that block cookies. Unsupported storage produces a retry screen, never an unlocked app.

Primary platform reference: https://vercel.com/docs/routing-middleware/api (read 5 October 2026).

## Completion checklist

- [ ] Server access tests, typechecks, full regression suite and production build.
- [ ] Unique feature preview: locked / wrong code / correct code / session reuse / asset gate.
- [ ] Desktop and 390px / 320px: Plan, House, feature shelves, dismissals, cart, Clear and camera retention.
- [ ] Actual screenshot assets refreshed for shared pitches.
- [ ] Production publication after successful preview, then locked/unlocked live verification.
- [ ] Update all build links and saveable continuation files with verified URLs and commit IDs.
