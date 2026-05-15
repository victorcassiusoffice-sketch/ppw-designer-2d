/**
 * useKeyboardShortcuts — global keys for placed-item manipulation.
 *   R                rotate 90° CW
 *   Shift+R          rotate 90° CCW
 *   D                duplicate
 *   Ctrl/Cmd+D       duplicate (OMS Wave 2.3 — override the browser
 *                    bookmark default)
 *   Delete/Bksp      delete
 *   Esc              deselect
 *
 * Ignored when the user is typing in an input/textarea/contenteditable
 * (so the room-dim inputs and search box still work normally).
 */
import { useEffect } from 'react';
import {
  rotateSelected,
  duplicateSelected,
  deleteSelected,
  deselect,
} from './placementActions';
import { useDesignStore } from '../store/designStore';

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
