<!-- verified-preview:start -->
## Current verified feature preview — 29 September 2026, interaction fixes

Verified deployed application: `1be7bf68002c47bf96e29de2a69d386159edd0c5` · Vercel Preview deployment `6739155621`.
Pinned verified application URL; later documentation-only commits do not replace it.

Later portrait-Fit correction `23eb787122a3a11e5b8052b408dc012933fd65dd` is pushed and passes 31 focused tests/build. Its previews `n7pw1fmhm` (deployment 6739702746) and `mxkxb9qu1` (documentation revision `4816a9ada76460aad4176790984f476530753fe7`, deployment 6739997387) time out on this network and are NOT pinned as browser-verified. Retry those normal URLs when connectivity permits. The verified link below contains all main interaction fixes but not that extra portrait-Fit correction.

- Designer-only 2D Demo: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/demo?view=2d
- Designer-only Premium 3D: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/demo?view=3d
- Standalone Studio + Shop: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/studio
- Studio designer: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/studio/designer?view=3d
- Shop preview: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/studio/shop
- Developer pitch: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/pitch/developers
- Merchant pitch: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/pitch/merchants
- Embedded designer: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/embed/designer?scene=home&view=3d
- Standard Designer: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/designer
- Paint Demo, legacy TintEX route: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/designer?demo=tintex
- Latest changes: stable 3D camera and on-screen scale across tool/catalog/scene changes; faster movement; repeatable wall-snapped door/window placement; direct garden draw/resize; reliable tool exits; Plan zoom out to 4%; roof solar visible only while Roof is selected.
- SketchUp: tested supplier GLB import pipeline, documented in `docs/SKETCHUP-MODELS.md`. No direct `.skp` editor or supplier model was added.
- Verification: 274 files / 3,036 tests passed, followed by 13 garden and 31 camera/Fit/motion tests; seven importer integration tests; client/API typecheck, scoped lint, final build, zero public maps, desktop/390px phone browser checks and deployed healthcheck matching `1be7bf68002c47bf96e29de2a69d386159edd0c5` with `env=preview`.
- Branch: `cursor/feat-3d-flooring-hud-bc95` only. Main and production were untouched. PR #36 was merged externally on 26 September and is historical.
- Active source: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
- Previous work remains preserved in stash `649569db5766b86c5880321f6cfea782f356da1f` (untracked files in its third parent); do not restore/drop it wholesale.
- No orders, payments, customer emails or supplier mutations were submitted. Preview ordering stays blocked.
- Remaining limits: door/window hosts require enclosed rooms; edit/remove openings in Plan. Garden surfaces are rectangular; fence placement and freeform terrain remain limited. Product art/model fidelity depends on available supplier assets.
- Previous verified UI build: https://ppw-designer-2d-1nbevf4ny-victor-ppw.vercel.app/demo
- Production fallback: https://designer.ppwellness.co/designer (unchanged).
<!-- verified-preview:end -->

# Room Designer — build links

Last updated: 2026-09-22 (Mauritius time)

One place for production and the feature builds Victor / Spa Concept / Cap Tamarin can open on phone or desktop. Prefer this file over hunting chat history.

## Production (live)

| What | URL |
|---|---|
| Live designer | https://designer.ppwellness.co |
| Repo | https://github.com/victorcassiusoffice-sketch/ppw-designer-2d |

Production is **main**. Do not treat preview branches as production.

## Historical feature snapshot — 22 September 2026

**Branch:** `cursor/feat-3d-flooring-hud-bc95`  
**Historical PR #36 (merged 26 September 2026):** https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/36
**Vercel preview:** https://ppw-designer-2d-git-cursor-feat-3d-flooring-hud-bc95-victor-ppw.vercel.app  

Open the preview, then go to `/designer` (same path as production).

### What's in this build

1. **Post-draw wall height** — after walls/room exist, left **Wall height** card (− / metres / +) in 0.1 m steps (2.0–4.0 m); same control under the 3D title. Still one property-wide height; paint panel field stays in sync. Paint litres and cladding area follow `wallHeightM`.
2. **Sample cladding** — three fictitious bardage SKUs (cedar / composite / fibre); apply on walls in plan and 3D; area → boards → packs → sample MUR. Not Spa Concept products; not Merchant Connect.
3. **3D flooring** — select and paint flooring in 3D the way paint works.
4. **Draw HUD left** — wall-pen card docks left so downward drawing isn't blocked.
5. **Sims floor drag in 3D** — drag a rectangle, live tile count; Shift fills room.
6. **3D item Turn** — clearer Turn chrome when Hand is armed.
7. **Cart display** — floor / paint / cladding lines show in cart; Stripe/PayPal still product-only (sample cladding not charged).

### Not in this build (held)

- Real Spa Concept cladding catalog (waiting on Marine's materials + supplier list)
- Effective cover width on cladding pack maths (sample still uses full board face)
- Merchant Connect / OMS checkout for cladding-floor-paint
- Clearer paint-finish realism on walls (finish + PBR exist; walls mostly hex)
- Garden Phase 1 (fence / paths)
- Ghost floor tiles in 3D (caption count only for now)
- Moving older Floor / Wall-paint phone cards off the bottom

### Cloud agent that built it

https://cursor.com/agents/bc-6f345182-6460-5e2f-bb82-6e133e6bbc95

## How to share

- **Victor / phone test:** send the **Vercel preview** URL + "open `/designer`".
- **Spa Concept (Marine):** production + this preview were already linked in the 2026-09-22 follow-up; ask again for cladding materials + merchant list before replacing sample SKUs.
- **Cap Tamarin:** they want embedded-3D "Sims in real life" — use the preview for demos until a dedicated embed landing exists.

## When a new build lands

1. Add a row under "Current feature build" (or archive the old one under "Previous").
2. Keep production at the top, unchanged unless main actually shipped.
3. Tell Victor the preview URL in one sentence; don't bury it.
4. Update Grok Bot memory with the new PR + preview URLs.

## Previous / related local branches (not the active preview)

These exist on the machine or as older worktrees; they are **not** the phone-test URL above unless a Vercel deploy is named explicitly:

- `feat/designer-3d-sims-paint-2026-09-17` (local)
- `feat/designer-3d-mode-2026-09-17`
- Older flooring / doors / paint branches under `feat/designer-*`

If you need a preview for one of those, deploy or open its PR first — don't invent a Vercel URL.
