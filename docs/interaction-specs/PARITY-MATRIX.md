# Designer Interaction PARITY-MATRIX

> Audit of `ppw-designer-2d` (`feat/oms-combined-phases-1.5-2-3` @ `d128b34`) against
> `2D-Designer-Interaction-Spec-Desktop.md` + `2D-Designer-Interaction-Spec-Mobile.md`.
> Every "already works" claim verified by reading the code (verify-before-cite), file:line cited.
> Authored 2026-05-30 for the Feature-Finish work. Konva STABLE LOCK `26c144c` — additive only.

**Status legend**

- `✅ SHIPPED` — present + correct vs spec (verified in code).
- `🟡 PARTIAL` — present but diverges from spec; concrete change listed.
- `❌ GAP` — absent.
- `🚩 DEFERRED` — out of this increment; rationale + flag noted (spec marks several "optional").

**PPW adaptations of the Sims model (deliberate, documented):**

1. **"Funds" → cart total.** PPW is a real shop, not a fixed-budget game. There is no
   simoleon ceiling. "Deduct cost" = add to cart (`placeAtRoomPoint` → `addItem` + 5 s Undo
   toast, RoomCanvas.tsx:375-389, a Vic-Y'd V4-UX-1 behaviour). "Out-of-funds disabled tint"
   has no analogue unless a budget is introduced → `🚩 DEFERRED` (needs a product decision).
   "Undo = full refund" = undo/history removes the cart line (historyStore snapshot).
2. **Placement is commit-with-undo, not confirm-first.** The existing mobile flow commits on
   drop/tap and offers a 5 s Undo (V4-UX-1). The spec's `✓ confirm / ✗ cancel` is reconciled:
   after a placement the item is *selected* and the inline cluster shows — `✓` = keep+deselect,
   `✗`/`🗑` = remove (undo the add). This keeps the Vic-Y'd auto-cart behaviour AND gives the
   inline-cluster feel. Documented so it is not mistaken for an unbuilt confirm gate.

---

## Flagship — Rotation must be fully INLINE

| # | Spec | Current behaviour (verified) | Desired | Change | File(s) |
|---|---|---|---|---|---|
| F1 | Rotation inline, no screen/modal | **Mobile: tapping a placed item opens a full-screen slide-up `DetailsPanel` modal (backdrop `fixed inset-0 z-40 bg-black/30` + `fixed bottom-0 max-h-[85vh]`) whose ↺/↻ buttons are the only easy rotate UI. THIS IS THE "NEW SCREEN" Vic reported.** DetailsPanel.tsx:265-275, 178-193 | Manipulation (rotate/dup/delete/style) happens on the canvas via a floating cluster; no modal | Replace the mobile manipulation modal with an on-canvas floating cluster anchored to the selection. Keep DetailsPanel as desktop right-rail + a mobile *info* sheet only (no longer the rotate surface). | `DetailsPanel.tsx`, new `FloatingCluster.tsx`, `RoomCanvas.tsx`/App wiring |
| F2 | Desktop right-click-drag rotate, `<`/`>` 90°, Alt=free | On-canvas draggable rotate handle exists but **snaps 15°** (RoomCanvas.tsx:1311-1314); keys: `R`=90° CW, `Shift+R`=15°, `Alt+R`=90° CCW (useKeyboardShortcuts.ts:58-77). No `<`/`>`. No right-click-drag rotate. | Handle: **90° detents default, Alt(or Shift)=free**. Add `<`/`>` keys = ∓90°. Right-click-drag = rotate. | Change handle snap to 90° w/ Alt-free; add `<`/`>` to key handler; add right-button drag-rotate on selected item. | `RoomCanvas.tsx`, `useKeyboardShortcuts.ts` |
| F3 | Mobile ⟳: tap=90°, drag handle=free, two-finger-twist=free | On-canvas handle drag (15° snap) works on touch (Konva). No cluster ⟳. No two-finger twist. | Cluster ⟳ tap = +90°; drag the handle = free; (two-finger-twist `🚩 DEFERRED`). | New cluster ⟳ → `rotateSelected(90)`; reuse handle for free drag. | `FloatingCluster.tsx`, `placementActions.ts` |

---

## Desktop spec rows

| # | Spec feature | Status | Current (verified) | Change |
|---|---|---|---|---|
| D1 | Click catalog icon → cursor-ghost PLACING | ✅ SHIPPED | `pendingProductId` armed → ghost follows pointer (RoomCanvas.tsx:115-119, 749-764, 873-902) | — |
| D2 | Move mouse → ghost snaps, valid/invalid tint | ✅ SHIPPED | `computeGhost` snaps 0.5 m + `validatePlacement`; green/red fill (RoomCanvas.tsx:493-527, 887-888) | — |
| D3 | Left-click place, deduct cost, exit placing | ✅ SHIPPED | onClick commit → `placeProductAt` → cart (RoomCanvas.tsx:788-798) | — |
| D4 | **Shift+click repeat-place / stamp** | ❌ GAP | onClick always clears `pendingProductId` (RoomCanvas.tsx:794-797) — ghost never persists | Keep ghost armed when `e.evt.shiftKey`; commit without clearing. Haptic/toast unchanged. |
| D5 | Esc / right-click cancel placing | ✅ SHIPPED | Esc (RoomCanvas.tsx:182-186), right-click (765-771) | — |
| D6 | Select placed (Hand) | ✅ SHIPPED | click/tap selects (PlacedItemGroup onMouseDown/onTap 1113-1127) | — |
| D7 | Move placed (drag, re-snap) | ✅ SHIPPED | drag → `resolveDragTarget` snap/collision (1135-1182) | — |
| D8 | Hover outline | ✅ SHIPPED | cursor grab + selected stroke (1105-1111, 1218) | hover-outline-on-unselected is `🟡` minor; cursor change present |
| D9 | Rotate (handle/keys) | 🟡 PARTIAL | see F2 | F2 |
| D10 | Free-angle (Alt) | 🟡 PARTIAL | only Shift on the handle; no Alt key | F2 — Alt=free on handle + keys |
| D11 | **Eyedropper (E)** copy type | ❌ GAP | none | Add tool: E arms eyedropper; click placed item → arm its productId as ghost. |
| D12 | Delete (Del / Sledgehammer J) | 🟡 PARTIAL | Del works (useKeyboardShortcuts.ts:86-90); **no sledgehammer (J) tool** | Add `J` sledgehammer mode: click placed item deletes it (repeat). |
| D13 | **Recolor / Design (R tool) + swatches** | ❌ GAP | `R` is rotate; no object recolor; no swatch tray | `🚩 DEFERRED` (object-tint model + per-product variants is a data change; flag, don't block) — documented. |
| D14 | Hand tool (H) | 🟡 PARTIAL | pan is default-on; no explicit H tool toggle | Add `H` = ensure hand/pan mode (cancels any armed tool). Low-cost. |
| D15 | **Ctrl+F full↔quarter-tile snap** | ❌ GAP | snap hardcoded 0.5 m (RoomCanvas.tsx:355-356, 511-512) | Add a precision toggle (store flag) → 0.5 m / 0.25 m; `Ctrl+F` + UI button. |
| D16 | **`[` / `]` z-layer** | ❌ GAP | no z-order field on PlacedItem; render order = array order | `🚩 DEFERRED` (needs a `z` field on PlacedItem + ordered render; additive but schema-touching) — flag. |
| D17 | **`M` surface-slot shuffle** | ❌ GAP | no surface-slot model | `🚩 DEFERRED` (no surface/slot model exists; large) — flag. |
| D18 | Ctrl+Z / Ctrl+Y undo/redo + full refund | ✅ SHIPPED | history snapshot store; Ctrl+Z/Ctrl+Shift+Z (useKeyboardShortcuts.ts:48-56); refund = cart line removed via snapshot. Note: spec says `Ctrl+Y` for redo → add as alias. | Add `Ctrl+Y` alias for redo. |
| D19 | Scroll / +/- zoom | 🟡 PARTIAL | wheel zoom ✅ (handleWheel 229-249); **no +/- keys** | Add `+`/`-` keys = zoom in/out about centre. |
| D20 | Right-drag / WASD pan | 🟡 PARTIAL | drag-pan ✅ (any-button via Stage draggable); **no WASD/arrows** | Add `W A S D`/arrows = nudge viewport. |
| D21 | Live cost readout | 🟡 PARTIAL | readout shows area/perim/zoom + item count (RoomCanvas.tsx:688-699); **no running cost total** | Add running MUR total of placed items to the readout. |
| D22 | Out-of-funds disabled tint | 🚩 DEFERRED | no budget model (see adaptation #1) | flag |
| D23 | Valid normal / invalid red drop-blocked | ✅ SHIPPED | ghost red + commit no-ops on invalid (computeGhost/validatePlacement) | — |
| D24 | Marquee multi-select (optional) | 🚩 DEFERRED | `useMultiSelect`/`marqueeSelect` helpers exist + tested but **not wired** (useMultiSelect.ts; no importer) | Spec says "optional power feature" → flag, don't block. |

---

## Mobile spec rows

| # | Spec feature | Status | Current (verified) | Change |
|---|---|---|---|---|
| M1 | Tap thumbnail → spawn selected ghost + cluster, catalog auto-collapses | 🟡 PARTIAL | tap → `MobileProductPopup` (SimsBottomToolbar.tsx:101-105); "+Add" places at centre & commits (no selected-ghost-with-cluster state, no auto-collapse) | After placement, auto-select the new item + show cluster (reconciliation #2); collapse the sheet. |
| M2 | **Drag rendered OFFSET ABOVE fingertip (anti-occlusion)** | ❌ GAP | drag ghost centered on finger (`marginLeft/Top: -36`, useDragToPlace.tsx:170-175) | Offset ghost ~64 px above the touch point. Non-negotiable. |
| M3 | Tap ✓ / empty commit | 🟡 PARTIAL | tap-empty deselects; commit already happened on drop | Map cluster `✓` = keep+deselect. |
| M4 | ⧉ duplicate = commit + new ghost one tile over | 🟡 PARTIAL | `duplicateSelected` adds +0.5 m copy (placementActions.ts:80-115) but no cluster button; not "new selected ghost" | Cluster `⧉` → duplicate + select the copy. |
| M5 | ✗ (iOS) / Back (Android) cancel | ❌ GAP | popup Cancel only; no cluster ✗; no Android Back handling | Cluster `✗` = remove just-placed / deselect; wire `popstate` (Android Back) to cancel. |
| M6 | **Floating cluster (✓ ✗ ⟳ ⧉ 🗑 🎨) anchored, flips at edges, never under finger** | ❌ GAP | none (manipulation is the slide-up modal) | Build it. ★ flagship F1/F3. |
| M7 | Gesture: object-drag=move vs empty-drag=pan | ✅ SHIPPED | item Group draggable; empty Stage drag pans; selection decides (PlacedItemGroup draggable + Stage draggable) | — |
| M8 | Pinch zoom | ✅ SHIPPED | two-finger pinch (RoomCanvas.tsx:251-332) | — |
| M9 | 🗑 / trash-zone delete | 🟡 PARTIAL | no cluster 🗑; trash-zone none | Cluster `🗑` → `deleteSelected` + haptic. Trash-zone `🚩 DEFERRED`. |
| M10 | 🎨 swatch tray | ❌ GAP | none for objects | `🚩 DEFERRED` with D13 (recolor model). Cluster shows `🎨` only if recolor lands. |
| M11 | Eyedropper toggle | ❌ GAP | none | With D11 (shared tool). |
| M12 | ▲▼ wall z-stepper (wall items) | 🚩 DEFERRED | no wall-mounted-item model | flag |
| M13 | Precision full↔quarter toggle | ❌ GAP | none (see D15) | With D15 — top-bar precision toggle (works both platforms). |
| M14 | Top-bar undo/redo | 🟡 PARTIAL | keys only on desktop; **mobile has no on-screen undo/redo** | Add undo/redo buttons to the mobile top chrome. |
| M15 | **HAPTICS on snap/place/rotate-detent/duplicate/delete/invalid** | ❌ GAP | none in designer (`navigator.vibrate` only in CameraStage) | Add a `haptics` util (`navigator.vibrate`, guarded) fired on those events. |
| M16 | Safe-area insets | ✅ SHIPPED | `env(safe-area-inset-*)` used (RoomCanvas top/bottom, App build-stamp, toolbar paddingBottom) | cluster must also respect insets. |
| M17 | ≥44 pt iOS / ≥48 dp Android touch targets | 🟡 PARTIAL | toolbar minimize 36 px (SimsBottomToolbar.tsx:162 `h-9 w-9`); cancel chip 36 px | New cluster buttons ≥48 px; bump existing sub-44 controls. |

---

## Implementation plan for THIS increment (GATE 1)

**Tier 1 — flagship + core feel (implement + test now):**
F1, F2, F3 (inline rotation everywhere; kill the mobile modal) · D4 (Shift+click stamp) ·
M2 (offset-above-finger) · M6 (floating cluster: ✓ ✗ ⟳ ⧉ 🗑) · M1/M3/M4/M5 (cluster wiring) ·
M15 (haptics) · M14 (mobile undo/redo) · M17 (touch targets).

**Tier 2 — tools + precision (implement if clean):**
D11/M11 (eyedropper) · D12 (sledgehammer J) · D14 (Hand H) · D15/M13 (quarter-tile precision toggle) ·
D18 (Ctrl+Y) · D19 (+/- keys) · D20 (WASD pan) · D21 (running cost total).

**Tier 3 — flagged, NOT built this pass (documented, not silently dropped):**
D13/M10 (object recolor + swatches — data model change) · D16 (`[`/`]` z-layer — schema field) ·
D17 (`M` surface-slot) · D22 (out-of-funds — no budget model) · D24 (marquee — spec-optional) ·
M9 trash-zone · M12 (wall z-stepper) · F3/M-twist (two-finger twist on object).
Each is a deliberate scope cut with the reason above — surfaced in the handoff, not hidden.
