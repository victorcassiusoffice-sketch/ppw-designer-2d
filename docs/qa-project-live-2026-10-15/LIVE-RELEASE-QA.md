# One Live Build — live preview verification, 15 October 2026

Release: [https://ppw-designer-2d-8b09vgrgo-victor-ppw.vercel.app](https://ppw-designer-2d-8b09vgrgo-victor-ppw.vercel.app) - One Live Build for designers, developers, construction, plumbing, landscape, merchant and city teams.

Commit: `491605e28ac4947508a09303b129c9ad187eac9a`. [PR #48](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/48). Public Vercel bundle: `App--yA2Q1qw.js`. The local bundle name differs because the hosted environment contributes build metadata; the deployed health endpoint identifies the exact source commit.

Cache-busted curl returned HTTP 200 with `{"ok":true,"env":"preview","commit":"491605e28ac4947508a09303b129c9ad187eac9a"}`. Normal DNS and TLS worked; no host/DNS/system changes were made.

## Live browser checks

Terminal Playwright/Chromium, 1280×900 desktop and 390×844 phone. 28 cases cover public 2D and 3D, all six company project stations, all four issued company pitches, and the intended access gates for Designer and Studio. Every page returned200. Final result: zero console/page errors, failed requests, HTTP errors, attempted non-GET writes and horizontal overflow. Screenshots are alongside `report.json`.

The first run used Playwright expect's default 5,000 ms, independently of the page timeout. Five cold-loading Project hub cases did not render inside that window; there were no network/application errors. `report-first-attempt.json` preserves those failures. The harness now explicitly allows 45,000 ms, and only those five cases were retried on the same commit. They passed with measured readiness times recorded in the final report. This exposes initial bundle-loading latency; it is not a claim that the app loads instantly or that every browser/device has been tested.

No access code was entered. Protected-route captures establish that the gate is present, not that protected production functionality was tested. No customer data, orders, invoices, emails, enquiry submissions or database mutations were used.

## Visual assessment and limits

The live phone 3D view and landscape Project hub and desktop construction Project hub were inspected. Navigation and content are readable, controls remain outside the central model and no blocking dialog or horizontal clipping was observed in these captures. Detailed forms, nine camera presets, camera retention, measured trees, JSON handover and all language/theme combinations were exercised in the separate local reports on the same source release.

Remaining limits are explicit: photographic-reference realism is not achieved; some older long-form text remains English; initial application bundles are large; structural outputs remain unverified screening; secure multi-user team collaboration is not connected. The separate production-target Lighthouse failure is recorded in `CI-STATUS.md` rather than represented as a passing preview audit.

The unique release URL is pinned for reproducible review. Subsequent link/report commits on the feature branch do not update main or production.
