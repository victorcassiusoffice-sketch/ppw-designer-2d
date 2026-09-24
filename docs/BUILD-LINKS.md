<!-- verified-preview:start -->
## Current feature deployment

Updated: 2026-09-25 00:50 (local) | commit: accdec1b3e5fc1c445bfe83af1b37eab62084499

- Designer: https://ppw-designer-2d-kvjo7osq8-victor-ppw.vercel.app/designer
- TintEX: https://ppw-designer-2d-kvjo7osq8-victor-ppw.vercel.app/designer?demo=tintex
- Landed: Bottom home-build menu, reserved camera/settings, category-first Home store and inline product details; clear dismissal; brick/plastered-brick/concrete walls and independent exterior paint; focused phone Materials sheet; 26 Courts dimensional previews. Existing floors, stairs, roofs, garden, solar and backend hooks retained.
- Verification: Application accdec1 deployed through docs 0febf0d751001e1707fcafad913c5a1efc220e76, Vercel 6647572658. Standard, TintEX and Courts loaded on desktop and 360/390px phones; room drag created 18.8 m2 and Undo worked. Material, item and catalog dismissal checked. CI: 244 files / 2792 tests, root/API typechecks and secrets scan pass; build/lint pass. No overflow or browser errors observed.
- Branch: cursor/feat-3d-flooring-hud-bc95 | PR: https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/36
- Active clean checkout: C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer
- Victor's previous checkout and its changes remain preserved at C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d.
- Production remains https://designer.ppwellness.co/designer?demo=tintex and is untouched.
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
