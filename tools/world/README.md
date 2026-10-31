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
| `site-plan-visual.mjs` | Plan presentation on a preview: both devices by the three skins by tools open/closed/reopened; exact Konva rects for the annotation, backing and arrow against the HUD and the toggle, toggle contrast per state, one screenshot per state. |
| `site-credit.mjs` | Live-map credit strip: five fresh sessions by five captures (immediate, after fonts and two frames, 500 ms, 1,500 ms, after a native scroll) with the dark-pixel share of the strip in each. |
| `diag-site-credit-dom.mjs` | Diagnostic for the credit strip: DOM geometry and the top element at five moments per session, with the ink share of the page capture and of a clip taken right after; `--arm=immediate` or `two-frames`. |
| `early-semantic.mjs` | Reads both controlled-build audits: no `src/walk` or `src/site` module and no map or collision library may be early except the named seam modules, each reported with its rendered size; the lazy feature list must be non-empty. |
| `ci-collect.mjs` | Collects each head's GitHub check runs, the Lighthouse assertions and warnings parsed from the job log (ANSI and timestamp prefix stripped) and the full-suite test counts. |
| `pdf-pages.py` | Renders each A4 PDF page with PyMuPDF: page count, the exact disclaimer footer on every page, and the body-to-footer gap per page. |
| `evidence-package.mjs` | Builds `docs/world/finish/evidence/` from an inputs JSON: JSON copied or gzipped beside an index above 200 KB, images re-encoded as JPEG, SOURCE and PACKAGE manifests with SHA-256, the 5,000,000-byte docs/world check. |

Round 4 (31 October 2026) also records: formal Walk campaigns run on the studio browser (`WORLD_PLAYWRIGHT=studio`), the one GPT's rounds used; `WORLD_NO_GPU=1` drops the GPU flags for compositing A/B checks only; results root `WORLD_RESULTS_DIR`.
