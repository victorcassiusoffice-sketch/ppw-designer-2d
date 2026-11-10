# Phase 1 release checks · 9 November 2026

Base: `228ac97e9b696e64cf5006487ad4f1763bb18d60` (Lessons #58), also verified by the production health endpoint. Previous round 3 working files were preserved in local-only commit `58b2a25` on their original branch. This pilot does not require production database access.

| Check | Result |
|---|---|
| Full suite | `npm test -- --maxWorkers=2 --minWorkers=1 --reporter=dot`: **4,789 passed in 458 files**. Includes the pinned bytes, refusal cases, engine correspondence, signed decisions, backup replay and route isolation tests. |
| Compiler and build | `npm run build`: app + middleware TypeScript checks, public build, isolated protected Designer and plumbing builds passed. `npx tsc --noEmit -p api/tsconfig.json` passed. No public source maps. |
| Lint | Zero warnings/errors on changed TypeScript (immutable upstream copies excluded). `npm run lint` on the whole repo **is not green**: 5 errors and 14 warnings on both the clean base and candidate. The reported legacy files are unchanged. |
| Install | Fresh root `npm ci` installs the separately locked pilot: Ajv **8.20.0**, uqr **0.1.3**. ESLint still resolves its existing Ajv **6.15.0**; existing root dependency records unmodified. |
| Public load graph | [Static audit](entry.json): 32 early JS/CSS files byte-for-byte identical; 3,237,874 bytes raw / 941,791 gzip in both builds. The lazy pilot adds 69,489 gzip bytes JS and 3,071 CSS only when the protected dashboard opens. HTML selector overhead, measured separately: +297 gzip bytes index / +279 olb. This is not a timing benchmark. |
| Public routes | [10 probes](public-routes.json): public demo/embed in Plan and House, and plumbing pitch on desktop and phone. No private dashboard request or dashboard UI, errors or write attempts. Backend traffic blocked/simulated in the local acceptance harness. |
| Private flow | [Desktop and phone evidence](README.md). Real OLB work file imported in compiled Trade Folder main; real quote and progress file returned. Invoice fixture, named decisions, payment record and new revision verified. Desktop 1280, phone 390, phone 360 with 115% text. Nine layout checkpoints with no overflow; every measured target ≥48 px. |
| Boundaries | [Git boundary audit](boundaries.json): 12 function files; no API, migration, environment or protected calculation change. Of the baseline tests, only the build-source-map safety test changes to exercise the new Vite modes. No access code entered, no order, supplier email or actual payment. |

Review status: **local coordination pilot behind the studio gate, not a production release**. The [capability table](CAPABILITIES.md) and [plan/receiver screenshots](README.md) distinguish the real cross-app path from signed test fixtures. For the preview and its CI results, see the feature PR. Raw intermediate logs, including the first external FX abort and the four initial build-test failures, were retained outside Git; the final run data above supersedes them.
