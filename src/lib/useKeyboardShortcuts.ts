/**
 * useKeyboardShortcuts — global keys for placed-item manipulation.
 *   R                rotate 90° CW (Sims build-mode parity)
 *   Shift+R          rotate 15° CW (Tweak 01 — fine step on the 15° snap)
 *   Alt+R            rotate 90° CCW (mirror of R)
 *   D                duplicate
 *   Ctrl/Cmd+D       duplicate (OMS Wave 2.3 — override the browser
 *                    bookmark default)
 *   Delete/Bksp      delete
 *   Esc              deselect
 *   Ctrl/Cmd+Z       undo last action (Tweak 07 — Phase A.0)
 *   Ctrl/Cmd+Shift+Z redo (Tweak 07 — Phase A.0)
 *
 * Ignored when the user is typing in an input/textarea/contenteditable
 * (so the room-dim inputs and search box still work normally, AND so
 * the browser's native text-undo keeps working inside inputs).
 */
import { useEffect } from 'react';
import {
  rotateSelected,
  duplicateSelected,
  deleteSelected,
  deselect,
  ROTATION_STEP_COARSE_DEG,
  ROTATION_STEP_FINE_DEG,
} from './placementActions';
import { useDesignStore } from '../store/designStore';
import { isDrawTransactionActive } from '../store/historyStore';
import { useDesignerUIStore, SNAP_UNIT_ORDER } from '../store/designerUIStore';
import { performUndo, performRedo } from './undoIntent';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const hasSelection = !!useDesignStore.getState().selectedInstanceId;
      // Attached multi-room (2026-08-26) — while a draw transaction is open,
      // BOTH history and item mutations are inert here.
      //
      // Undo/redo: mid-draw Ctrl+Z with zero vertices would pop the
      // transaction's own suppressed entry frame out from under it.
      // (RoomDrawMode's own Ctrl+Z interceptor already handles the
      // vertices-remaining case and deliberately yields when there are none
      // — which is exactly how the POST-commit Ctrl+Z still reaches this
      // handler and pops the one committed frame.)
      //
      // Item mutations (R, <, >, D, Delete, Backspace): recording is
      // suppressed inside the transaction, so anything they changed would be
      // permanent and un-undoable under the new abort semantics.
      const inDraw = isDrawTransactionActive();

      // Tweak 07 (Phase A.0) — undo / redo. Checked BEFORE the per-key
      // switch so Ctrl/Cmd+Z always wins regardless of key case, and so
      // browser tab-undo / form-undo doesn't intercept them outside of
      // typing targets (handled above).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        // Same ladder the TopBar button uses. RoomDrawMode's own interceptor
        // handles the vertex case first and only yields when there are no
        // vertices, so this cannot double-pop.
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
        return;
      }
      // Door tool (2026-08-28) — F flips which side the next opening swings
      // toward, H swaps the hinge end. Only while the tool is live, so these
      // letters stay free for everything else.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const ui = useDesignerUIStore.getState();
        if (ui.tool === 'door') {
          if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            ui.toggleDoorFacing();
            return;
          }
          if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            ui.toggleDoorHand();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            ui.setTool('hand');
            return;
          }
        }
      }

      // D18 — Ctrl/Cmd+Y is the conventional Windows redo alias (spec lists
      // Ctrl+Y for redo alongside Ctrl+Shift+Z above).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        performRedo();
        return;
      }
      // D15 / M13 — Ctrl/Cmd+F toggles full-tile (0.5 m) ↔ quarter-tile
      // (0.25 m) snap. preventDefault stops the browser find-in-page.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        useDesignerUIStore.getState().togglePrecision();
        return;
      }

      // D2 (units 2026-08-28) - bare digits 1-6 select a snap unit directly
      // from SNAP_UNIT_ORDER (1 cm to 10 m). Guarded against every modifier so
      // Ctrl+1 etc. stay with the browser. isTypingTarget above has already
      // early-returned for INPUT/TEXTAREA/SELECT/contenteditable, so typing a
      // length into the new fields never hijacks the unit.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '6') {
        const unit = SNAP_UNIT_ORDER[Number(e.key) - 1];
        if (unit) {
          e.preventDefault();
          useDesignerUIStore.getState().setPrecision(unit);
        }
        return;
      }

      switch (e.key) {
        case 'r':
        case 'R': {
          if (inDraw || !hasSelection) return;
          e.preventDefault();
          // Tweak 01 (Phase B): R = 90° CW, Shift+R = 15° CW (fine
          // step matching the brief's 15° snap default), Alt+R = 90°
          // CCW. The legacy Shift+R as -90° is retired — the global
          // historyStore.undo() is the inverse, and the Konva
          // Transformer rotate-handle drag (RoomCanvas follow-up)
          // takes free-rotate gestures.
          if (e.altKey) {
            rotateSelected(-ROTATION_STEP_COARSE_DEG);
          } else if (e.shiftKey) {
            rotateSelected(ROTATION_STEP_FINE_DEG);
          } else {
            rotateSelected(ROTATION_STEP_COARSE_DEG);
          }
          break;
        }
        // F2 — `<` / `>` rotate ∓90° detents (Sims build-mode keys). On a
        // US layout these are Shift+, and Shift+. — match either the
        // shifted glyph or the bare comma/period so it works regardless.
        case '<':
        case ',': {
          if (inDraw || !hasSelection) return;
          e.preventDefault();
          rotateSelected(-ROTATION_STEP_COARSE_DEG);
          break;
        }
        case '>':
        case '.': {
          if (inDraw || !hasSelection) return;
          e.preventDefault();
          rotateSelected(ROTATION_STEP_COARSE_DEG);
          break;
        }
        case 'd':
        case 'D':
          if (inDraw || !hasSelection) return;
          // OMS Wave 2.3 — Ctrl/Cmd+D should override the browser's
          // bookmark shortcut. Bare D also works (back-compat).
          e.preventDefault();
          duplicateSelected();
          break;
        case 'Delete':
        case 'Backspace':
          if (inDraw || !hasSelection) return;
          e.preventDefault();
          deleteSelected();
          break;
        // D14 — Hand tool (H): the default select/move tool. Also cancels
        // any armed sledgehammer/eyedropper mode.
        case 'h':
        case 'H':
          e.preventDefault();
          useDesignerUIStore.getState().setTool('hand');
          break;
        // D11 / M11 — Eyedropper (E): next click on a placed item loads its
        // product type onto the placement ghost (copy-a-type).
        case 'e':
        case 'E':
          e.preventDefault();
          useDesignerUIStore.getState().setTool('eyedropper');
          break;
        // D12 — Sledgehammer (J): click placed items to delete them (stays
        // armed for repeat demolition).
        case 'j':
        case 'J':
          e.preventDefault();
          useDesignerUIStore.getState().setTool('sledgehammer');
          break;
        case 'Escape':
          e.preventDefault();
          // Esc also drops back to the Hand tool (cancels sledgehammer/
          // eyedropper) in addition to deselecting.
          useDesignerUIStore.getState().setTool('hand');
          deselect();
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
