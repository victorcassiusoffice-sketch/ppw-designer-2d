<!-- materials-release:start -->
## Verified Materials release — 30 September 2026

**Production is updated and verified.** Application commit `2801861d4a6acfc332f2ecf77ed6ec64c7983a62` is on both `main` and `cursor/feat-3d-flooring-hud-bc95`. Victor explicitly authorized this release: “Once done — Push to main, and demos where needed.” This supersedes older no-main notes for this release. Future production changes still need their own applicable authorization. Development checkout remains on the feature branch.

- Production Designer: https://designer.ppwellness.co/designer
- Production Materials demo: https://designer.ppwellness.co/demo?view=3d&panel=materials
- 2D demo: https://designer.ppwellness.co/demo?view=2d
- Construction pitch, independent UBP example: https://designer.ppwellness.co/pitch/construction
- Developer pitch: https://designer.ppwellness.co/pitch/developers
- Merchant pitch: https://designer.ppwellness.co/pitch/merchants
- Standalone Studio + Shop: https://designer.ppwellness.co/studio
- Shop: https://designer.ppwellness.co/studio/shop
- Embed: https://designer.ppwellness.co/embed/designer?scene=home&view=3d&panel=materials
- Legacy paint demo route: https://designer.ppwellness.co/designer?demo=tintex
- Latest unique feature preview: https://ppw-designer-2d-dpt7ob6s5-victor-ppw.vercel.app/designer
- Feature Materials demo: https://ppw-designer-2d-dpt7ob6s5-victor-ppw.vercel.app/demo?view=3d&panel=materials
- Feature paint demo: https://ppw-designer-2d-dpt7ob6s5-victor-ppw.vercel.app/designer?demo=tintex
- Feature deployment: `6765248709` (Preview). Production deployment: `6765494476`, unique host `https://ppw-designer-2d-gtx0q9cov-victor-ppw.vercel.app`. Both Vercel deployments report success. Production-domain health confirms `2801861d4a6acfc332f2ecf77ed6ec64c7983a62` with `env:production`. New and previously working Vercel preview hosts timed out from this connection during the final check; use the healthy production domain for pitches. The core Materials preview `https://ppw-designer-2d-ffzgdd9ou-victor-ppw.vercel.app` was verified in the browser and by its healthcheck before that connectivity issue.

Landed: permanent/versioned Materials settings saved with designs; physical shared-wall/opening and footprint measurements; editable concrete-block/mortar/plaster/base/pillar estimates; concrete/rebar and profiled-sheet roof quantities; formula/source report export. Supplier references include UBP, Gamma, Kolos, Joonas, Grewals and Profilage. Five measured garden furniture products from Mr. Bricolage Mauritius and JKalachand have original dimensional previews and dated source records. Model-facing/envelope accuracy is corrected; Plan/3D lamp radius, colour and day/night behavior share one calibration. Plan camera and energy controls are docked, Materials/Solar reserve side/bottom space, basket totals use a fixed panel footer, and selected 3D items open full details only on request.

Validation: **282 test files / 3,118 tests passed** on core release `5b3f5f9`; client/API typechecks and build passed; changed-file ESLint passed; no public source maps. GitHub Quality gates and Secrets scan passed for that core release. Final follow-up `2801861d4a6acfc332f2ecf77ed6ec64c7983a62` fixes phone Solar contrast through theme variables; 17 existing Solar/Materials tests, typecheck and changed-file ESLint pass. Desktop and 390px phone UI checked; deployed Materials roof depth changed 91m²×0.15m×1.05 = 14.333m³ to 91m²×0.20m×1.05 = 19.11m³ and carried into Plan. Designer, legacy paint demo, Studio and all three pitches return HTTP200 on production. Actual screenshot: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-Materials-Live-2026-09-30.png`.

Limits are visible in the app: quantities are planning estimates, not structural/cyclone design or supplier orders. One selected wall construction applies to the measured wall scope. Ground bases and roofs remain whole-building measurements. Roof penetrations/overhangs require a verified area override; irregular steel/sheet layouts need a checked rectangle/cutting schedule. Rebar allocation is conservative per-run stock, not optimized cut-and-bend. Models remain dimensional previews unless supplier CAD is provided; lighting is visual, not certified lux. No orders, payments, emails or supplier mutations were submitted. Global repository lint has existing unrelated issues; changed files are clean.

Active source: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`. Preserve the original checkout `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d` and recovery stash `649569db5766b86c5880321f6cfea782f356da1f` (`^3` contains its untracked files). Do not restore/drop it wholesale. Historical PR #36 was merged externally on 26 September.

