# Studio release — 5 October 2026

Status: implementation in progress; production has NOT yet been updated for this release.

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
