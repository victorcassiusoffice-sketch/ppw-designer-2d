# 2D House Designer — Desktop Interaction Spec

**Platform:** Desktop (Windows / macOS), mouse + keyboard
**Model:** Sims 2 Build/Buy mode, adapted to 2D top-down

---

## 1. Core principle

Everything happens inline on one canvas. No modal windows. Selecting a catalog item attaches a translucent **ghost preview** to the cursor; the user drops it on the grid. Selecting a placed object reveals its controls in place. The "feels good" factor is: cursor-ghost preview + repeat-place + instant rotation, with zero screen changes.

---

## 2. Screen layout

| Region | Contents |
|---|---|
| Left / bottom dock | Catalog panel — icon thumbnails, persistent, never modal |
| Top bar | Category tabs (function / room / category), search, funds/cost readout |
| Top-right | Undo, redo, grid-snap toggle, settings |
| Left toolbar | Hand, Eyedropper, Delete (sledgehammer), Recolor (design) |
| Canvas | The lot — grid, walls, placed objects |

Catalog is filterable and scrollable. Items the user can't afford render tinted/disabled.

---

## 3. The placement loop

1. **Click a catalog icon** → translucent ghost attaches to cursor. Enters *placing* state. No window opens.
2. **Move mouse** → ghost follows, snapping to grid. Valid = normal tint; invalid (overlap / blocked / unaffordable) = red tint, drop disabled.
3. **Left-click** → drops object, deducts cost, exits placing.
4. **Shift + left-click** → drops object **and keeps the ghost on the cursor** to place again (rapid duplicate / stamp). This is the core duplication mechanic.
5. **Esc** or right-click-away → cancels placing, discards ghost, no charge.

---

## 4. Feature → control map

| Feature | Desktop control |
|---|---|
| Pick item from catalog | Left-click thumbnail |
| Position | Move mouse (ghost snaps to grid) |
| Place | Left-click |
| Place repeatedly (duplicate) | **Shift + left-click** |
| Rotate (4-way snap) | **Right-click + drag**, or `<` / `>` keys |
| Free-angle rotate (optional) | `Alt` held while rotating |
| Cancel placement | `Esc` / right-click empty space |
| Select placed object | Left-click it (Hand tool) |
| Move placed object | Click + drag (re-enters snap flow) |
| Copy an existing object's type | **Eyedropper (E)** → click object → its type loads on cursor |
| Delete | Select + `Delete`, or Sledgehammer tool (J) |
| Recolor / restyle | Design tool (R) → click object → pick swatch |
| Hand tool (default) | `H` |
| Grid snap resolution | `Ctrl+F` toggles full-tile / quarter-tile |
| Move object along wall / z-layer | `[` / `]` |
| Shuffle object between surface slots | `M` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Zoom | Scroll wheel, or `+` / `-` |
| Pan camera | Right-drag, edge-scroll, or `W A S D` / arrows |

---

## 5. Interaction states

```
IDLE ──click catalog icon──▶ PLACING ──left-click──▶ IDLE
                               │  └─Shift+click──▶ PLACING (ghost persists)
                               └─Esc──────────────▶ IDLE

IDLE ──click placed object──▶ SELECTED ──drag──▶ MOVING ──drop──▶ SELECTED
                                 ├─< / >──────▶ rotates in place
                                 ├─Delete─────▶ IDLE (object removed)
                                 └─click empty▶ IDLE (deselect)
```

Hover state: cursor over a placed object highlights it (outline) to signal it's grabbable.

---

## 6. Snapping & feedback

- Objects snap to the tile grid; `Ctrl+F` halves resolution for fine placement.
- Valid drop = solid ghost + soft snap; invalid = red ghost, drop blocked.
- Rotation snaps to 90° detents (N/E/S/W) unless `Alt` (free angle) is held.
- Cost readout updates live as the ghost moves and on each place.

---

## 7. Edge cases

- **Overlap:** red ghost, left-click does nothing. Optional "move objects" override toggle to allow overlap.
- **Undo = full refund:** placed objects depreciate; only undo restores full value. Undo stack must restore exact prior transform + funds.
- **Out of funds:** thumbnail disabled in catalog; ghost red.
- **Multi-select (optional power feature):** drag a marquee on empty canvas to select several objects; move/rotate/delete as a group.
