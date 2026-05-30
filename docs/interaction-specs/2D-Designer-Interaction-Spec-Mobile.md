# 2D House Designer — Mobile Interaction Spec (iOS + Android)

**Platform:** iPhone (iOS) and Android, touch-only
**Model:** Sims 2 Build/Buy mode, re-designed for touch (no hover, no right-click, no keyboard)

---

## 1. Core principle (unchanged from desktop)

Everything stays inline on one canvas. No modal screens. The difference: touch has **no hover and no cursor**, so the desktop "ghost-on-cursor" becomes **"spawn a selected object on the grid, then drag it with your finger."** A selected object always carries a small cluster of floating contextual buttons (rotate, duplicate, delete, style, confirm). That cluster replaces every keyboard shortcut and right-click.

---

## 2. Screen layout

| Region | Contents |
|---|---|
| Bottom drawer (sheet) | Catalog — horizontally swipeable rows of icon thumbnails. Swipe up to expand, down to dismiss. |
| Top tab row | Category filters (function / room / category) + search |
| Top bar | Funds/cost, Undo, Redo, grid-snap (precision) toggle |
| Floating cluster | Appears around the **currently selected object** only: ✓ confirm, ✗ cancel, ⟳ rotate, ⧉ duplicate, 🗑 delete, 🎨 style |
| Canvas | The lot — grid, walls, placed objects |

Keep the catalog as a non-blocking bottom sheet so the lot stays visible while browsing. Items the user can't afford render tinted/disabled.

---

## 3. The placement loop (touch)

1. **Tap a catalog thumbnail** → object spawns on the grid (center of view or last position) as a **selected ghost**, with the floating cluster around it. Catalog sheet auto-collapses so the lot is visible.
2. **Drag the object with one finger** → it follows, snapping to grid. Render the object **offset above the fingertip** (or show an elevated preview) so the finger never hides it — this is the single most important touch detail.
3. Valid position = normal tint; invalid = red tint.
4. **Tap ✓** (or tap empty canvas) → commits, deducts cost.
5. **Tap ⧉ (duplicate)** → commits the current one and spawns an identical selected ghost offset by one tile — the touch equivalent of Shift-click rapid placement.
6. **Tap ✗** (iOS) / **system Back gesture** (Android) → cancels, discards, no charge.

---

## 4. Gesture vocabulary

| Action | Gesture |
|---|---|
| Browse catalog | Swipe the bottom sheet up/down; swipe thumbnail rows left/right |
| Pick item | Tap thumbnail → spawns selected on grid |
| Position / move | One-finger drag **on the object** (offset above finger) |
| Pan camera | One-finger drag **on empty canvas** |
| Zoom | Two-finger pinch |
| Rotate camera (if used) | Two-finger twist on empty canvas |
| Place / confirm | Tap ✓ or tap empty canvas |
| Duplicate | Tap ⧉ in the cluster |
| Rotate object 90° | Tap ⟳ (repeat for each detent); **drag** the ⟳ handle in a circle for free angle |
| Rotate object (power user) | Two-finger twist **on the object** |
| Delete | Tap 🗑, or drag object onto a trash zone |
| Style / recolor | Tap 🎨 → swatch tray slides up (bottom sheet) |
| Select placed object | Tap it |
| Deselect | Tap empty canvas |
| Eyedropper (copy a type) | Toolbar eyedropper toggle → tap an existing object → its type spawns selected |
| Wall height / z-layer | ▲ / ▼ stepper in the cluster (wall items only) |
| Precision / fine placement | Toggle in top bar (full-tile ↔ quarter-tile) |
| Undo / Redo | Tap top-bar buttons (no keyboard) |

**Gesture disambiguation (critical):** one finger on a selected object = move it; one finger on empty canvas = pan. Selection state decides. If nothing is selected, one-finger drag always pans.

---

## 5. The floating cluster

Always anchored to the selected object, repositioning to stay on-screen (flips sides near edges, never under the finger). Buttons:

```
        [⟳ rotate]
[✗]  ( OBJECT )  [⧉ duplicate]
        [🗑] [🎨] [✓]
```

This one component carries every function that desktop assigns to right-click and keyboard. If the cluster is on screen, the user is in an editing/placing state; clearing selection hides it.

---

## 6. Interaction states

```
IDLE ──tap catalog icon──▶ PLACING(selected ghost + cluster)
                              ├─drag──────────▶ repositions, snaps
                              ├─tap ✓ / empty─▶ COMMITTED ▶ IDLE
                              ├─tap ⧉─────────▶ commit + new PLACING ghost
                              ├─tap ⟳─────────▶ rotate 90°
                              └─tap ✗ / Back──▶ discard ▶ IDLE

IDLE ──tap placed object──▶ SELECTED(cluster)
                              ├─drag──────────▶ MOVING ▶ SELECTED
                              ├─tap 🗑─────────▶ IDLE (removed)
                              ├─tap 🎨─────────▶ swatch tray
                              └─tap empty──────▶ IDLE (deselect)
```

---

## 7. Snapping & feedback

- Snap to tile grid; precision toggle halves resolution for fine placement.
- Valid = solid tint + light snap; invalid = red tint, ✓ disabled.
- **Haptics on every meaningful event:** snap to grid, place, rotate detent, duplicate, delete, invalid (error buzz). This sells the tactile, no-modal feel.
- Live cost readout updates as the object moves and on commit.

---

## 8. iOS vs Android differences

Gestures and layout are identical; the platform-specific items:

| Concern | iOS | Android |
|---|---|---|
| Cancel / back | On-screen ✗ only; swipe-down dismisses sheets | On-screen ✗ **plus** system Back gesture/button → maps to cancel placement / close tray |
| Haptics API | `UIFeedbackGenerator` (selection, impact, notification) | `VibrationEffect` / `HapticFeedbackConstants` |
| Bottom sheets | iOS sheet with grabber, detents | Material bottom sheet, same behavior |
| Safe areas | Notch / Dynamic Island top, home-indicator bottom — keep cluster & toolbar inside insets | Punch-hole / gesture-nav bar — same; avoid the back-gesture edge zones for draggable controls |
| Edge gestures | Avoid placing drag targets in the screen-edge swipe-back lane | Avoid the left/right Back-gesture edges and bottom nav pill |
| Long-press default | Standard iOS timing | Standard Android timing |

Design once; only wire cancel/back, haptics, and safe-area insets per platform.

---

## 9. Edge cases

- **Finger occlusion:** always offset the dragged object above the touch point or show an elevated preview bubble. Non-negotiable on touch.
- **Cluster near screen edge:** reposition/flip so all buttons stay tappable and clear of the finger.
- **Overlap:** red tint, ✓ disabled. Optional override toggle to allow overlap.
- **Undo = full refund:** placed items depreciate; only undo restores full value. Top-bar undo must restore exact prior transform + funds.
- **Accidental pan vs move:** enforce the selection-state rule (object selected → drag moves it; otherwise drag pans).
- **Small targets:** thumbnails and cluster buttons sized to ≥44pt (iOS) / ≥48dp (Android) minimum touch target.
