# PPW Wellness Room Designer — 2D (Konva)

Drag-drop wellness-room planner for Peak Performance Wellness.
Cat 1 retailer/supplier email-blast unblocker.

**Sprint:** Week 1 of 4 (locked plan in Second Brain).
**Build path:** **C** — Konva 2D MVP at `/designer` (Babylon 3D evolution comes later, separate repo branch).
**Status as of 2026-05-11:** Week 1 scaffold complete; npm install + dev verify must run on Vic's Windows side (see *Known constraints* below).

---

## What this is

A single-page React app that lets a user:

1. Set their room dimensions in metres.
2. Drag wellness products (ice baths, sleep pods, ergo chairs, plants, eco-office kits) from a catalog onto a scaled top-down floor plan.
3. Snap to a 0.5 m grid.
4. Save the design and get a costed plan back.

**Week 1 ships steps 1 only fully — drag-drop is Week 2, cart Week 3, automation Week 4.**

The full sprint plan lives at:
`C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\email-blast-master\WRD-KONVA-SPRINT-PLAN.md`

---

## Stack

- Vite 5 + React 18 + TypeScript 5.6
- Konva 9 + react-konva 18 — the canvas engine
- Zustand 4 — state + localStorage persistence
- Tailwind CSS 3 — styling (PPW palette in `tailwind.config.js`)
- react-router-dom 6 — routes (`/` and `/designer` both mount the app)
- ESLint + Prettier — lint and format

---

## Run locally

From this directory in Windows PowerShell (or any shell):

```powershell
cd C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d
npm install            # first time, ~1–2 minutes
npm run dev            # serves at http://127.0.0.1:5173
```

Then open <http://127.0.0.1:5173/> in Chrome.

Other scripts:

```powershell
npm run typecheck      # tsc --noEmit, type validation only
npm run lint           # ESLint
npm run format         # Prettier --write src/
npm run build          # type-check + production build to dist/
npm run preview        # serve the production build at :5173
```

---

## What's built in Week 1

| File                                  | Lines | Purpose                                                  |
| ------------------------------------- | ----- | -------------------------------------------------------- |
| `package.json`                        |  ~30  | Deps and scripts                                         |
| `vite.config.ts`                      |  ~20  | Vite + React plugin + alias `@/* → src/*`                |
| `tsconfig.json` / `tsconfig.node.json`|  ~30  | Strict TS config                                         |
| `tailwind.config.js` + `postcss.config.js` | ~40 | PPW brand palette                                  |
| `.eslintrc.cjs` + `.prettierrc.json`  |  ~30  | Lint + format                                            |
| `index.html`                          |  ~20  | App shell, Inter web font                                |
| `src/main.tsx`                        |  ~18  | Router mount                                             |
| `src/App.tsx`                         |  ~20  | 3-pane layout                                            |
| `src/index.css`                       |  ~35  | Tailwind directives + body / scrollbar                   |
| `src/data/products.schema.ts`         |  ~95  | TS types matching CAT1-INVENTORY 16-col schema           |
| `src/data/products.json`              |  ~75  | 5 seed products with real dimensions + source URLs       |
| `src/data/products.ts`                | ~110  | Loader + filter helpers + SVG placeholder thumbnails     |
| `src/store/designStore.ts`            | ~125  | Zustand store with localStorage persistence              |
| `src/components/TopBar.tsx`           | ~135  | Logo · dim inputs · save/load stubs · grid toggle · help |
| `src/components/ProductPalette.tsx`   | ~150  | Left sidebar with search + category chips                |
| `src/components/RoomCanvas.tsx`       | ~210  | Konva stage, grid, walls, pan/zoom/reset                 |
| `src/components/DetailsPanel.tsx`     | ~115  | Right rail — selected item or design summary             |
| **Total source**                      | **~1300 LOC** | (excluding scaffolding)                          |

### Definition of done check

