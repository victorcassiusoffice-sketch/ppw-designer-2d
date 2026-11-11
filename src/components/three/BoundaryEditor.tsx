import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  add,
  detectFace,
  distance3,
  faceLoop,
  rayPlane,
  validPoint,
  type Point3,
  type WorkPlane,
} from '../../designer/boundaryModel';
import {
  buildingSnapIndex,
  changeComponents,
  commitLoop,
  componentOnRay,
} from '../../designer/componentEditing';
import { firstFaceOnRay, polylineLength, snapEntity } from '../../designer/entitySnapping';
import { usePropertyStore } from '../../store/propertyStore';
import './boundaryEditor.css';

export interface DrawingView {
  ray(x: number, y: number): { origin: Point3; direction: Point3 } | null;
  project(p: Point3): { x: number; y: number } | null;
  element(): HTMLElement | null;
}
interface Props {
  view: DrawingView;
  onClose: () => void;
  initialId?: string;
}
const zero = { x: 0, y: 0, z: 0 };
const axes = ['x', 'y', 'z'] as const;
export default function BoundaryEditor({ view, onClose, initialId = '' }: Props) {
  const property = usePropertyStore((s) => s.property),
    components = property.boundaryComponents ?? [];
  const [id, setId] = useState(initialId),
    selected = components.find((c) => c.id === id);
  const [name, setName] = useState(selected?.name ?? 'Component');
  const [points, setPoints] = useState<Point3[]>([]),
    [plane, setPlane] = useState<WorkPlane>('XY');
  const [offset, setOffset] = useState('0'),
    [coords, setCoords] = useState(['0', '0', '0']);
  const [vertex, setVertex] = useState(0),
    [editing, setEditing] = useState<'draw' | 'vertex' | 'move' | 'pick'>(
      initialId ? 'pick' : 'draw',
    );
  const [hover, setHover] = useState<{ point: Point3; kind: string } | null>(null),
    [message, setMessage] = useState('');
  const [faceSnapping, setFaceSnapping] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const index = useMemo(() => buildingSnapIndex(property, points), [property, points]);
  const latest = useRef({
    view,
    onClose,
    place: (_x: number, _y: number, _tap: boolean) => {},
    finish: () => {},
  });
  function select(id: string) {
    const part = components.find((c) => c.id === id);
    setId(id);
    setName(part?.name ?? 'Component');
    setVertex(0);
    setHover(null);
    setPoints([]);
    setMessage('');
    setEditing(part ? 'pick' : 'draw');
  }
  function finish(loop: Point3[] = points, close = false) {
    if (!loop.length) {
      if (close) onClose();
      return;
    }
    try {
      if (close && loop.length === 1) {
        onClose();
        return;
      }
      const next = commitLoop(loop, id, name, !close);
      setPoints([]);
      setHover(null);
      setId(next);
      setMessage('Face added');
      if (close) onClose();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function append(p: Point3) {
    if (!validPoint(p)) {
      setMessage('Enter finite XYZ coordinates in metres.');
      return;
    }
    if (points.length >= 3 && distance3(p, points[0]) < 0.0001) {
      finish();
      return;
    }
    if (points.some((q) => distance3(q, p) < 0.0001)) {
      setMessage('Choose a different vertex.');
      return;
    }
    setPoints([...points, p]);
    setMessage('');
    setCoords(axes.map((k) => String(Number(p[k].toFixed(4)))));
  }
  function applyPoint(p: Point3) {
    if (editing === 'draw') {
      append(p);
      return;
    }
    if (!selected || !validPoint(p)) return;
    try {
      changeComponents(
        editing === 'vertex' ? 'Move component vertex' : 'Move component',
        (current) =>
          current.map((c) => {
            if (c.id !== id) return c;
            if (editing === 'vertex')
              return { ...c, vertices: c.vertices.map((v, i) => (i === vertex ? p : v)) };
            const base = c.vertices[0],
              delta = { x: p.x - base.x, y: p.y - base.y, z: p.z - base.z };
            return { ...c, vertices: c.vertices.map((v) => add(v, delta)) };
          }),
      );
      setMessage('Component updated');
      setEditing('pick');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  latest.current = {
    view,
    onClose,
    finish: () => finish(points, true),
    place(x, y, tap) {
      const ray = view.ray(x, y);
      if (!ray) return;
      if (editing === 'pick') {
        if (tap) {
          const hit = componentOnRay(components, ray.origin, ray.direction);
          if (hit) select(hit.id);
        }
        return;
      }
      const axis = plane === 'XY' ? 'z' : plane === 'XZ' ? 'y' : 'x',
        height = Number(offset);
      if (!Number.isFinite(height)) return;
      const normal = { ...zero, [axis]: 1 },
        origin = { ...zero, [axis]: height };
      const p =
        (faceSnapping ? firstFaceOnRay(ray.origin, ray.direction, index) : null) ??
        rayPlane(ray.origin, ray.direction, origin, normal);
      if (!p) {
        if (tap) setMessage('The camera is parallel to this plane. Change the plane or enter XYZ.');
        return;
      }
      const snap = snapEntity(p, index, 0.18),
        point = snap?.point ?? p;
      setHover({ point, kind: snap?.kind ?? plane });
      if (tap) applyPoint(point);
    },
  };
  useEffect(() => {
    const el = latest.current.view.element();
    if (!el) return;
    let pointer: { id: number; x: number; y: number } | null = null;
    const ui = (e: Event) =>
      (e.target as Element)?.closest(
        'button, input, select, label, [role="dialog"], .boundary-panel, .world-walk-toolbar, .world-walk-stick, .world-look-stick',
      );
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || ui(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (ui(e)) return;
      e.stopImmediatePropagation();
      latest.current.place(e.clientX, e.clientY, false);
    };
    const up = (e: PointerEvent) => {
      if (pointer?.id !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (Math.hypot(pointer.x - e.clientX, pointer.y - e.clientY) < 12)
        latest.current.place(e.clientX, e.clientY, true);
      pointer = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const cancel = () => {
      pointer = null;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        latest.current.finish();
      }
    };
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', key, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', key, true);
    };
  }, []);
  const overlay = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      const projected = points.map((p) => latest.current.view.project(p));
      const h = hover && latest.current.view.project(hover.point);
      const svg = overlay.current;
      const line = svg?.querySelector('polyline');
      line?.setAttribute(
        'points',
        [...projected, h]
          .filter((p) => !!p)
          .map((p) => p!.x + ',' + p!.y)
          .join(' '),
      );
      const marker = svg?.querySelector('circle');
      marker?.setAttribute('visibility', h ? 'visible' : 'hidden');
      if (h) {
        marker?.setAttribute('cx', String(h.x));
        marker?.setAttribute('cy', String(h.y));
      }
      raf = requestAnimationFrame(paint);
    };
    if (points.length || hover) raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [points, hover]);
  const entered = { x: Number(coords[0]), y: Number(coords[1]), z: Number(coords[2]) };
  function mode(next: typeof editing) {
    setEditing(next);
    setPoints([]);
    setMessage('');
    const p = selected?.vertices[next === 'vertex' ? vertex : 0] ?? zero;
    setCoords(axes.map((k) => String(p[k])));
  }
  return createPortal(
    <>
      <svg ref={overlay} className="boundary-ink" aria-hidden="true">
        <polyline fill="none" stroke="currentColor" strokeWidth="2" />
        <circle r="5" fill="currentColor" visibility="hidden" />
      </svg>
      <section
        className="boundary-panel"
        aria-label="Measured component editor"
        data-testid="boundary-editor"
      >
        <header>
          <strong>Measured components</strong>
          <button
            type="button"
            aria-label="Close component editor"
            onClick={() => finish(points, true)}
          >
            ×
          </button>
        </header>
        <label>
          Component
          <select value={id} onChange={(e) => select(e.target.value)}>
            <option value="">New component</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="boundary-actions">
            <button onClick={() => mode('draw')}>Add face</button>
            <button onClick={() => mode('vertex')}>Edit vertex</button>
            <button onClick={() => mode('move')}>Move</button>
            <button
              onClick={() => {
                changeComponents('Remove component', (all) => all.filter((c) => c.id !== id));
                select('');
              }}
            >
              Remove
            </button>
          </div>
        )}
        {editing !== 'pick' && (
          <>
            <label className="boundary-snap">
              <input
                type="checkbox"
                checked={faceSnapping}
                onChange={(e) => setFaceSnapping(e.target.checked)}
              />{' '}
              Snap to faces
            </label>
            <div className="boundary-plane">
              <label>
                Plane
                <select value={plane} onChange={(e) => setPlane(e.target.value as WorkPlane)}>
                  {['XY', 'XZ', 'YZ'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Offset (m)
                <input
                  type="number"
                  step="any"
                  value={offset}
                  onChange={(e) => setOffset(e.target.value)}
                />
              </label>
            </div>
            {editing === 'vertex' && selected && (
              <label>
                Vertex
                <select
                  value={vertex}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setVertex(i);
                    setCoords(axes.map((k) => String(selected.vertices[i][k])));
                  }}
                >
                  {selected.vertices.map((v, i) => (
                    <option key={i} value={i}>
                      {i + 1} · {axes.map((k) => v[k].toFixed(2)).join(', ')}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
              XYZ coordinates
            </button>
            {expanded && (
              <>
                <label>
                  Name
                  <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="boundary-xyz">
                  {axes.map((axis, i) => (
                    <label key={axis}>
                      {axis.toUpperCase()} (m)
                      <input
                        aria-label={axis.toUpperCase() + ' metres'}
                        type="number"
                        step="any"
                        value={coords[i]}
                        onChange={(e) =>
                          setCoords(coords.map((v, j) => (i === j ? e.target.value : v)))
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  disabled={coords.some((c) => c.trim() === '') || !validPoint(entered)}
                  onClick={() => applyPoint(entered)}
                >
                  {editing === 'draw' ? 'Add vertex' : 'Apply coordinates'}
                </button>
              </>
            )}
            {editing === 'draw' && (
              <div className="boundary-actions">
                <button disabled={points.length < 3} onClick={() => finish()}>
                  Close loop
                </button>
                {points.length > 0 && (
                  <button onClick={() => setPoints(points.slice(0, -1))}>Undo point</button>
                )}
              </div>
            )}
          </>
        )}
        <output aria-live="polite">
          {message ||
            (editing === 'pick' && selected
              ? selected.faces.length +
                ' faces · ' +
                selected.faces
                  .reduce((s, refs) => s + detectFace(faceLoop(selected, refs)).area, 0)
                  .toFixed(3) +
                ' m²'
              : editing === 'move'
                ? 'Place the first vertex at the new position'
                : editing === 'vertex'
                  ? 'Choose the new vertex position'
                  : points.length +
                    ' vertices · ' +
                    polylineLength(points).toFixed(3) +
                    ' m' +
                    (hover ? ' · ' + hover.kind : ''))}
        </output>
      </section>
    </>,
    view.element()?.closest<HTMLElement>('[aria-modal="true"]') ?? document.body,
  );
}
