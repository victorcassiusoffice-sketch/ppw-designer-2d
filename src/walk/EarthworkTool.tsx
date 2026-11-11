import { useEffect, useRef, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import {
  beginDrawTransaction,
  endDrawTransaction,
  isDrawTransactionActive,
} from '../store/historyStore';
import { buildingLevels } from '../designer/building';
import { editSoil, cutId, cutPolygon } from '../designer/terrainCuts';
import { rayPlane } from '../designer/boundaryModel';
import { pointInPolygon } from '../lib/geometry';
import { roomLevelId } from '../designer/levels';
import { gardenElevationAt } from '../designer/garden';
import '../components/three/boundaryEditor.css';
import type { DrawingView } from '../components/three/BoundaryEditor';

export default function EarthworkTool({
  view,
  onClose,
}: {
  view: DrawingView;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'Dig' | 'Fill'>('Dig'),
    [step, setStep] = useState('0.25'),
    [message, setMessage] = useState('Tap the land or drag across cells.');
  const [coords, setCoords] = useState(['0', '0']),
    [precise, setPrecise] = useState(false);
  const ref = useRef({ view, mode, step });
  ref.current = { view, mode, step };
  const changes = useRef(false),
    visited = useRef(new Set<string>());
  function finish() {
    if (changes.current) {
      endDrawTransaction();
      changes.current = false;
    }
    visited.current.clear();
  }
  function apply(x: number, y: number) {
    const state = usePropertyStore.getState(),
      p = state.property,
      ground = buildingLevels(p)[0];
    if (!ground) return;
    const ix = Math.floor(x),
      iy = Math.floor(y),
      id = cutId(ix, iy);
    if (visited.current.has(id)) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const square = cutPolygon({ x: ix, y: iy });
    const site = p.site;
    if (
      site &&
      square.some(
        (q) =>
          q.x < site.originM.x ||
          q.x > site.originM.x + site.widthM ||
          q.y < site.originM.y ||
          q.y > site.originM.y + site.depthM,
      )
    ) {
      setMessage('Choose a cell inside the plot.');
      return;
    }
    if (!site && (Math.abs(ix) > 299 || Math.abs(iy) > 299)) {
      setMessage('Choose a cell on the land.');
      return;
    }
    const intersects = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
      d: { x: number; y: number },
    ) => {
      const cross = (u: typeof a, v: typeof a, w: typeof a) =>
        (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
      return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
    };
    const blocked = p.rooms.some(
      (room) =>
        roomLevelId(room) === ground.level.id &&
        room.kind !== 'outdoor' &&
        room.polygon.length >= 3 &&
        (square.some((q) =>
          pointInPolygon(
            { x: ix + 0.5 + (q.x - ix - 0.5) * 0.999, y: iy + 0.5 + (q.y - iy - 0.5) * 0.999 },
            room.polygon,
          ),
        ) ||
          room.polygon.some((q) => q.x > ix && q.x < ix + 1 && q.y > iy && q.y < iy + 1) ||
          room.polygon.some((q, i) =>
            square.some((c, j) =>
              intersects(q, room.polygon[(i + 1) % room.polygon.length], c, square[(j + 1) % 4]),
            ),
          )),
    );
    if (blocked) {
      setMessage('This cell supports a room. Choose open ground.');
      return;
    }
    const amount = Number(ref.current.step);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5) {
      setMessage('Enter a depth between 0.001 and 5 m.');
      return;
    }
    const cuts = p.terrainCuts ?? [],
      top =
        ground.elevationM +
        (p.garden ? gardenElevationAt(p.garden, { x: ix + 0.5, y: iy + 0.5 }) : 0);
    try {
      const next = editSoil(
        cuts,
        { x: ix, y: iy },
        top,
        ref.current.mode === 'Dig' ? amount : -amount,
      );
      if (next === cuts) {
        setMessage('This cell is at ground level.');
        return;
      }
      if (!changes.current) {
        if (isDrawTransactionActive()) throw Error('Finish the other drawing first.');
        beginDrawTransaction(ref.current.mode + ' land');
        changes.current = true;
      }
      state.setTerrainCuts(next);
      visited.current.add(id);
      const depth = next.find((c) => c.id === id)?.depthM ?? 0;
      setMessage(
        'Cell ' +
          ix +
          ', ' +
          iy +
          ' · ' +
          depth.toFixed(3) +
          ' m deep · ' +
          depth.toFixed(3) +
          ' m³',
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const handlers = useRef({ apply, finish, onClose });
  handlers.current = { apply, finish, onClose };
  useEffect(() => {
    const el = ref.current.view.element();
    if (!el) return;
    let contact: number | null = null;
    const place = (e: PointerEvent) => {
      const q = ref.current.view.ray(e.clientX, e.clientY);
      if (!q) return;
      const property = usePropertyStore.getState().property,
        grade = buildingLevels(property)[0]?.elevationM ?? 0,
        up = { x: 0, y: 0, z: 1 };
      // Aim at the ground opening even if a cell was already excavated.
      let p = rayPlane(q.origin, q.direction, { x: 0, y: 0, z: grade }, up);
      if (p && property.garden) {
        const adjusted = grade + gardenElevationAt(property.garden, p);
        p = rayPlane(q.origin, q.direction, { x: 0, y: 0, z: adjusted }, up) ?? p;
      }
      if (p) handlers.current.apply(p.x, p.y);
    };
    const down = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        !e.isPrimary ||
        (e.target as Element).closest(
          'button,select,label,input,.earthwork-panel,.world-walk-toolbar,.world-walk-stick,.world-look-stick',
        )
      )
        return;
      contact = e.pointerId;
      e.stopImmediatePropagation();
      e.preventDefault();
      el.setPointerCapture(contact);
      place(e);
    };
    const move = (e: PointerEvent) => {
      if (contact !== e.pointerId) return;
      e.stopImmediatePropagation();
      place(e);
    };
    const up = (e: PointerEvent) => {
      if (contact !== e.pointerId) return;
      e.stopImmediatePropagation();
      contact = null;
      handlers.current.finish();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        handlers.current.finish();
        handlers.current.onClose();
      }
    };
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', up, true);
    el.addEventListener('lostpointercapture', up, true);
    window.addEventListener('keydown', key, true);
    return () => {
      handlers.current.finish();
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', up, true);
      el.removeEventListener('lostpointercapture', up, true);
      window.removeEventListener('keydown', key, true);
    };
  }, []);
  return (
    <section
      className="earthwork-panel boundary-panel"
      aria-label="Earthworks"
      data-testid="earthworks-panel"
    >
      <header>
        <strong>Earthworks</strong>
        <button
          aria-label="Close earthworks"
          onClick={() => {
            finish();
            onClose();
          }}
        >
          ×
        </button>
      </header>
      <div className="boundary-actions">
        {(['Dig', 'Fill'] as const).map((v) => (
          <button key={v} aria-pressed={mode === v} onClick={() => setMode(v)}>
            {v}
          </button>
        ))}
      </div>
      <label>
        Depth per stroke (m)
        <input
          type="number"
          min=".001"
          max="5"
          step=".001"
          value={step}
          onChange={(e) => setStep(e.target.value)}
        />
      </label>
      <button onClick={() => setPrecise(!precise)} aria-expanded={precise}>
        Cell coordinates
      </button>
      {precise && (
        <>
          <div className="boundary-xyz">
            {['X', 'Y'].map((axis, i) => (
              <label key={axis}>
                {axis} (m)
                <input
                  value={coords[i]}
                  type="number"
                  onChange={(e) => setCoords(coords.map((v, j) => (i === j ? e.target.value : v)))}
                />
              </label>
            ))}
          </div>
          <button
            onClick={() => {
              if (coords.every((v) => v.trim())) apply(Number(coords[0]), Number(coords[1]));
              finish();
            }}
          >
            {mode} cell
          </button>
        </>
      )}
      <output aria-live="polite">{message}</output>
    </section>
  );
}