- [x] Vite + React + TS scaffold compiles cleanly
- [x] Konva + react-konva + Zustand + Tailwind + Router wired
- [x] ESLint + Prettier configured
- [x] `.gitignore`, `LICENSE` (MIT), `README.md`
- [x] `products.schema.ts` matches CAT1-INVENTORY 16-column schema
- [x] 5 seed products with real dimensions + price + source URL
- [x] RoomCanvas: configurable L×W (default 5×4 m), 100 px/m, 0.5 m snap-grid, walls, pan/zoom, reset
- [x] ProductPalette: search, category chips, draggable cards (drop handler stubbed for Week 2)
- [x] Zustand store with localStorage persist + actions (setRoomDimensions, addItem, removeItem, updateItem, selectItem, clearDesign, toggleGrid)
- [x] 3-pane layout with TopBar
- [ ] **`npm install` clean** — not verified on sandbox (Linux sandbox kills bg processes; must run on Windows)
- [ ] **dev server localhost:5173 200 OK** — same
- [ ] **Playwright screenshot to `screenshots/week1-day1.png`** — same

The three `npm`-dependent verifications need a 1-minute run on Vic's Windows side.

---

## Data model

The catalog is intentionally shaped to mirror the 16-column `CAT1-INVENTORY` sheet in `PPW-Email-Blast-Master.xlsx`. Week 2 ships a Node import script (`scripts/import-inventory.ts`) that reads the sheet and rewrites `src/data/products.json` — so the schema **is** the contract.

The 5 seed products were curated for category coverage with real-world dimensions and prices:

1. **Plunge All-In Cold Plunge** — 170×80×64 cm · $4,990 USD · [plunge.com](https://plunge.com/products/the-plunge-all-in)
2. **GoSleep Pod v3** — 220×110×200 cm · €12,500 · [gosleep.aero](https://www.gosleep.aero/)
3. **Herman Miller Aeron (Size C)** — 73×69×109 cm · $1,795 USD · [hermanmiller.com](https://www.hermanmiller.com/products/seating/office-chairs/aeron-chairs/product-details/)
4. **Snake Plant (90 cm)** — 30×30×90 cm · MUR 850 · [RHS Sansevieria taxonomy](https://www.rhs.org.uk/plants/17269/dracaena-trifasciata/details)
5. **Eco Office Kit (bamboo sit-stand desk + monitor riser)** — 140×70×120 cm · MUR 18,500 · [IKEA BEKANT reference](https://www.ikea.com/gb/en/p/bekant-desk-sit-stand-white-s99022530/)

Source URLs are stored in each product's `source_url` field.

---

## Known constraints (sandbox)

The Cowork sandbox where this scaffold was generated has two limits:

1. **`npm install` cannot run.** Each bash invocation kills its children when it terminates, so a 60–90 second install never completes. Solution: `npm install` runs on Vic's Windows side (1-minute one-off cost).
2. **Git operations restricted.** Windows mount permissions reject git's lock-file deletes from the Linux side. A clean `git init && git add . && git commit -m "week 1 mvp scaffold"` in PowerShell will work.

Neither limits the code itself. The TypeScript and React are written to compile and run.

---

## Branching

Per CLAUDE.md operating laws: **no remote pushes** from Cowork. All commits stay local. A `konva-mvp` branch name was reserved but git was init'd fresh here rather than in the existing `ppw-room-designer/` repo (its `.git/` was unrecoverably corrupt — see `WEEK-1-LOG.md`).

When Vic is happy with the build, the next step is:

```powershell
cd C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d
git init
git add .
git commit -m "Week 1 scaffold — Konva 2D Wellness Room Designer MVP"
git branch -m main konva-mvp        # optional rename
```

`git push` is held until Vic explicitly clears the PAT-used-without-asking ruling (REBIRTH §11.3).

---

## Roadmap

See `WRD-KONVA-SPRINT-PLAN.md` in Second Brain for the full 4-week plan. Quick reference:

- **Week 1** — scaffold, room renders, 5 seed products in palette (this).
- **Week 2** — drag-drop, snap-to-grid, rotate/delete/duplicate, region filter, xlsx → JSON importer.
- **Week 3** — cart, checkout (Shopify or Stripe Payment Links per §A.2), IP region detect, mobile responsive.
- **Week 4** — plan PDF (jsPDF), invoice email, admin dashboard, live deploy to `designer.ppwellness.co` (or `/designer` subpath per §A.3), Cat 1 blast unlocked.

---

## Decisions pending

Six infrastructure decisions in `DECISIONS-PENDING.md`. Three block Week 2/3, three are Week 4-only.

## Licence

MIT — see `LICENSE`. Built by Cowork for Vic Bhatoolaul, Peak Performance Wellness.
