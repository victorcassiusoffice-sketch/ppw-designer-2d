import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { usePropertyStore } from '../store/propertyStore';
import {
  beginDrawTransaction,
  endDrawTransaction,
  abortDrawTransaction,
  isDrawTransactionActive,
} from '../store/historyStore';
import { useOpeningSelectionStore } from '../store/openingSelectionStore';
import { useGardenEditorStore } from '../store/gardenEditorStore';
import { activeLevelIdOf, isRoofLevel } from '../designer/levels';
import {
  buildingLevels,
  roofConfigOf,
  stairFootprint,
  type BuildingStair,
} from '../designer/building';
import { roofNormalThickness } from '../designer/roofSurface';
import { validateStairPlacement } from '../designer/stairPlacement';
import {
  bendAt,
  bendShape,
  commitBend,
  removeSurface,
  sameSurfaceGroup,
  surfaceName,
  surfaceTargets,
  type Bend,
  type SurfaceTarget,
} from '../designer/surfaceActions';
import type { RemoveBuildTarget } from '../designer/removeBuildTarget';
import type { Vertex } from '../lib/geometry';
import './SurfaceActions.css';

function editHistory(label: string, work: () => void) {
  const own = !isDrawTransactionActive(),
    before = usePropertyStore.getState().property;
  if (own) beginDrawTransaction(label);
  try {
    work();
  } finally {
    if (own) {
      if (usePropertyStore.getState().property === before) abortDrawTransaction();
      else endDrawTransaction();
    }
  }
}
interface Props {
  host: RefObject<HTMLElement | null>;
  point: (x: number, y: number) => Vertex | null;
  project: (p: Vertex) => Vertex | null;
  hit?: (x: number, y: number) => RemoveBuildTarget | null;
  direct?: (x: number, y: number) => { target: SurfaceTarget; point: Vertex } | null;
  erase?: boolean;
  materials: (kind: 'floor' | 'wall') => void;
}
type Gesture =
  | { kind: 'stair'; stair: BuildingStair; existing: boolean }
  | { kind: 'bend'; edge: Bend };
