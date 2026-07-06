# Designer → Claude Design export

Prep pack so Vic can refine the Wellness Room Designer in Claude Design (claude.ai
artifacts), the same way the Fascia App was prepped
(`C:\Users\Victor\Documents\PPW-Second-Brain\06-Roadmap\09-Fascia-App\claude-design-upload\`).
Generated 2026-07-06 from `main` @ `241de3a`. Prep only — no live-deploy changes.

## Files

| File | What it is |
|---|---|
| `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\claude-design-export\ppw-designer-artifact.html` | Single self-contained faithful duplicate of the current Designer UI (HTML/CSS/vanilla JS, zero external requests). Renders standalone in Claude artifacts or any browser. Real 22-product K1 catalog inlined; Konva stage reproduced as an interactive SVG. |
| `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\claude-design-export\CLAUDE-DESIGN-PROMPT.txt` | Paste-ready brief for Claude Design: what the app is, panel-by-panel map, brand tokens, duplicate-first rule, design-phase rules. |
| `C:\Users\Victor\Documents\PPW-Code\ppw-designer-2d\claude-design-export\README.md` | This file. |

## How to get it into Claude Design (3 steps)

1. Open a new chat on claude.ai (artifacts/design canvas enabled).
2. Paste the full text of `CLAUDE-DESIGN-PROMPT.txt` as your message, and attach
   `ppw-designer-artifact.html` (or paste its contents in the same message).
3. Claude renders the duplicate as an artifact first (Step 1 in the prompt).
   Confirm it matches, then give refinement instructions change-set by change-set.

Sanity check before uploading: double-click `ppw-designer-artifact.html` — it must
open and work in a plain browser with no server.

## What the duplicate covers

- Exact boot state of the live app: blank canvas + cream "Start by drawing your
  room" card, "Draw a room →" placeholder in the top bar, "No room yet" details.
- Top bar, room list, catalog (search / Eco-only / region / macro tabs / tile grid),
  canvas overlays (Reset view, Share render, Capture screen, area+zoom badge, gold
  cost readout, item counter, Clear products / Clear all), details panel, cart strip,
  mini cart pill, floating item cluster, help overlay ("?"), 3-step coach mark,
  build stamp, dark toggle, mobile Sims bottom toolbar (<1024 px).
- Working interactions: Quick 5×4 room, simplified polygon draw, arm-then-tap
  placement with 0.5 m snap, drag, select, rotate 90°, duplicate, delete, undo/redo
  (Ctrl+Z/Y), Shift+P / Shift+X clear flows, currency switch, keyboard shortcuts.
- Verbatim brand tokens from `tailwind.config.js` and the hardcoded Sims register.

## Fidelity caveats

1. **Konva → SVG.** The real canvas is Konva; the duplicate is an SVG that looks and
   behaves the same for design purposes.
2. **No product photos.** Artifacts block external requests, so catalog tiles and
   placed items use the app's own inline category-SVG / colour-box fallbacks
   (`thumbnailFor()` + `CATEGORY_FILL` — real code paths, they just aren't the
   photo-rich look of production).
3. **Simplified tools.** Polygon Draw closes to its bounding rectangle; Wall tool is
   a visual toggle; Save/Load/Request-quote/checkout/cart-page are toast stubs.
4. **Dark mode** button is present but the dark theme is not replicated.
5. **Coach mark shows every load** (artifacts forbid localStorage) — Skip it.
6. **Font**: Inter via system stack, no webfont fetch (identical on machines with
   Inter; close fallback otherwise).

## Precedent note

The Fascia App prep was an *upload pack* (manifest + design plans + 9 REF clips +
screenshots) plus a pure-HTML screen mockup (`ppw-fascia-app\docs\mockup-today.html`);
no single-file artifact or prompt file existed there. This export follows the same
philosophy (faithful current-state capture + written brief) delivered in the
artifact-file form requested for the Designer.
