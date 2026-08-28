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
 * It proves the B1 fix at runtime by traversing the Konva node tree directly
 * (coordinate-independent) to confirm the always-listening transparent
 * `placed-hit` Rect is present + listening on the placed item, then fires its
 * Konva click to attempt re-selection.
 */
import Konva from 'konva';
import { useDesignStore } from '../store/designStore';

interface DesignerTestState {
  selectedId: string | null;
  selectedInstanceId: string | null;
  placedItems: ReturnType<typeof useDesignStore.getState>['placedItems'];
  itemCount: number;
}

interface HitReselectResult {
  hitFound: boolean;
  listening?: boolean;
  selected?: boolean;
  noStage?: boolean;
  stages?: number;
  via?: string;
}

export interface DesignerTestApi {
  getState: () => DesignerTestState;
  selectItem: (id: string | null) => void;
  hitReselect: () => HitReselectResult;
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
    hitReselect(): HitReselectResult {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stage: any = (Konva.stages && Konva.stages[0]) || null;
      if (!stage) return { hitFound: false, noStage: true, stages: 0 };
      const stages = Konva.stages.length;

      // Coordinate-independent: walk the Konva tree for the always-listening
      // placed-hit Rect (the B1 fix). No hit-canvas / pointer dependency.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hit: any = null;
      let via = 'placed-hit';
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rects = Array.from((stage.find('Rect') as any) || []);
        hit =
          rects.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) => typeof r.getAttr === 'function' && r.getAttr('data-testid') === 'placed-hit',
          ) || null;
      } catch {
        /* find unsupported */
      }
      if (!hit) {
        // Fallback: a placed item is a draggable Group (room/floor are not).
        via = 'draggable-group';
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const groups = Array.from((stage.find('Group') as any) || []).filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (g: any) => typeof g.draggable === 'function' && g.draggable(),
          );
          if (groups.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g: any = groups[0];
            const kids = typeof g.getChildren === 'function' ? g.getChildren() : [];
            hit = kids && kids.length ? kids[0] : g;
          }
        } catch {
          /* find unsupported */
        }
      }
      if (!hit) return { hitFound: false, stages, via: 'none' };

      const listening = typeof hit.listening === 'function' ? hit.listening() : undefined;
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
      fireAll(hit);
      if (typeof hit.getParent === 'function') fireAll(hit.getParent());
      // The synthetic mousedown/touchstart above trips Konva's OWN
      // `mousedown.konva` drag listener on the draggable placed Group, which
      // registers the node in DragAndDrop._dragElements. The mouseup/touchend
      // fired on the NODE cannot clear that - Konva ends a drag from a
      // DOCUMENT-level pointerup. Left armed, the next real pointer movement
      // (Playwright travelling to the rotate button) DRAGS the item and
      // swallows the click. Disarm so hitReselect has no side effect.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dd: any = (Konva as any).DD;
        if (dd?._dragElements) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dd._dragElements.forEach((el: any) => {
            try {
              el.node?.stopDrag();
            } catch {
              /* already stopped */
            }
          });
          dd._dragElements.clear();
        }
      } catch {
        /* Konva internals moved - the reselect result is still valid */
      }
      const sel = useDesignStore.getState().selectedInstanceId;
      return { hitFound: true, listening, selected: !!sel, stages, via };
    },
  };
  (window as unknown as { __designer?: DesignerTestApi }).__designer = api;
}