Extension contracts: `docs/DESIGNER-INTELLIGENCE.md`, `docs/MATERIALS-RESEARCH-MAURITIUS.md`, `docs/RENDERING-ACCURACY.md`, `docs/MAURITIUS-OUTDOOR-SOURCES.md`. No chat/AI service is required to run these algorithms. All routes use one source application.

<!-- materials-release:end -->

<!-- codex-continuation:start -->
## Current continuation status — 29 September 2026, interaction fixes

- Active checkout: `C:\Users\Victor\Documents\Codex\2026-09-23\c\work\ppw-designer`.
- Branch: `cursor/feat-3d-flooring-hud-bc95` only. Never push/merge main or deploy production without Victor's explicit new authorization. PR #36 is historical (merged externally 26 September).
- Verified application `1be7bf68002c47bf96e29de2a69d386159edd0c5`, Vercel Preview `6739155621`; healthcheck `env=preview`.
- Later portrait Fit fix `23eb787` is committed and tested; deployment verification remains pending because both `n7pw1fmhm` and `mxkxb9qu1` preview hosts time out on this connection. Read the workflow before updating the pinned link.
- Demo 2D: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/demo?view=2d · Premium 3D: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/demo?view=3d
- Studio + Shop: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/studio
- Developer pitch: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/pitch/developers · merchant pitch: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/pitch/merchants
- Designer: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/designer · paint Demo: https://ppw-designer-2d-55airl1ig-victor-ppw.vercel.app/designer?demo=tintex
- Latest: stable 3D camera/scale and faster motion; continuous wall-snapped doors/windows; direct garden surface draw/select/corner-resize; no phantom undo on Garden; Plan zoom out to 4%; roof panels ONLY visible on Roof per latest user direction.
- SketchUp supplier GLB import command is ready, with documented limits and tests. No direct `.skp` support or supplier CAD added. Read `docs/SKETCHUP-MODELS.md`.
- Resume from `docs/DESIGNER-WORKFLOW-LOG.md`; bug analysis: `docs/DESIGNER-INTERACTION-AUDIT-2026-09-29.md`. Verified checks and limitations are recorded there.
- Previous work preserved in stash `649569db5766b86c5880321f6cfea782f356da1f`; untracked files in `^3`. Do not restore/drop wholesale. Original checkout source is preserved; only its handoff/link documents were synchronized.
- Saveable handoff with every full file path: `C:\Users\Victor\Documents\Codex\2026-09-23\c\outputs\Room-Designer-AI-File-Locations.md`.
- Production https://designer.ppwellness.co was not touched. Original §7 below still requires explicit authorization.
<!-- codex-continuation:end -->

# Designer handoff — PPW Room Designer (PR #36)

**Product:** Peak Performance Wellness Room Designer  
**Owner:** Victor Cassius Bhatoolaul · victor@ppwellness.co · ppwellness.co  
**Written:** 2026-09-23 (Mauritius)  
**This file is self-contained.** A designer with zero context should read it once and be able to build.

---

## 0. Role split (API credits)

