# PR 48 CI status — 15 October 2026

Verified directly with `gh pr checks 48`, run logs and the downloaded `lighthouse-results` artifact. Feature commit: `491605e28ac4947508a09303b129c9ad187eac9a`. [Feature preview](https://ppw-designer-2d-8b09vgrgo-victor-ppw.vercel.app/) — One Live Build for architects, developers and merchants. This report does not replace the separate live interaction checks.

| Check | Result | Evidence |
|---|---|---|
| Typecheck, root + API | Passed | [CI job](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38700753730/job/116308076750) |
| Vitest | Passed | [CI job](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38700753730/job/116308076220) |
| History secret scan | Passed | [CI job](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38700753738/job/116308075632) |
| Vercel | Deployment completed | [Deployment](https://vercel.com/victor-ppw/ppw-designer-2d/3HNfR2uS5Gk5qq1BjQozfJygTdGC) |
| Lighthouse CI | Failed assertions | [Run 38700753754](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38700753754) |

## What Lighthouse actually tested

`.github/workflows/lighthouse.yml` hardcodes **production** `/products` and `/designer` on `https://designer.ppwellness.co`. Its comment says preview, but the action inputs and collected reports confirm production. The successful `npm run build` step does not cause those audits to use the built output or the PR preview.

Both captured pages were the **studio access-code gate**, verified from each artifact's final screenshot. Requests contained only the page document and favicon; the Designer application bundle was not loaded. Both returned HTTP 200, with no Lighthouse runtime error. The run did not exercise project tools, 2D/3D rendering, translations or the feature preview.

## Exact failure causes

Lighthouse collected one desktop run per target, then exited with assertion status 1. Both targets reported the same eight failed assertions:

- `installable-manifest`, `maskable-icon`, `splash-screen`, `themed-omnibox`: the audited gate has no manifest link or required PWA metadata.
- `is-crawlable`: the gate has `noindex,nofollow` in both its robots meta tag and response header. Do not remove the access policy merely to satisfy this audit.
- `meta-description`: absent on the audited gate.
- `robots-txt`: Lighthouse could not download a robots file; the artifact does **not** establish malformed file contents.
- `total-byte-weight`: the inherited recommended assertion applied `minScore >= 0.9` to an **informational audit with `score: null`**. Actual transfers were 3,407 bytes for `/products` and 3,413 bytes for `/designer`. This failure is not evidence of an oversized feature bundle.

Warnings: both targets also flagged SEO score (0.70 vs 0.80), DOM size, main-thread work and response time; `/products` added JavaScript boot time. Several performance entries are informational/no-score audits, so their warning labels must not be interpreted as measured slowness without the raw metrics. Report category scores were performance/accessibility/best practices 1.00, SEO 0.70 and PWA 0.29; these describe the gate, not the app.

## Follow-up

CI remains red; it is not a preview rendering failure or a test timeout. Align the workflow with the intended target: wait for and audit the exact PR deployment, select public demo routes or an authorized test session, assert the actual app loaded, then set supported numeric budgets for informational metrics and keep gate/SEO policy checks separate. No workflow, source, access policy or deployment was changed during this investigation.

Evidence: [products report](https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1792050410698-54823.report.html), [designer report](https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1792050410967-1802.report.html), [downloadable CI artifact](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/actions/runs/38700753754/artifacts/11955818328). Local downloaded artifact directory: `C:\Users\Victor\AppData\Local\Temp\designer-lighthouse-38700753754`.
