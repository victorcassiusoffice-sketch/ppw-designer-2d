# CLAUDE.md — PPW Designer Frontend Rules
**Repo:** `ppw-designer-2d` (Konva 2D MVP → Babylon 3D evolution)
**Live URL:** `https://designer.ppwellness.co`
**Authored:** 2026-05-21 (Mammoth Upgrade P1.1)
**Drop this file at:** `<repo-root>/CLAUDE.md` (or merge into existing CLAUDE.md as the Frontend section)

## Always Do First
- **Invoke the `ppw-frontend-screenshot-loop` skill** (in vault `06-Roadmap/skills/`) before writing any frontend code, every session, no exceptions.
- Read `vercel.json` + check lambda count (12/12 cap held; fold new endpoints into `api/orders.ts` or `api/admin-router.ts` catchall — see `vercel_catchall_folding.md`).
- Confirm Konva stable-lock at commit `26c144c` per V0c. Do not modify Konva engine files without a Vic-decision V-code.

## Brand Pack — Use These Exact Values (binding, not invented)
- **Navy** `#232C3B` — primary surface, headings
- **Gold** `#FFBB58` — accent, CTAs, badges
- **Cream** `#F5EBD7` — light surface, body background
- **Display font** EB Garamond (headings, hero copy)
- **Body font** Inter (UI text, body, microcopy)
- **Tracking** `-0.03em` on display headings ≥ 32px
- **Line-height** `1.7` on body
- Brand-pack canonical source: `06-Roadmap/brand/2026-05-18-PPW-Brand-System/00-COLOUR-SYSTEM.md`

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference: design from scratch with high craft. Apply Anti-Generic Guardrails below.
- Screenshot output, compare against reference, fix mismatches, re-screenshot. Minimum 2 comparison rounds. Stop only when no visible differences remain or Vic says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Dev server: `pnpm dev` (Vite, port 5173) for full Designer stack OR `node serve.mjs` for static-style preview (port 3000).
- `serve.mjs` lives in the project root. Start in background before screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Use `node screenshot.mjs <url>` (path-mapped to local Puppeteer install).
- Screenshots auto-save to `./temporary screenshots/screenshot-N.png` (auto-increment, never overwrite).
- Optional label: `node screenshot.mjs http://localhost:5173 hero` → `screenshot-N-hero.png`.
- After capture, Read the PNG with the Read tool — Claude sees the image directly.
- When comparing be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px".
- Check: spacing/padding, font size/weight/line-height, colors (exact hex against brand pack), alignment, border-radius, shadows, image sizing.

## Output Defaults (Designer-specific)
- React component within existing `src/components/<area>/` tree, NOT a new index.html unless explicitly asked
- Tailwind config already in place — extend `tailwind.config.js` `theme.extend.colors` with brand tokens, do NOT use raw Tailwind palette
- Mobile-first: 320px base, breakpoints at 640 / 768 / 1024
- Konva canvas pieces in `src/canvas/` — NEVER inline Konva in React render bodies
- Babylon pieces in `src/babylon/` — engine-toggle flag respected (`useEngineFlag.ts`)

## Anti-Generic Guardrails (binding)
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, sky-*, slate-*). Use brand tokens or derive (e.g. `navy-900` = `#232C3B`).
- **Shadows:** Never `shadow-md`. Use layered, gold-tinted shadows with low opacity (e.g. `shadow-[0_4px_12px_-2px_rgba(255,187,88,0.18),0_2px_4px_-1px_rgba(35,44,59,0.08)]`).
- **Typography:** Display = EB Garamond, body = Inter, never the same font for both. `-0.03em` on big headings, `1.7` on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
- **Interactive states:** Every clickable element needs hover + focus-visible + active states. No exceptions.
- **Images:** Gradient overlay (`bg-gradient-to-t from-navy-900/60`) + color treatment via `mix-blend-multiply` where appropriate.
- **Spacing:** Intentional 4/8/12/16/24/32/48/64 px scale only — no random Tailwind steps.
- **Depth:** Surfaces have a layering system (base → elevated → floating), never all at one z-plane.

## Brand Assets
- Check `brand_assets/` (or `public/brand/`) before designing. Logos, color guides, brand imagery live there.
- If a logo or palette is present, USE IT. Do not invent variations.

## Hard Rules
- Do not add sections, features, or content not in the reference or spec
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass — minimum 2 rounds
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- Do not modify the 12/12 Vercel lambda count — fold endpoints into catchall routers
- Do not bypass the Konva stable-lock (V0c)
- Do not generate Babylon hero meshes via the parked $1,800 path — use Image Blaster (`image_blaster_stack.md`)

## Cross-references
- Brand pack: `06-Roadmap/brand/2026-05-18-PPW-Brand-System/`
- Screenshot-loop skill: `06-Roadmap/skills/ppw-frontend-screenshot-loop.md`
- Lambda discipline: `06-Roadmap/skills/vercel_catchall_folding.md`
- Konva drag/snap: `06-Roadmap/skills/konva_drag_snap.md`
- Gaming-layer skills: `06-Roadmap/skills/ppw-gaming-*.md`
- User-testing discipline: `06-Roadmap/skills/phase_a_user_testing.md`
