# World Finish — Round 4 evidence (loop closed)

Base: `56d852d1f2f5d7342b9e02194964d6b998c795c7` (PR #52, inside both branches by merge). Walk: `72326031722745a6ca99a9b416ccba7a65ff1cd4` (PR #53). Site: `8d06d105bb20f301cb47e425ef6674fcacad34e7` (PR #54). main: `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2`.

Measured 31 October 2026, 16:08 to 16:45 MU, on the two Vercel preview deployments of those exact heads (healthcheck env=preview and the exact commit before and after every campaign), with the PR #52 preview as the paired base, hosts pinned to `216.198.79.3`, D3D11, no throttling, a fresh browser per formal row, every non-GET request blocked and counted. The browser for the Walk campaigns is the `ppw-tutorial-studio` Playwright 1.62.1 Chromium (chromium-1234), the build GPT's rounds used; the repository's own Playwright 1.60.0 Chromium (chromium-1223) ran the Site campaigns and the load campaign. Round 4 was started by GPT on 29 October (preparation A/B, Walk removal `36cbef4`, Site annotation commits) and finished by Claude on 31 October (door fix `8d00da1`, every formal campaign, this package).

This report lists measured outcomes, including failures, rather than granting merge approval. Every result file here is the complete original or a lossless gzip of it beside a small index; [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) hashes every original including the files kept outside the package; [FAILURES.json](FAILURES.json) lists the retained failed and superseded runs.

## Current gates

| Gate | Result | Evidence / limit |
| --- | --- | --- |
| Exact-head formal health | PASS | Health before and after every campaign is the exact head in env=preview; 40 loads, every Walk and Site row. |
| Absolute laptop first picture <3 s | FAIL (OPEN, fourth round) | Walk wall 3,576 / canvas 3,449.5 ms; Site 3,265 / 3,139.2 ms. [summary](load/summary.json) |
| Absolute phone first picture <5 s | PASS | Walk 3,155 / 3,027.3 ms; Site 3,270 / 3,149.2 ms. |
| Relative median ≤110 % of base | PASS | Walk laptop 0.961 / 0.957, phone 0.947 / 0.942; Site laptop 0.877 / 0.871, phone 0.982 / 0.980. Every individual pair retained. |
| Loading paint within 1 s every run | FAIL for Walk laptop (OPEN); PASS Walk phone, Site laptop, Site phone | Walk laptop DOM 4/5 and FCP 4/5 (one HTML response ends after 1 s); the other three groups 5/5. FCP is a prerequisite, not loader-pixel proof. [milestones](load/startup-analysis.json) |
| Early 28-file closure, gzip ceiling ≤1,024 | PASS | Walk +425 (raw +1,075); Site +1,006 (raw +2,529). [bytes](builds/build-attribution.json) |
| Early semantic lazy-seam restriction | PASS | Walk: no `src/walk` module early, 16 lazy. Site: only `SiteLaunchButton.tsx`, `SiteLoading.tsx`, `canvasSiteBridge.ts` early (3,959 rendered chars), 17 lazy; no map or collision library early. [early seam](builds/early-semantic.json) |
| No new pre-picture requests | PASS | 36 paths in every pair, no new or missing names, zero feature requests, same OLB shell. [network](load/network-audit.json) |
| Walk: chooser under 1 s | PASS | 185 ms laptop / 272 ms phone call to decoded frame. [input](walk/input.json) |
| Walk: laptop input under 50 ms | PASS | Maxima 19.2 ms third, 13.7 ms first; phone keyboard 14.8 / 12.8; phone touch 44.0 / 41.9 (all samples). |
| Walk: strict FPS | PASS | 60.000 / 60.025 laptop, 60.000 / 60.000 phone; 1 % lows 48.02 / 50.08 / 50.91 / 52.02; zero pauses. [frames](walk/frames.json) |
| Walk: covered designer paused | PASS | No designer frame while Walk is open, resume on Exit; bytes and cameras identical. [background](walk/background.json) |
| Walk: desktop functional | PASS | Movement/restore, doors both views, five Escape cycles. [desktop](walk/desktop.json) |
| Walk: phone functional | PASS | Movement/stop/restore, controls, doors both views with a click on every attempt, native Exit; single pointer; zero writes. [phone](walk/phone.json), [door diagnosis](walk/door-diagnosis/) |
| Site: seven cases | PASS | 7/7, zero errors, zero attempted writes. [cases](site/preview-smoke.json) |
| Site: native concave plan and held hydration | PASS | 4/4 both devices. [plan behaviour](site/plan-projection.json) |
| Site: plan presentation (annotation, arrow, toggle) | PASS | 18 states; inside canvas, clear of HUD and toggle, arrow visible, contrast 14.44. [plan presentation](site/plan-visual.json) |
| Site: credit strip painted | PASS, with the capture artefact explained | 25/25 settled and 3/3 two-frame captures painted; one same-task full-page capture blank while the DOM has the strip on top and a clip milliseconds later is painted. [credit](site/credit.json), [A/B](site/credit-diag-immediate.json) |
| Site: A4 print | PASS | Four pages per device, footer on every page, no overlap, minimum gap 17.55 mm. [pages](site/pdf-pages.json) |
| Static rules | PASS | Both branches: protected source, tests, settings, dependencies, ancestry; no unpublished commit at closure. [static](rules/static.json) |
| Visible rules | PASS | 8/8 screens: no price, client, phone, WhatsApp; only the authorised meeting link. [visible](rules/visible.json) |
| CI | PASS except Lighthouse | Typecheck, Vitest (4,458 / 4,499 tests), secrets, Vercel; six inherited Lighthouse assertions per head, no new ID. [ci](ci/ci-status.json) |

## First picture, every pair

Five fresh pairs per branch and device, forty loads, zero errors or writes. Medians in ms; the relative gate compares medians.

| Branch | Device | Base wall | Preview wall | Base canvas | Preview canvas | Wall ratio | Canvas ratio |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Walk | laptop | 3,723 | 3,576 | 3,603.9 | 3,449.5 | 0.961 | 0.957 |
| Walk | phone | 3,330 | 3,155 | 3,213 | 3,027.3 | 0.947 | 0.942 |
| Site | laptop | 3,723 | 3,265 | 3,603.9 | 3,139.2 | 0.877 | 0.871 |
| Site | phone | 3,330 | 3,270 | 3,213 | 3,149.2 | 0.982 | 0.980 |

Every individual run, its request list and its paint timeline is in [load-all.json](load/load-all.json) (gzip beside the index); per-row response, DOM-loader and FCP milestones are in [startup-analysis.json](load/startup-analysis.json). The custom-host columns in the summary are an operational reference, not the paired baseline.

## Walk

- Input ([input.json](walk/input.json)): 10 laptop and 10 phone keyboard samples and 10 phone native-touch samples, zero settling, each with the input, handler and first-moved-render timestamps. Start to ready 3,910.2 ms laptop / 2,881.3 ms phone.
- Frames ([frames.json](walk/frames.json)): four 40-second windows with every completed-render interval, raf cadence and input segments retained.
- Door diagnosis ([walk/door-diagnosis/](walk/door-diagnosis/)): `diag-phone-tap.json` (6 tap arms, all click), `diag-flick-tap-studio.json` and `diag-flick-tap-repo.json` (14 cases each: every tap after a look or stick flick fails to click on both Chromium builds, slow drag and no gesture click), `local-locator-studio-fail.json` (the formal harness reproducing `click-not-observed` on the studio browser before the fix), `local-locator-repo-pass.json` (the same harness passing on the repository browser before the fix, the reason round 3 could not reproduce locally), `local-locator-studio-fixed.json` (the studio browser passing after the fix).
- Preparation A/B ([preparation-ab/](walk/preparation-ab/)): GPT's predeclared eight-context diagnostic on `c30dd41` with its protocol, analysis, decision and the single-window FPS diagnostic, kept as written.

## Site

- [preview-smoke.json](site/preview-smoke.json): the seven cases; [plan-projection.json](site/plan-projection.json): the four native rows; [plan-visual.json](site/plan-visual.json): 18 states with exact Konva rects for the annotation, backing and arrow, the HUD rects and the toggle colours; [credit.json](site/credit.json): 25 captures with dark-pixel counts; [credit-diag-immediate.json](site/credit-diag-immediate.json) and [credit-diag-two-frames.json](site/credit-diag-two-frames.json): DOM geometry at five moments per session with the ink share of the page capture and of a clip taken right after; [pdf-pages.json](site/pdf-pages.json): page count, footer presence and body-to-footer gap per page.
- Images: [plan phone natural open](site/plan-phone-natural-open.jpg), [plan phone blueprint reopened](site/plan-phone-blueprint-reopened.jpg), [plan desktop natural open](site/plan-desktop-natural-open.jpg), [native plan phone](site/plan-phone.jpg), [held hydration phone](site/hydrated-phone.jpg), [credit blank capture](site/credit-immediate-s3-blank.jpg), [same session 1,500 ms later](site/credit-immediate-s3-late.jpg), [two-frames capture](site/credit-two-frames-s1.jpg), [A4 page 1](site/report-laptop-a4-page-1.jpg), [A4 page 3](site/report-laptop-a4-page-3.jpg), [live map phone](site/live-phone.jpg), [report phone](site/report-phone.jpg).

## Lighthouse

Both heads fail the Lighthouse job on the same six inherited assertions and no new error ID: `csp-xss` minScore on `/demo?view=2d&pitch=1` and `/pitch/plumbing`; `total-byte-weight` minScore on the same two routes; `unused-css-rules` maxLength on `/demo?view=2d&pitch=1` (2 found); `valid-source-maps` minScore on `/demo?view=2d&pitch=1`. Reasons unchanged from round 3: the first four are informational audits scored null, public source maps are forbidden by the Designer's policy, and the shared Designer CSS cannot be pruned safely from one coverage snapshot. 15 warnings per head.

## Retained failures and superseded runs

See [FAILURES.json](FAILURES.json): the pre-fix local phone reproduction, the two CI collections that parsed zero assertions, the plan harness run that failed on folder creation, the first PDF page check with its false overlaps, the credit diagnostic's one blank capture, and GPT's 11-byte Site overage of 30 October (r4-final-v1) that preceded the palette seam.
