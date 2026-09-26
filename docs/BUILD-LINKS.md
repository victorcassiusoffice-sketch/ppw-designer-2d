<!-- verified-preview:start -->
## Current deployment — production (main)

Updated: 2026-09-26 (Mauritius) | production commit: 8214ff4 (cache-busted `/api/healthcheck`, 2026-09-26 14:08:56Z (first cache-busted `/api/healthcheck` showing this commit; env production; `git ls-remote origin main` == local main))

Everything below is LIVE on the production host. The same tree is also on the unique preview https://ppw-designer-2d-5013erpyc-victor-ppw.vercel.app (healthcheck 312de8b, env preview) if a preview link is ever needed.

- Standalone Studio + Shop: https://designer.ppwellness.co/studio
- Studio designer, Premium 3D: https://designer.ppwellness.co/studio/designer?view=3d
- Property developer presentation: https://designer.ppwellness.co/pitch/developers
- Cap Tamarin variant (off-plan buyers, two-bed scene, models A/B, no numbers): https://designer.ppwellness.co/pitch/developers?client=cap-tamarin
- Merchant presentation: https://designer.ppwellness.co/pitch/merchants
- Spa Concept variant (hammam/sauna, internal-first, Build preselected, "in build" labels, no price): https://designer.ppwellness.co/pitch/merchants?client=spa-concept
- Designer-only Demo (read-only, no orders): https://designer.ppwellness.co/demo
- Cap Tamarin two-bed in the Demo: https://designer.ppwellness.co/demo?scene=captamarin&view=3d
- Embeddable Demo: https://designer.ppwellness.co/embed/designer?scene=home&view=3d
- Designer (blank plan, opens in Plan): https://designer.ppwellness.co/designer
- TintEX painted show flat (opens in 3D; add &view=2d for the plan; cart and quote work as before): https://designer.ppwellness.co/designer?demo=tintex
- Courts show home: https://designer.ppwellness.co/designer?demo=courts · Sofap: https://designer.ppwellness.co/designer?demo=sofap · Cap Tamarin: https://designer.ppwellness.co/designer?demo=captamarin
- Read-only on production is UI-level on /demo, /embed, /studio and /pitch (no checkout, quote, cloud save or K1 link is offered there); the API stays transactional for the real /designer, /products and /cart. A hard no-order host needs a separate Vercel project with DEMO_ONLY=true.
- Landed in this pass: colour truth outside the Paint tool, solar panels that stay on the house, Duraco tank, no bare boxes in the furnished demo, capsule Plan chrome, garden editing in 2D, collapsed catalogue, slim Studio toolbar, production-safe read-only, pitch pages with real app captures and the Cap Tamarin / Spa Concept overlays. Details: docs/DESIGNER-WORKFLOW-LOG.md "Resume here".
- Branch: cursor/feat-3d-flooring-hud-bc95 (= main after the merge) | PR: https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/36
- Working checkout for this pass: `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\.claude\worktrees\astra-finish` (branch feat/studio-pitch-finish-2026-09-26). The second checkout at `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer` still holds its uncommitted copy of the imported files; it is superseded by 62947b7 and later.
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

## Current feature build (phone-test this)

**Branch:** `cursor/feat-3d-flooring-hud-bc95`  
**Draft PR:** https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/36  
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
