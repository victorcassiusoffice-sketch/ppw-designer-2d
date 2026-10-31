# World measurement harness (`tools/world/`)

The Finish loop for PR #53 (Walk) and PR #54 (Site). Ported into the repository on 31 Oct 2026 from GPT's Codex folder (`work/world-finish/round4`) so the loop no longer depends on that folder. Every script is read-only against the app and blocks every non-GET request. Results go to `WORLD_RESULTS_DIR` (default: the OS temp folder), never into the repository; the round's compact evidence is copied into `docs/world/finish/evidence/` by hand with its manifest.

Environment: `WORLD_REPO_BASE`, `WORLD_REPO_WALK`, `WORLD_REPO_SITE` (checkouts for controlled builds), `WORLD_TARGET_*` (preview hosts), `WORLD_PIN_IP` (Vercel edge pin, default `216.198.79.3`), `WORLD_PLAYWRIGHT=studio` (use the `ppw-tutorial-studio` Playwright, the browser GPT's rounds ran on). Every formal script takes `--label=<unique>` and `--expected=<40-hex head>`; a reused label or a wrong head refuses to run.

| Script | One line |
| --- | --- |
| `run-config.mjs` | Paths, targets, label, output folder, the one-at-a-time performance lock. |
| `lib.mjs` | Browser launch (pinned hosts, D3D11), fresh contexts with write blocking, health check over a separate Node connection, the tap recorder. |
| `load.mjs` | Formal first-picture campaign: fresh browser per row, base / candidate / custom host interleaved, both devices, network and paint timeline retained. |
| `walk-input.mjs` | Chooser latency and zero-settle input-to-render samples (keyboard both devices, native touch on the phone). |
| `walk-frames.mjs` | Strict fixed 40 s completed-render windows, both views and devices, every interval retained. |
| `walk-background.mjs` | The covered designer renders no frame while Walk is open and resumes on Exit; design and cameras restore. |
| `walk-desktop.mjs` | Desktop native functional run: movement, doors by E and click in both views, five Escape cycles. |
| `walk-phone.mjs` | Formal native phone functional run (one contact at a time); `--tap=locator` is the round-3 oracle, `cdp0` and `contact100` are diagnostics. |
| `site-preview.mjs` | Site seven-case campaign on a preview: delayed entry focus, live map, offline sample, production-negative simulation, A4 PDFs. |
| `site-plan.mjs` | Native concave plan: traverse entry, Apply, notch rejection, inside acceptance, held hydration of a saved world. |
| `site-visual.mjs` | Untimed phone captures of the live-map credit strip and the plan disclosure open/close/reopen for pixel review. |
| `rules-visible.mjs` | Eight visible screens: no price, client, phone, WhatsApp or wrong meeting link. |
| `rules-static.mjs` | Protected source, tests, settings, dependencies, API and routing audit against the base. |
| `build-audit.mjs` | Controlled Vite builds of base, walk and site with the early 28-file closure and byte/gzip inventory. |
| `build-attribution.mjs` | Early module and chunk deltas between the base and each branch build. |
| `network-audit.mjs` | Every request before the first picture, per pair, against the controlled build inventory. |
| `startup-analysis.mjs` | Response, DOM-loader and first-contentful-paint milestones per formal row. |
| `summarize.mjs` | Pair medians, the 110 % relative gate, the absolute gates, the byte ceiling. |
| `diag-phone-tap.mjs` | Diagnostic: zero-duration taps with a busy main thread (round 4, phone door). |
| `diag-flick-tap.mjs` | Diagnostic: taps after a look or pad flick at increasing gaps (round 4, phone door root cause). |
