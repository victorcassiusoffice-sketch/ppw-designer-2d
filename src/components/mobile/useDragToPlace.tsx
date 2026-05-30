/**
 * useDragToPlace — pointer-driven "pick up a product and drop it on the
 * floor" gesture for the mobile Sims toolbar (Phase 4.1) and the product
 * popup (Phase 3.2).
 *
 * Two trigger modes:
 *   • 'longpress' (toolbar thumbnail): a >300 ms hold enters drag mode so
 *     a quick horizontal swipe still scrolls the thumbnail strip and a
 *     quick tap opens the popup (`onTap`). Moving the finger before the
 *     hold fires cancels the drag (treated as a scroll).
 *   • 'immediate' (popup image): drag starts as soon as the finger moves
 *     past a small threshold; `touch-action: none` should be set on the
 *     element so the browser doesn't fight the gesture.
 *
 * On release after a real drag, `onDrop(productId, clientX, clientY)` is
 * called with the release point — the caller publishes a placement intent
 * (see placementIntentStore) and RoomCanvas runs the validated placement.
 *
 * The drag ghost is a fixed-position element following the pointer; the
 * caller renders `{ghost}` once anywhere in its tree.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const MOVE_THRESHOLD_PX = 8;
const DEFAULT_LONGPRESS_MS = 300;
/**
 * Anti-occlusion lift (PARITY-MATRIX M2, mobile spec §3.2 / §9 — "render
 * the object offset above the fingertip ... the single most important touch
 * detail", non-negotiable). The dragged ghost is rendered this many px
 * ABOVE the touch point, and — critically — the placement drop point is
 * reported at the same lifted position, so what the user sees is where the
 * item lands (the finger never hides the object or its target cell).
 */
export const DRAG_LIFT_PX = 56;

interface DragState {
  productId: string;
  imgUrl: string;
  x: number;
  y: number;
}

interface ActivePointer {
  productId: string;
  imgUrl: string;
  startX: number;
  startY: number;
  pointerId: number;
  timer: ReturnType<typeof setTimeout> | null;
  armed: boolean; // long-press fired (longpress mode) or always true (immediate)
  dragging: boolean;
  el: HTMLElement;
}

export interface UseDragToPlaceOptions {
  mode?: 'longpress' | 'immediate';
  longPressMs?: number;
  onDrop: (productId: string, clientX: number, clientY: number) => void;
  onTap?: (productId: string) => void;
}

export function useDragToPlace(opts: UseDragToPlaceOptions) {
  const { mode = 'longpress', longPressMs = DEFAULT_LONGPRESS_MS, onDrop, onTap } = opts;
  const [drag, setDrag] = useState<DragState | null>(null);
  const ptr = useRef<ActivePointer | null>(null);
  // Keep the latest callbacks without re-binding the window listeners.
  const cbs = useRef({ onDrop, onTap });
  cbs.current = { onDrop, onTap };

  const endPointer = useCallback(() => {
    const p = ptr.current;
    if (p?.timer) clearTimeout(p.timer);
    ptr.current = null;
    setDrag(null);
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const p = ptr.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      const moved = Math.hypot(dx, dy);

      if (!p.dragging) {
        if (mode === 'longpress' && !p.armed) {
          // Finger moved before the hold fired → user is scrolling the
          // strip, not picking up. Cancel this gesture entirely.
          if (moved > MOVE_THRESHOLD_PX) {
            if (p.timer) clearTimeout(p.timer);
            ptr.current = null;
          }
          return;
        }
        // immediate mode (or longpress already armed): a real move starts drag.
        if (moved > MOVE_THRESHOLD_PX) {
          p.dragging = true;
          try {
            p.el.setPointerCapture(p.pointerId);
          } catch {
            /* no-op */
          }
          setDrag({ productId: p.productId, imgUrl: p.imgUrl, x: e.clientX, y: e.clientY });
        }
        return;
      }
      // Dragging: follow the finger, suppress scroll/zoom.
      e.preventDefault();
      setDrag({ productId: p.productId, imgUrl: p.imgUrl, x: e.clientX, y: e.clientY });
    }

    function onUp(e: PointerEvent) {
      const p = ptr.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.timer) clearTimeout(p.timer);
      if (p.dragging) {
        // Drop at the LIFTED point (matches the rendered ghost centre).
        cbs.current.onDrop(p.productId, e.clientX, e.clientY - DRAG_LIFT_PX);
      } else if (!p.armed && mode === 'longpress') {
        // Released before the hold fired and without scrolling → a tap.
        cbs.current.onTap?.(p.productId);
      }
      ptr.current = null;
      setDrag(null);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [mode]);

  const start = useCallback(
    (e: React.PointerEvent, productId: string, imgUrl: string) => {
      if (e.button !== undefined && e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const p: ActivePointer = {
        productId,
        imgUrl,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        timer: null,
        armed: mode === 'immediate',
        dragging: false,
        el,
      };
      if (mode === 'longpress') {
        p.timer = setTimeout(() => {
          if (ptr.current === p) {
            p.armed = true;
            p.dragging = true;
            try {
              el.setPointerCapture(p.pointerId);
            } catch {
              /* no-op */
            }
            setDrag({ productId, imgUrl, x: p.startX, y: p.startY });
          }
        }, longPressMs);
      }
      ptr.current = p;
    },
    [mode, longPressMs],
  );

  const ghost = drag ? (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: drag.x,
        // M2 anti-occlusion — render the ghost lifted above the fingertip
        // (centre sits at the reported drop point), so the finger never
        // covers the object or its target cell.
        top: drag.y - DRAG_LIFT_PX,
        width: 72,
        height: 72,
        marginLeft: -36,
        marginTop: -36,
        // Above the Gaming Layer floating toolbars + the popup overlay.
        zIndex: 1100,
        pointerEvents: 'none',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(14,14,16,0.45)',
        border: '2px solid #FFBB58',
        background: '#fff',
        opacity: 0.92,
        transform: 'scale(1.05)',
      }}
    >
      <img
        src={drag.imgUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
      />
    </div>
  ) : null;

  return { start, dragging: !!drag, ghost, cancel: endPointer };
}
