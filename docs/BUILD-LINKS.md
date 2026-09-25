<!-- verified-preview:start -->
## Current feature deployment

Updated: 2026-09-25 23:45 (local) | commit: 7b1837e912b3f50f85f09ace627732828931c558

- Standalone Studio + Shop: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/studio
- Property developer presentation: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/pitch/developers
- Merchant presentation: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/pitch/merchants
- Designer-only Demo: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/demo
- Embeddable Demo: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/embed/designer?scene=home&view=3d
- Designer: https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/designer
- Demo (legacy TintEX URL): https://ppw-designer-2d-egshdczue-victor-ppw.vercel.app/designer?demo=tintex
- Landed: Interactive developer and merchant presentations, standalone Studio with Shop and existing merchant tools, designer-only Demo and embeddable 2D/Premium 3D; server-enforced no-order preview.
- Verification: Final application CI passes 262 files / 2,931 tests, client/API typechecks and secret scan. Production build and scoped lint pass; zero public source maps. Unique preview browser checks pass for both pitches, Studio, Demo and preserved Designer/TintEX routes on desktop and 360/390px phones. Final embedded frames measure 420/423px on desktop and about 480px on phone; no horizontal overflow or browser errors observed. Added a floor in Studio 3D, switched to Plan, and undid it without resetting history. Real catalogue/product/cart reads work; checkout renders the no-order screen. Empty Stripe/PayPal/Gumroad/lead probes return 403 SHOWCASE_READ_ONLY; final deployment Stripe guard and embed-only HTTPS framing headers rechecked. No customer data, order, payment, email or booking submitted. Separate Lighthouse continues to fail against unchanged production.
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