| Who | Owns | Does not own |
|---|---|---|
| **You (designer agent)** | **All** design and build on this repo: UI, 3D, paint, phone chrome, Sims draw feel, Vercel **preview** deploys from the feature branch | Emails, pitch status, calendars, “what to present,” outreach |
| **Main agent / Victor** | Tracking emails, pitches, presentations, interview logistics | Burning credits on design implementation |

If the ask is pixels or code in this repo — you do it end to end, including a working preview link. If it is email or “did they reply?” — hand it back.

---

## 1. What this is

A 2D / 3D room planner for Mauritius retailers and suppliers. Customers draw rooms to scale, apply paint / flooring / products, see the space in 3D, and get a costed basket.

**Interview tomorrow:** TintEX (Tintex Company Ltd) and others. They need a **working link** to open on laptop and phone. Prefer the feature preview for the latest phone chrome; production is the safe fallback (TintEX paint demo already live on main).

**Demo paths:**
- Blank / general: `/designer`
- TintEX show flat: `/designer?demo=tintex`
- Other demos exist (`sofap`, `captamarin`, `courts`) — use TintEX for this interview unless Victor says otherwise

---

## 2. Repo, branch, links

| | |
|---|---|
| **GitHub** | https://github.com/victorcassiusoffice-sketch/ppw-designer-2d |
| **Local path** | `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d` |
| **Feature branch** | `cursor/feat-3d-flooring-hud-bc95` |
| **Draft PR** | https://github.com/victorcassiusoffice-sketch/ppw-designer-2d/pull/36 |
| **Production (safe, `main`, untouched by this PR)** | https://designer.ppwellness.co |
| **Feature preview (branch alias)** | https://ppw-designer-2d-git-cursor-feat-3d-flooring-hud-bc95-victor-ppw.vercel.app/designer |
| **Unique deploy fallback** (if alias stalls) | https://ppw-designer-2d-kljmm2jpg-victor-ppw.vercel.app/designer |
| **TintEX on production** | https://designer.ppwellness.co/designer?demo=tintex |
| **TintEX on preview** | `…vercel.app/designer?demo=tintex` (same path on the preview host) |
| **Build links doc** | `docs/BUILD-LINKS.md` · Desktop `CURRENT-WORK-LINKS.md` |

Default branch is `main`. Production deploys from `main` only.

---

## 3. Current state (this call / PR #36)

### On the feature branch (preview) — phone chrome pass (~d318156 and later)

Work targeted **phone**; **desktop left alone** unless a change is shared infrastructure.

- **Wall pen** — flush left, compact, small (not a big floating card blocking draw)
- **HUD clutter** (currency, area, price noise) — tucked behind an **m² pill** so the canvas stays open
- **Cart** — flush tab on the right
- **3D** — first-class **strip / top-bar control**, not buried in a burger menu; tapping 3D must clearly enter 3D
- **Wall height** — slim **− / m / +** bar (~toolbar sized), flush to the side
- **Sims-style wall drawing on phone** — reduce awkward pen/draw behaviour; closer to Sims build feel
- Earlier on same branch: post-draw wall height, sample cladding SKUs, 3D flooring paint, paint-finish sheen wiring

### On production (`main`) — do not break; interview fallback

- Live designer at designer.ppwellness.co
- TintEX five paint lines + `?demo=tintex` show flat, 3D paint UX, litres / tins breakdown
- Price caveat: TintEX figures are 2021 capture until they supply a current list — do not invent prices

### Held / do not invent

- Real Spa Concept cladding catalog (waiting on Marine)
- Merchant Connect / OMS checkout for cladding–floor–paint
- Cap Tamarin dedicated embed landing
- Garden Phase 1

---

## 4. Brand / play it safe

- **Brand:** Peak Performance Wellness · **ppwellness** · site teal accent (app teal ~`#0F766E`; keep existing tokens — do not restyle the whole app)
- **Tone:** calm, medical-adjacent **wellness** — clear, trustworthy, no jokey or risky copy
- **Mauritius / MUR** for local demos; do not flip currency mid-demo
- **TintEX interview:** show TintEX lines only in `?demo=tintex` (no competitor paint chips in that demo)
- **Phone + desktop:** interview uses both; every change must work on a narrow phone viewport
- No secrets, private codes, or internal margin tables in public UI or PRs

