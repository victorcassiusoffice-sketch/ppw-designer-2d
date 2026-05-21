/**
 * useKeyboardShortcuts — global keys for placed-item manipulation.
 *   R                rotate 90° CW
 *   Shift+R          rotate 90° CCW
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
} from './placementActions';
import { useDesignStore } from '../store/designStore';
import { useHistoryStore } from '../store/historyStore';

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

      // Tweak 07 (Phase A.0) — undo / redo. Checked BEFORE the per-key
      // switch so Ctrl/Cmd+Z always wins regardless of key case, and so
      // browser tab-undo / form-undo doesn't intercept them outside of
      // typing targets (handled above).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          useHistoryStore.getState().redo();
        } else {
          useHistoryStore.getState().undo();
        }
        return;
      }

      switch (e.key) {
        case 'r':
        case 'R':
          if (!hasSelection) return;
          e.preventDefault();
          rotateSelected(e.shiftKey ? -90 : 90);
          break;
        case 'd':
        case 'D':
          if (!hasSelection) return;
          // OMS Wave 2.3 — Ctrl/Cmd+D should override the browser's
          // bookmark shortcut. Bare D also works (back-compat).
          e.preventDefault();
          duplicateSelected();
          break;
        case 'Delete':
        case 'Backspace':
          if (!hasSelection) return;
          e.preventDefault();
          deleteSelected();
          break;
        case 'Escape':
          e.preventDefault();
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
