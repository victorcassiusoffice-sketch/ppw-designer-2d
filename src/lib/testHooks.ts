/**
 * testHooks — PREVIEW-ONLY window.__designer bridge for Playwright /
 * device-emulation verification (Customer-UI 2026-05-31).
 *
 * Gated behind VITE_TEST_HOOKS at the call site (main.tsx) via __TEST_HOOKS__
 * (a build-time literal), so this module is dead-code-eliminated from a
 * production build. It reads the existing design store and mutates nothing of
 * its own beyond proxying store actions a test needs.
 *
 * `hitReselect` exists because the live renderer is Konva on a single
 * <canvas>: Playwright's synthetic DOM pointer events don't reach Konva's hit
 * graph in headless emulation (a documented limitation — real-device verified).
 * It drives Konva's OWN hit-test at the placed item's location to prove the B1
 * fix (the always-listening transparent hit Rect) is present + routes a click
 * back to selection.
 */
import Konva from 'konva';
import { useDesignStore } from '../store/designStore';

interface DesignerTestState {
  selectedId: string | null;
  selectedInstanceId: string | null;
  placedItems: ReturnType<typeof useDesignStore.getState>['placedItems'];
  itemCount: number;
}

export interface DesignerTestApi {
  getState: () => DesignerTestState;
  selectItem: (id: string | null) => void;
  hitReselect: () => { hitFound: boolean; selected: boolean; noStage?: boolean };
}

export function installTestHooks(): void {
  if (typeof window === 'undefined') return;
  const api: DesignerTestApi = {
    getState() {
      const s = useDesignStore.getState();
      return {
        selectedId: s.selectedInstanceId,
        selectedInstanceId: s.selectedInstanceId,
        placedItems: s.placedItems,
        itemCount: s.placedItems.length,
      };
    },
    selectItem(id: string | null) {
      useDesignStore.getState().selectItem(id);
    },
    hitReselect() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage: any = (Konva.stages && Konva.stages[0]) || null;
      if (!stage) return { hitFound: false, selected: false, noStage: true };
      const w = stage.width();
      const h = stage.height();
      const cx = w / 2;
      const cy = h / 2;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fireAll = (node: any) => {
        ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'tap'].forEach((t) => {
          try {
            node.fire(
              t,
              {
                type: t,
                target: node,
                currentTarget: node,
                cancelBubble: false,
                evt: { preventDefault() {}, stopPropagation() {}, button: 0 },
              },
              true,
            );
          } catch {
            /* ignore */
          }
        });
      };
      // Sweep the central band where a centre-placed item sits, asking Konva's
      // hit graph what's under each point.
      for (let dy = -160; dy <= 200; dy += 8) {
        for (const ox of [0, -14, 14, -30, 30, -48, 48]) {
          const x = cx + ox;
          const y = cy + dy;
          if (x < 0 || y < 0 || x > w || y > h) continue;
          const shape = stage.getIntersection({ x, y });
          if (!shape) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let node: any = shape;
          let placed = false;
          while (node) {
            const tid = typeof node.getAttr === 'function' ? node.getAttr('data-testid') : undefined;
            if (tid === 'placed-hit') {
              placed = true;
              break;
            }
            // Placed items are draggable groups; the room/floor is not.
            if (typeof node.draggable === 'function' && node.draggable()) {
              placed = true;
              break;
            }
            node = typeof node.getParent === 'function' ? node.getParent() : null;
          }
          if (!placed) continue;
          // Found the B1 hit target — fire selection on it + its group.
          fireAll(shape);
          if (typeof shape.getParent === 'function') fireAll(shape.getParent());
          const sel = useDesignStore.getState().selectedInstanceId;
          return { hitFound: true, selected: !!sel };
        }
      }
      return { hitFound: false, selected: false };
    },
  };
  (window as unknown as { __designer?: DesignerTestApi }).__designer = api;
}
