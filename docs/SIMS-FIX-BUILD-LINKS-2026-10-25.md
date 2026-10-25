# One Live Build — verified fix preview, 25 October 2026

Preview only. Application commit `43b3e3a`; verified deployment commit `a71ac23c830347efed8d1f9499cb4ff56308b863`. Branch `gpt/olb-sims-parity-2026-10-22`, draft PR #50. Later documentation-only commits contain the same application. Production remains `fcefc73bd75abe995b379e825ff715d439da2ca8` on both existing domains. Release requires Victor's **“merge 50”**.

## Open the build

- [https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=3d&pitch=1](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=3d&pitch=1) - One Live Build: main 3D preview for developers, designers, contractors and merchants.
- [https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=2d&pitch=1](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=2d&pitch=1) - One Live Build: 2D planning and product-placement preview for the same markets.
- [https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=2d&panel=materials&pitch=1](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/demo?view=2d&panel=materials&pitch=1) - One Live Build: Materials and 11-module estimate-evidence inventory for construction teams and investor review; expand **Estimate evidence**.
- [https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/designer](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/designer) - One Live Build: protected design workspace for professional teams; existing access gate retained.
- [https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/designer?demo=tintex](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/designer?demo=tintex) - One Live Build: legacy paint-demo entry for merchant review; existing access gate retained.
- [https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/showcase/sims-parity-fix-2026-10-24/index.html](https://ppw-designer-2d-88jw8km36-victor-ppw.vercel.app/showcase/sims-parity-fix-2026-10-24/index.html) - One Live Build: actual matched-camera graphics comparison and measured limitations for reviewers.

## Code and handoff locations

- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/50](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/50) - One Live Build: draft review and integration for the design/construction platform.
- [https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/tree/gpt/olb-sims-parity-2026-10-22](https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/tree/gpt/olb-sims-parity-2026-10-22) - One Live Build: source branch for developers and the next AI.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer) - One Live Build: the only working repository for this task.
- [C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-sims-parity-fix-2026-10-24/REPORT.md](C:/Users/Victor/Documents/Codex/2026-09-23/c/work/ppw-designer/docs/qa-sims-parity-fix-2026-10-24/REPORT.md) - One Live Build: acceptance results, screenshots, calculations boundary and limits for reviewers.
- [C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/HANDOFF.md](C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/HANDOFF.md) - One Live Build: team handoff and three factual pitch lines.
- [C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/REPORT.md](C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/REPORT.md) - One Live Build: cumulative record; see **Fix round, 24 Oct**.
- [C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/shots](C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/agentix-os/inbox/olb-sims-parity-2026-10-22/shots) - One Live Build: actual desktop and phone screenshots for the review team.

The live fallback remains [https://designer.ppwellness.co/designer](https://designer.ppwellness.co/designer) - One Live Build: existing production, which **does not contain this fix round**.

## What to try

In Plan choose **Arrange → Remove**; in House choose **Remove** (on phone open Build). Hover highlights; clicking/tapping removes a supported element. Use Undo to restore it. Done or Escape leaves the tool. Closed-room perimeter removal is explicitly refused; separate drawn walls, objects, openings and floor finishes are supported.

Choose Paint → Wall type → Brick and click a wall. **Height & thickness** shares saved floor height and whole-building masonry thickness with Materials. Glass retains its own thickness. Changing a specification requires quotation review. New walls inherit the saved thickness.

Materials → Estimate evidence lists 11 distinct calculation modules and input/source checks. It does not claim an empirical price-accuracy percentage; matched estimates and supplier invoices are still needed. Hover cutaway and selection do not change dimensions or quantities.

## Verification and limits

4,279 tests in 394 files, root/middleware/API types, changed-file ESLint and build passed. The immutable deployed origin passed real browser checks at 1280×800 and 390×844: Plan/House, Remove/Done, Materials evidence, cart icon, public price/name/count guards and protected entry routes; zero console/page/HTTP/network errors, API writes or document overflow. Phone floor-label truncation remains visible.

Auto maintained 60.04 measured orbit FPS by disabling AO after a trial below 45 FPS. High measured 40.16 FPS. Default visual parity is **not achieved** on this laptop; the comparison shows the lighter image. Cold startup was measured, not optimized. Lighthouse CI remains red for manifest/CSP/robots/payload/source-map/label and pitch-image/console findings. This is not an all-checks-green or full-Sims-parity release. PR49 is separate; no production, database, order/email dispatch or paid generation was performed. Pitch-page copy was not edited this round.