type Menu = { at: Vertex; x: number; y: number; hits: SurfaceTarget[]; index: number };
export function SurfaceActions(props: Props) {
  const current = useRef(props);
  current.current = props;
  const [menu, setMenu] = useState<Menu | null>(null),
    [gesture, setGesture] = useState<Gesture | null>(null);
  const pending = useRef<Gesture | null>(null),
    picked = useRef<Vertex | null>(null),
    pointer = useRef<number | null>(null);
  const [preview, setPreview] = useState<{
    points: Vertex[];
    valid: boolean;
    label: string;
  } | null>(null);
  const [message, setMessage] = useState('');
  const property = usePropertyStore((s) => s.property);
  const selected = menu?.hits[menu.index],
    roof = roofConfigOf(property);
  const close = useCallback(() => {
    pending.current = null;
    pointer.current = null;
    picked.current = null;
    setGesture(null);
    setPreview(null);
    setMenu(null);
  }, []);
  const start = useCallback(
    (g: Gesture) => {
      close();
      pending.current = g;
      setGesture(g);
      setMessage('');
    },
    [close],
  );
  useEffect(() => {
    const element = current.current.host.current;
    if (!element) return;
    const host = element;
    let press: { id: number; x: number; y: number; touch: boolean } | null = null,
      timer = 0,
      suppress = 0;
    host.dataset.buildSurfaceRoot = 'true';
    const inside = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest('[data-build-surface-root]') === host;

    const drawing = (el: EventTarget | null) =>
      el instanceof Element &&
      host.contains(el) &&
      !!el.closest('canvas,[data-testid="wallpaint-3d-canvas"]');
    function hits(x: number, y: number) {
      const v = current.current,
        direct = v.direct?.(x, y),
        at = direct?.point ?? v.point(x, y);
      if (!at) return null;
      const p = usePropertyStore.getState().property;
      const list = surfaceTargets(p, activeLevelIdOf(p), at, 0.16, v.hit?.(x, y));
      const hits = direct
        ? [
            direct.target,
            ...list.filter(
              (h) =>
                !(
                  'id' in h &&
                  'id' in direct.target &&
                  h.kind === direct.target.kind &&
                  h.id === direct.target.id
                ),
            ),
          ]
        : list;
      return { at, hits };
    }
    function open(x: number, y: number) {
      const h = hits(x, y);
      if (!h?.hits.length) return;
      setMessage('');
      setMenu({ ...h, x, y, index: 0 });
      suppress = performance.now() + 400;
    }
    function show(g: Gesture, x: number, y: number) {
      const at = inside(x, y) ? current.current.point(x, y) : null;
      picked.current = at;
      if (!at) {
        setPreview(null);
        return;
      }
      let path: Vertex[], valid: boolean, label: string;
      if (g.kind === 'stair') {
        const stair = { ...g.stair, x: at.x, y: at.y },
          result = validateStairPlacement(usePropertyStore.getState().property, stair);
        path = stairFootprint(stair);
        path = [...path, path[0]];
        valid = result.ok;
        label = result.ok ? 'Release to place stairs' : result.message;
      } else {
        const shape = bendShape(g.edge, at);
        path = shape?.vertices ?? [];
        valid = !!shape;
        label = shape ? shape.lengthM.toFixed(3) + ' m along curve' : 'Adjust the bend';
      }
      setPreview({
        points: path.map((p) => current.current.project(p)).filter((q): q is Vertex => !!q),
        valid,
        label,
      });
    }
    function finish(g: Gesture) {
      const at = picked.current,
        store = usePropertyStore.getState();
      if (!at) {
        close();
        return;
      }
      let ok = false;
      editHistory(g.kind === 'stair' ? 'Place stairs' : 'Pull curve', () => {
        ok =
          g.kind === 'bend'
            ? commitBend(g.edge, at)
            : g.existing
              ? store.updateStair(g.stair.id, { x: at.x, y: at.y })
              : !!store.addStair({ ...g.stair, x: at.x, y: at.y });
      });
      setMessage(
        ok
          ? ''
          : g.kind === 'stair'
            ? 'Stairs need clear landings on both floors.'
            : 'Keep the outline clear and move any opening off the edge before bending it.',
      );
      close();
    }
    function down(e: PointerEvent) {
      const v = current.current,
        target = e.target;
      if (!(target instanceof Element)) return;
      const source = target.closest('[data-stair-source]:not(:disabled)');
      if (source && e.button === 0) {
        const activeHouse = document.querySelector('[data-testid="wallpaint-3d-overlay"]');
        if (activeHouse?.getClientRects().length && !activeHouse.contains(host)) return;
        // Only the visible viewport receiving this palette gesture owns it.
        if (
          !host.offsetWidth ||
          host.closest('[aria-hidden="true"]') ||
          !host.getClientRects().length
        )
          return;
        const p = usePropertyStore.getState().property,
          levels = buildingLevels(p).filter((l) => !isRoofLevel(l.level));
        const i = levels.findIndex((l) => l.level.id === activeLevelIdOf(p));
        if (i < 0 || levels.length < 2) return;
        const lower = levels[Math.min(i, levels.length - 2)],
          upper = levels[Math.min(i + 1, levels.length - 1)];
        start({
          kind: 'stair',
          existing: false,
          stair: {
            id: 'pending-stair',
            x: 0,
            y: 0,
            widthM: 1,
            rotation: 0,
            fromLevelId: lower.level.id,
            toLevelId: upper.level.id,
            runM: Math.max(3, (upper.elevationM - lower.elevationM) * 1.2),
          },
        });
        pointer.current = e.pointerId;
        return;
      }
      if (!drawing(target)) return;
      if (pending.current && e.button === 0) {
        pointer.current = e.pointerId;
        e.preventDefault();
        e.stopImmediatePropagation();
        show(pending.current, e.clientX, e.clientY);
        return;
      }
      if (e.button !== 0 && e.button !== 2) return;
      if (e.button === 0 && v.erase) {
        const h = hits(e.clientX, e.clientY),
          first = h?.hits.find((t) => t.kind !== 'room');
        if (first && 'id' in first) {
          e.preventDefault();
          e.stopImmediatePropagation();
          press = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: false };
          return;
        }
      }
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
      if (press.touch) {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (press) {
            open(press.x, press.y);
            press = null;
          }
        }, 540);
      }
    }
    function move(e: PointerEvent) {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 7) {
        clearTimeout(timer);
        press = null;
      }
      if (
        pending.current &&
        e.isPrimary &&
        (pointer.current === null || pointer.current === e.pointerId)
      ) {
        show(pending.current, e.clientX, e.clientY);
        e.stopImmediatePropagation();
      }
    }
    function up(e: PointerEvent) {
      clearTimeout(timer);
      const prev = press;
      press = null;
      if (pending.current && pointer.current === e.pointerId) {
        if (inside(e.clientX, e.clientY)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          suppress = performance.now() + 350;
          show(pending.current, e.clientX, e.clientY);
          finish(pending.current);
        } else close();
        return;
      }
      if (suppress > performance.now() && drawing(e.target) && e.button === 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (
        prev &&
        prev.id === e.pointerId &&
        current.current.erase &&
        e.button === 0 &&
        drawing(e.target)
      ) {
        const first = hits(e.clientX, e.clientY)?.hits.find((t) => t.kind !== 'room');
        if (first && 'id' in first) {
          e.preventDefault();
          e.stopImmediatePropagation();
          editHistory('Remove ' + surfaceName(first), () => {
            if (!removeSurface(first)) setMessage('Clear attached items first.');
          });
        }
      }
    }
    function context(e: MouseEvent) {
      if (!drawing(e.target)) return;
      e.preventDefault();
      if (pending.current) return;
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 7) return;
      open(e.clientX, e.clientY);
    }
    function key(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (pending.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (pending.current.kind === 'bend' && pointer.current !== null && picked.current)
          finish(pending.current);
        else close();
      }
    }
    function cancel() {
      clearTimeout(timer);
      press = null;
      close();
    }
    function click(e: MouseEvent) {
      if (
        suppress > performance.now() &&
        (drawing(e.target) ||
          (e.target instanceof Element && e.target.closest('[data-stair-source]')))
      ) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('contextmenu', context, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('click', click, true);
    window.addEventListener('blur', cancel);
    return () => {
      delete host.dataset.buildSurfaceRoot;
      clearTimeout(timer);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('contextmenu', context, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('click', click, true);
      window.removeEventListener('blur', cancel);
    };
  }, [close, start]);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMenu(null);
      }
    };
    window.addEventListener('keydown', dismiss, true);
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [menu]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  const edit = (f: () => void) => {
    f();
    close();
  };
  const remove = (all = false) => {
    if (!selected) return;
    const s = usePropertyStore.getState();
    editHistory(all ? 'Remove floor finishes' : 'Remove ' + surfaceName(selected), () => {
      if (all && selected.kind === 'floor') s.clearRoomFloor(selected.roomId);
      else if (!removeSurface(selected)) setMessage('Remove attached finishes and products first.');
    });
    close();
  };
  const group = selected ? sameSurfaceGroup(selected, property, activeLevelIdOf(property)) : null;
  const wall = selected?.kind === 'wall' ? selected.hit : null;
  const roomWall =
    wall?.kind === 'edge' ? property.rooms.find((r) => r.id === wall.roomId) : null;
  const freeWall =
    wall?.kind === 'free' ? property.walls?.find((w) => w.id === wall.wallId) : null;
  const hasPaint =
    roomWall?.wallPaint?.some((p) => p.edgeIndex === wall?.edgeIndex) ||
    freeWall?.paintId ||
    freeWall?.exteriorPaint;
  const hasCladding =
    roomWall?.wallCladding?.some((p) => p.edgeIndex === wall?.edgeIndex) ||
    freeWall?.claddingId;
  const edge = selected && menu ? bendAt(property, selected, menu.at) : null;
  const stair =
    selected?.kind === 'stair' ? property.stairs?.find((s) => s.id === selected.id) : null;
  return (
    <>
      {gesture && preview && (
        <svg className="build-action-preview" aria-hidden="true">
          <polyline
            points={preview.points.map((p) => p.x + ',' + p.y).join(' ')}
            fill={gesture.kind === 'stair' ? '#5ba17b44' : 'none'}
            stroke={preview.valid ? '#258564' : '#c7503c'}
            strokeWidth="4"
          />
        </svg>
      )}
      {(gesture || message) && (
        <div className="build-action-hint" role="status">
          {message ||
            preview?.label ||
            (gesture?.kind === 'stair' ? 'Drop stairs on the floor' : 'Drag to pull the curve')}
        </div>
      )}
      {menu &&
        selected &&
        createPortal(
          <>
            <div
              className="build-action-back"
              onPointerDown={close}
              onContextMenu={(e) => {
                e.preventDefault();
                close();
              }}
            />
            <section
              className="build-action-menu"
              role="dialog"
              aria-label="Build options"
              style={{
                left: Math.max(4, Math.min(menu.x, window.innerWidth - 228)),
                top: Math.max(4, Math.min(menu.y, window.innerHeight - 294)),
              }}
            >
              <header>
                <strong>{surfaceName(selected)}</strong>
                <button aria-label="Close build options" onClick={close}>
                  ×
                </button>
              </header>
              {menu.hits.length > 1 && (
                <select
                  aria-label="Element here"
                  value={menu.index}
                  onChange={(e) => setMenu({ ...menu, index: Number(e.target.value) })}
                >
                  {menu.hits.map((t, i) => (
                    <option key={i} value={i}>
                      {surfaceName(t)}
                    </option>
                  ))}
                </select>
              )}
              {selected.kind === 'opening' && (
                <button
                  onClick={() =>
                    edit(() => useOpeningSelectionStore.getState().select(selected.openingId))
                  }
                >
                  Edit opening
                </button>
              )}
              {selected.kind === 'item' && (
                <button
                  onClick={() =>
                    edit(() =>
                      usePropertyStore.getState().selectItemAcrossRooms(selected.instanceId),
                    )
                  }
                >
                  Select product to move or rotate
                </button>
              )}
              {(selected.kind === 'floor' || selected.kind === 'wall') && (
                <button
                  onClick={() =>
                    edit(() => props.materials(selected.kind === 'floor' ? 'floor' : 'wall'))
                  }
                >
                  {selected.kind === 'floor' ? 'Floor materials' : 'Wall finishes'}
                </button>
              )}
              {wall && (
                <button
                  onClick={() =>
                    edit(() => window.dispatchEvent(new Event('ppw:open-wall-materials')))
                  }
                >
                  Wall construction
                </button>
              )}
              {wall && hasPaint && (
                <button
                  onClick={() =>
                    edit(() => {
                      const s = usePropertyStore.getState();
                      if (roomWall)
                        s.paintWallEdge(roomWall.id, wall.edgeIndex!, null, null, wall.side);
                      else if (freeWall) s.paintFreeWall(freeWall.id, null, null, wall.side);
                    })
                  }
                >
                  Remove paint from this face
                </button>
              )}
              {wall && hasCladding && (
                <button
                  onClick={() =>
                    edit(() => {
                      const s = usePropertyStore.getState();
                      if (roomWall) s.setWallCladding(roomWall.id, wall.edgeIndex!, null);
                      else if (freeWall) s.setFreeWallCladding(freeWall.id, null);
                    })
                  }
                >
                  Remove cladding from this wall
                </button>
              )}
              {stair && (
                <>
                  <button onClick={() => start({ kind: 'stair', existing: true, stair })}>
                    Move stairs
                  </button>
                  <button
                    onClick={() =>
                      edit(() => {
                        if (
                          !usePropertyStore
                            .getState()
                            .updateStair(stair.id, { rotation: (stair.rotation + 90) % 360 })
                        )
                          setMessage('This rotation needs more landing space.');
                      })
                    }
                  >
                    Rotate stairs 90°
                  </button>
                </>
              )}
              {(selected.kind === 'run' || selected.kind === 'fixture') && (
                <button
                  onClick={() =>
                    edit(() =>
                      window.dispatchEvent(
                        new CustomEvent('ppw:open-services', {
                          detail: {
                            system:
                              selected.kind === 'run'
                                ? property.services?.runs.find((r) => r.id === selected.id)?.system
                                : 'cold-water',
                          },
                        }),
                      ),
                    )
                  }
                >
                  Edit services
                </button>
              )}
              {(selected.kind === 'foundation' || selected.kind === 'bore') && (
                <button
                  onClick={() => edit(() => window.dispatchEvent(new Event('ppw:open-foundation')))}
                >
                  Edit foundation
                </button>
              )}
              {selected.kind === 'garden' && (
                <button
                  onClick={() =>
                    edit(() => {
                      const s = useGardenEditorStore.getState();
                      s.open();
                      s.select(selected.id);
                    })
                  }
                >
                  Edit landscape
                </button>
              )}
              {edge && <button onClick={() => start({ kind: 'bend', edge })}>Pull curve</button>}
              {selected.kind === 'roof' && (
                <>
                  <label>
                    Surface
                    <select
                      aria-label="Roof surface"
                      value={roof.material}
                      onChange={(e) =>
                        usePropertyStore.getState().setRoofConfig({
                          ...roof,
                          material: e.target.value as typeof roof.material,
                        })
                      }
                    >
                      {['felt', 'tile', 'metal', 'iron-sheet', 'concrete'].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Thickness (mm)
                    <input
                      type="number"
                      aria-label="Roof thickness (mm)"
                      min=".3"
                      max="2000"
                      step=".1"
                      key={roofNormalThickness(roof)}
                      defaultValue={+(roofNormalThickness(roof) * 1000).toFixed(3)}
                      onBlur={(e) => {
                        const mm = e.currentTarget.valueAsNumber;
                        if (mm >= 0.3 && mm <= 2000)
                          usePropertyStore
                            .getState()
                            .setRoofConfig({ ...roof, thicknessM: mm / 1000 });
                      }}
                    />
                  </label>
                </>
              )}
              <button onClick={() => remove()}>
                {selected.kind === 'floor' &&
                property.rooms.find((r) => r.id === selected.roomId)?.floorTiles?.length
                  ? 'Remove one tile'
                  : 'Remove ' + surfaceName(selected).toLowerCase()}
              </button>
              {selected.kind === 'floor' && (
                <button onClick={() => remove(true)}>Remove all flooring in this room</button>
              )}
              {selected.kind === 'roof' && (
                <button
                  onClick={() =>
                    edit(() =>
                      editHistory('Remove roof and its contents', () => {
                        usePropertyStore.getState().removeLevel('roof', true);
                      }),
                    )
                  }
                >
                  Remove roof and all roof contents
                </button>
              )}
              {group && group.targets.length > 1 && (
                <button
                  onClick={() => {
                    editHistory(group.label, () => {
                      for (const t of group.targets) removeSurface(t);
                    });
                    close();
                  }}
                >
                  {group.label} ({group.targets.length})
                </button>
              )}
            </section>
          </>,
          document.body,
        )}
    </>
  );
}
