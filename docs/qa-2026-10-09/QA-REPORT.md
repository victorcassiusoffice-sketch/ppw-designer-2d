# Room Designer — local verification, 10 October 2026

**BUILT-NOT-LIVE.** Victor requested terminal headless checks and a report before giving Y to publish. No push, deployment, main change, order or message was made.

Repository: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
Branch: `gpt/designer-2026-10-09`.
Built application: `App-DMQdCeGK.js`.
Preview: http://127.0.0.1:5173 — local to this computer, not a public share link.

## Checks

| Check | Result |
|---|---|
| `npm run build` | Passed, including client and middleware typechecks; existing chunk-size warning |
| `npx vitest run` | 324 files / 3,655 tests passed |
| Final supplier-copy regression | 2 files / 94 tests passed |
| `npx tsc --noEmit -p api/tsconfig.json` | Passed |
| ESLint on changed TS/TSX files, zero warnings | Passed |
| `git diff --check` | Passed |
| Headless Chromium | 1280×900 desktop and 390×844 phone, software WebGL |

Full-repository lint still has pre-existing findings (5 errors / 13 warnings in the 8 October log); this delivery does not claim global lint is clean. The full test suite preceded the last toolbar CSS and product-note wording cleanup; targeted tests, lint, build and screenshots were repeated afterward. No calculation code changed after the full suite.

## Screens covered

| Area | Captures | Evidence |
|---|---:|---|
| Plan, Materials walls/concrete/roof/report, paint coats, Loading 3D, House, View and selection | 20 | designer-report.json |
| Foundation excavation, depth in 3D, fill, rebar schedule/dimensions, concrete supplier/ratio, floor return; Services routes, products and floor return | 23 | foundation-services-report.json |
| Material costs, expanded Site & tools, selected-product rotation, details/cost and quote-required cart | 10 | products-report.json |
| Plumbing, construction, merchant, developer and employee pitches | 22 | pitch-browser-results.json and PITCH-QA.md |

75 final PNGs are stored directly in this directory. The HTML gallery groups them by phone/desktop and area. Initial unsuccessful capture attempts are retained separately in `initial-checks` for diagnosis and are not part of the final gallery.

The final runs recorded **zero browser console errors and zero uncaught page errors**. All tested documents remained within the viewport width. Foundation/services and pitch request monitoring also recorded zero failed requests or HTTP errors. Designer/product scripts record console/page errors and layout assertions; they do not independently audit every request. This is local evidence, not a claim about production.

## Visual defects found and fixed

- Expanded 2D Site & tools overlapped the persistent Floors / Materials / Undo controls at both widths. The CSS grid now assigns separate rows; screenshots and a bounding-box assertion confirm the fix.
- The phone Services floor selector was compressed. The header wraps and leaves the exit selector readable and usable.
- The employee exercise menu compressed its phone buttons, causing text overflow. Its scroll layout now preserves each button's height.
- The 3D foundation depth label was hard to read and cast a false dark rectangle through the ambient-occlusion pass. The label is larger; screen-aligned sprites are excluded from that geometry pass.
- Construction chapters contained redundant empty image placeholders; these were removed while the interactive demo links remain.
- Service default elevations displayed floating-point noise. Derived defaults are normalized; user measurements are preserved.
- Product descriptions exposed internal unknown-data wording. They now explain supplier quotes and unconfirmed weight in plain language.

Earlier capture failures came from a phone-only paint selector, selecting a tiny product off-centre and software-renderer screenshot timeouts. The scripts were corrected and rerun. Final reports contain no failed capture assertions.

## Remaining visible gaps and limits

- Product silhouettes and materials are still simplified, particularly sanitaryware and furniture. These are measured planning views, not exact supplier replicas or the photorealistic reference standard. No new OpenArt supplier images were generated after browser access was declined.
- Some 2D free-wall previews use 10 cm display thickness while 3D room caps use 14 cm. This visible inconsistency remains; measured centre-lines and estimator inputs are independent. A follow-up should unify render adapters without changing quantities.
- Opening advanced Site & tools consumes additional phone space; it collapses back to the compact bar. The final shots show no control overlap, but physical-device gesture and GPU performance were not measured.
- Nested floor holes are not implemented. Partitions crossing a doorway conservatively remain walls instead of inventing a room. Full structural, drainage and electrical design approval is not provided by these quantity tools.
- No real customer designs were modified. The tests use fresh disposable browser storage and measured fixtures. Local static preview does not exercise deployed authentication, APIs, merchant connections, payment processing or form delivery.

## Resume and publication

Read `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer\docs\BUILD-WORKFLOW-2026-10-09.md` and `C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\agentix-os\inbox\designer-2026-10-09-foundations-services\HANDOFF.md`.
Wait for Victor's **Y** before publication. Existing remote demos contain the earlier deployed version. After authorization, publish the feature branch/PR, verify the unique deployment and relevant read-only APIs, then regenerate employee links from its verified origin. Main must not be changed before that approval.