---

## 5. Tech stack

- **React 18 + TypeScript + Vite**
- Plan: Konva · 3D: three.js · state stores in existing codebase
- Tests: Vitest + Playwright e2e (see `tests/e2e/tintex-paint.spec.ts` and related)
- Hosting: Vercel (preview per branch; production on `main` → designer.ppwellness.co)
- Key UI files often touched on this branch: `TopBar.tsx`, `RoomCanvas.tsx`, `RoomView3D.tsx`, `RoomDrawMode.tsx`, `CartStrip.tsx`

```bash
cd C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d
git checkout cursor/feat-3d-flooring-hud-bc95
npm install
npm run dev
# gates before claiming done:
npm run typecheck
npm test
```

---

## 6. Safety — NEVER push to `main`

**Hard rule:** you must **never** push, merge, or force anything onto `main`. All work stays on `cursor/feat-3d-flooring-hud-bc95` (or a new `feat/…` cut from latest `main`). Ship via **Vercel preview** so Victor has a link for the interview.

### Normal ship (preview only)

```bash
cd C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d
git checkout cursor/feat-3d-flooring-hud-bc95
# … commit your work …
git push -u origin HEAD
# Wait for Vercel SUCCESS on PR #36
# Share: https://ppw-designer-2d-git-cursor-feat-3d-flooring-hud-bc95-victor-ppw.vercel.app/designer
# Update docs/BUILD-LINKS.md and Desktop CURRENT-WORK-LINKS.md if the unique deploy URL changes
```

### Interview fallback (no merge)

If preview is broken:  
https://designer.ppwellness.co/designer?demo=tintex

---

## 7. EMERGENCY ONLY — put the feature branch on `main`

**Only if Victor explicitly says the interview will fail without production and the preview is dead.** Prefer fixing the preview.

```bash
cd C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d
git fetch origin
git checkout cursor/feat-3d-flooring-hud-bc95
git pull origin cursor/feat-3d-flooring-hud-bc95

npm run typecheck
npm test

git checkout main
git pull origin main
git merge --no-ff cursor/feat-3d-flooring-hud-bc95 -m "emergency: ship PR #36 branch for interview"
git push origin main
```

Or (still needs Victor’s verbal yes):

```bash
gh pr ready 36
gh pr merge 36 --merge --subject "emergency: interview production ship"
```

Then verify: https://designer.ppwellness.co/designer and `/designer?demo=tintex`  
If anything fails: **stop**. Do not force-push. Tell Victor immediately.

---

## 8. Starter prompt (paste to kick the designer)

```
I'm going to get you to build a few things on this designer — start by reading the handoff at C:\Users\Victor\Desktop\DESIGNER-HANDOFF-ROOM-DESIGNER.md (same file in the repo root), then we'll go from there.

Rules: you do ALL design/build. Never push or merge to main. Stay on branch cursor/feat-3d-flooring-hud-bc95 (PR #36) and keep a working Vercel preview at /designer (and /designer?demo=tintex for the TintEX interview). Production https://designer.ppwellness.co is the safe fallback. Emergency main push is only in handoff §7 if I explicitly say so.

First job: open the feature preview and production TintEX demo, confirm both load on phone-width and desktop, then wait for my next build ask.
```

---

## 9. Pre-interview checklist

- [ ] Feature preview `/designer` loads on phone and desktop  
- [ ] TintEX: preview and/or production `?demo=tintex` loads  
- [ ] 3D is one clear tap from the top strip (not buried in a burger)  
- [ ] Phone chrome still flush: wall pen left, m² pill, cart right, slim wall height  
- [ ] Nothing merged to `main` unless Victor ordered §7  

---

*End of handoff. Room Designer only — no other products.*
