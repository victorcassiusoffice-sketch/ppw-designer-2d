import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { ServicesContextProducts } from './ServicesContextProducts';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useHistoryStore } from '../store/historyStore';
import { activeLevelIdOf, levelsOf, roomLevelId } from '../designer/levels';
import {
  EMPTY_SERVICES,
  estimateServices,
  SERVICE_FIXTURES,
  SERVICE_SYSTEMS,
  type ServiceFixture,
  type ServiceFixtureKind,
  type ServicePoint,
  type ServiceRun,
  type ServiceSystem,
} from '../designer/buildingServices';
import { SERVICE_MATERIALS, SERVICE_FITTINGS } from '../data/buildingServicesCatalog';
import { StudioIcon } from './StudioIcon';
import './servicesWorkspace.css';

export function ServicesLaunchButton({
  onBeforeOpen,
  compact = false,
}: {
  onBeforeOpen?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className="services-launch"
      title="Plumbing & Electric · floor services plan"
      aria-label="Plumbing & Electric"
      onClick={() => {
        onBeforeOpen?.();
        window.dispatchEvent(new CustomEvent('ppw:open-services'));
      }}
    >
      <StudioIcon name="services" size={20} />
      {!compact && <span>Plumbing & Electric</span>}
    </button>
  );
}
export function ServicesWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false),
    [initialSelection, setInitialSelection] = useState<string | null>(null);
  const before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    const show = (event?: Event) => {
      setInitialSelection(
        (event as CustomEvent<{ fixtureId?: string }> | undefined)?.detail?.fixtureId ?? null,
      );
      before.current();
      const ui = useDesignerUIStore.getState();
      ui.setViewMode('plan');
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
      window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
      setOpen(true);
    };
    const close = () => setOpen(false);
    window.addEventListener('ppw:open-services', show);
    window.addEventListener('ppw:open-plan-import', close);
    window.addEventListener('ppw:open-ai-design', close);
    if (new URLSearchParams(location.search).get('panel') === 'services') show();
    return () => {
      window.removeEventListener('ppw:open-services', show);
      window.removeEventListener('ppw:open-plan-import', close);
      window.removeEventListener('ppw:open-ai-design', close);
    };
  }, []);
  return open
    ? createPortal(
        <ServicesWorkbench initialSelection={initialSelection} onClose={() => setOpen(false)} />,
        document.body,
      )
    : null;
}

type ViewBox = { x: number; y: number; w: number; h: number };
type Tool = 'select' | 'pipe' | 'move' | ServiceFixtureKind;
function ServicesWorkbench({
  onClose,
  initialSelection,
}: {
  onClose: () => void;
  initialSelection: string | null;
}) {
  const property = usePropertyStore((s) => s.property),
    services = property.services ?? EMPTY_SERVICES;
  const levelId = activeLevelIdOf(property),
    levels = levelsOf(property);
  const [error, setError] = useState('');
  const [tool, setTool] = useState<Tool>('select'),
    [system, setSystem] = useState<ServiceSystem>('cold-water');
  const [materialId, setMaterialId] = useState(SERVICE_MATERIALS[0].id);
  const [startElevation, setStartElevation] = useState(-0.3),
    [endElevation, setEndElevation] = useState(-0.3);
  const [draft, setDraft] = useState<ServicePoint[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState(true),
    [snap, setSnap] = useState(true),
    [orthogonal, setOrthogonal] = useState(true);
  const [view, setView] = useState<ViewBox>({ x: -2, y: -2, w: 14, h: 10 });
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: ServicePoint;
    last: ServicePoint;
    view: ViewBox;
    target: string | null;
    moved: boolean;
    pinch?: { d: number; mid: ServicePoint };
  } | null>(null);
  const rooms = property.rooms.filter((r) => roomLevelId(r) === levelId);
  const walls = (property.walls ?? []).filter((w) => roomLevelId(w) === levelId);
  const runs = services.runs.filter((r) => r.levelId === levelId),
    fixtures = services.fixtures.filter((f) => f.levelId === levelId);
  const selectedFixture = fixtures.find((f) => f.id === selected),
    selectedRun = runs.find((r) => r.id === selected);
  const material = SERVICE_MATERIALS.find((m) => m.id === (selectedRun?.materialId ?? materialId));
  const summaries = estimateServices(services),
    estimate = summaries.find((e) => e.id === selected);
  const activeSystem = SERVICE_SYSTEMS.find((s) => s.id === system)!;
  const canUndo = useHistoryStore((s) => s.past.length > 0),
    canRedo = useHistoryStore((s) => s.future.length > 0);
  function save(next: typeof services) {
    const ok = usePropertyStore.getState().setServices(next);
    setError(
      ok
        ? ''
        : 'This edit exceeds the supported geometry limits or creates an invalid route. Your previous work is preserved. Shorten the route or check its dimensions.',
    );
    return ok;
  }
  function fit() {
    const points = [
      ...rooms.flatMap((r) => r.polygon),
      ...walls.flatMap((w) => [w.a, w.b]),
      ...runs.flatMap((r) => r.points),
      ...fixtures.flatMap((f) => {
        const a = (f.rotation * Math.PI) / 180,
          c = Math.cos(a),
          t = Math.sin(a);
        return [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, y]) => ({
          x: f.x + ((x * f.widthM) / 2) * c - ((y * f.depthM) / 2) * t,
          y: f.y + ((x * f.widthM) / 2) * t + ((y * f.depthM) / 2) * c,
        }));
      }),
    ];
    if (!points.length) {
      setView({ x: -2, y: -2, w: 14, h: 10 });
      return;
    }
    const x = Math.min(...points.map((p) => p.x)) - 1,
      y = Math.min(...points.map((p) => p.y)) - 1;
    setView({
      x,
      y,
      w: Math.max(3, Math.max(...points.map((p) => p.x)) - x + 1),
      h: Math.max(3, Math.max(...points.map((p) => p.y)) - y + 1),
    });
  }
  // Fit only on workspace/floor entry; editing content must never change the camera.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDraft([]);
    setSelected(initialSelection);
    setTool('select');
    fit();
  }, [property.id, levelId]);
  useWorkspaceFocus(host, () => {
    if (draft.length) {
      setDraft([]);
      setTool('select');
    } else onClose();
  });
  useEffect(() => {
    setSelected(initialSelection);
  }, [initialSelection]);
  function chooseTool(next: Tool) {
    setError('');
    setDraft([]);
    setTool(next);
    if (next !== 'move') setSelected(null);
  }
  function changeSystem(value: ServiceSystem) {
    setSystem(value);
    setMaterialId(SERVICE_MATERIALS.find((m) => m.system === value)!.id);
    setDraft([]);
    setSelected(null);
    setTool('pipe');
  }
  function world(clientX: number, clientY: number): ServicePoint {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  function tap(point: ServicePoint, target: string | null) {
    if (tool === 'select') {
      setSelected(target);
      if (target) setDetails(true);
      return;
    }
    let p = snap ? { x: Math.round(point.x * 20) / 20, y: Math.round(point.y * 20) / 20 } : point;
    if (tool === 'move' && selectedFixture) {
      save({
        ...services,
        fixtures: services.fixtures.map((f) => (f.id === selected ? { ...f, ...p } : f)),
      });
      setTool('select');
      return;
    }
    if (tool === 'pipe') {
      const last = draft[draft.length - 1];
      if (last && orthogonal)
        p =
          Math.abs(p.x - last.x) >= Math.abs(p.y - last.y)
            ? { x: p.x, y: last.y }
            : { x: last.x, y: p.y };
      if (draft.length >= 500) {
        setError('Finish this run before adding more points (500 per run).');
        return;
      }
      if (
        !last ||
        Math.hypot(p.x - last.x, p.y - last.y) >= 0.01 ||
        (draft.length === 1 && startElevation !== endElevation)
      )
        setDraft([...draft, p]);
      return;
    }
    if (tool === 'move') return;
    const { widthM, depthM, heightM } = SERVICE_FIXTURES[tool];
    const fixture: ServiceFixture = {
      id: nanoid(10),
      levelId,
      kind: tool,
      ...p,
      widthM,
      depthM,
      heightM,
      rotation: 0,
    };
    if (!save({ ...services, fixtures: [...services.fixtures, fixture] })) return;
    setSelected(fixture.id);
    setTool('select');
    setDetails(true);
  }
  function finish() {
    if (draft.length < 2) return;
    const m = SERVICE_MATERIALS.find((m) => m.id === materialId)!;
    const run: ServiceRun = {
      id: nanoid(10),
      levelId,
      system,
      materialId,
      diameterMm: m.nominalDiameterMm,
      points: draft,
      startElevationM: startElevation,
      endElevationM: endElevation,
    };
    if (!save({ ...services, runs: [...services.runs, run] })) return;
    setSelected(run.id);
    setDraft([]);
    setTool('select');
    setDetails(true);
  }
  function updateFixture(patch: Partial<ServiceFixture>) {
    save({
      ...services,
      fixtures: services.fixtures.map((f) => (f.id === selected ? { ...f, ...patch } : f)),
    });
  }
  function updateRun(patch: Partial<ServiceRun>) {
    save({
      ...services,
      runs: services.runs.map((r) => (r.id === selected ? { ...r, ...patch } : r)),
    });
  }
  function remove() {
    save({
      ...services,
      fixtures: services.fixtures.filter((f) => f.id !== selected),
      runs: services.runs.filter((r) => r.id !== selected),
    });
    setSelected(null);
    setTool('select');
  }
  function zoom(factor: number, anchor?: ServicePoint) {
    setView((v) => {
      const f = Math.min(200 / Math.max(v.w, v.h), Math.max(0.3 / Math.min(v.w, v.h), factor));
      const p = anchor ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      return { x: p.x + (v.x - p.x) * f, y: p.y + (v.y - p.y) * f, w: v.w * f, h: v.h * f };
    });
  }
  const instruction =
    tool === 'pipe'
      ? `${draft.length ? 'Add the next bend' : 'Tap the pipe start'} · Finish saves this run`
      : tool === 'move'
        ? 'Tap the new fixture position'
        : tool === 'select'
          ? 'Select a route or fixture · drag to pan · pinch to zoom'
          : `Tap to place ${SERVICE_FIXTURES[tool].label.toLowerCase()}`;
  return (
    <div
      ref={host}
      className="services-workspace"
      role="dialog"
      aria-modal="true"
      aria-labelledby="services-title"
    >
      <header className="services-header">
        <button onClick={onClose}>
          <StudioIcon name="close" size={18} /> Back
        </button>
        <div>
          <h1 id="services-title">Plumbing & Electric</h1>
          <p>Measured floor services</p>
        </div>
        <select
          aria-label="Services floor"
          value={levelId}
          onChange={(e) => usePropertyStore.getState().setActiveLevel(e.target.value)}
        >
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          aria-label="Show 3D house"
          onClick={() => {
            onClose();
            useDesignerUIStore.getState().setViewMode('3d');
          }}
        >
          <StudioIcon name="cube" /> <span>3D</span>
        </button>
      </header>
      <nav className="services-tools" aria-label="Services tools">
        <button aria-pressed={tool === 'select'} onClick={() => chooseTool('select')}>
          <StudioIcon name="cursor" size={18} />
          Select
        </button>
        {SERVICE_SYSTEMS.map((s) => (
          <button
            key={s.id}
            aria-pressed={tool === 'pipe' && system === s.id}
            onClick={() => changeSystem(s.id)}
          >
            <span className="services-dot" style={{ background: s.colour }} />
            {s.label}
          </button>
        ))}
        {(Object.keys(SERVICE_FIXTURES) as ServiceFixtureKind[]).map((kind) => (
          <button key={kind} aria-pressed={tool === kind} onClick={() => chooseTool(kind)}>
            {SERVICE_FIXTURES[kind].label}
          </button>
        ))}
      </nav>
      <div className="services-body" data-details={details}>
        <section className="services-drawing" aria-label="Services drawing">
          <div className="services-view-tools">
            <button title="Zoom in" aria-label="Zoom services in" onClick={() => zoom(0.8)}>
              <StudioIcon name="plus" size={18} />
            </button>
            <button title="Zoom out" aria-label="Zoom services out" onClick={() => zoom(1.25)}>
              <StudioIcon name="minus" size={18} />
            </button>
            <button onClick={fit}>Fit</button>
            <button
              disabled={!canUndo}
              aria-label="Undo services edit"
              onClick={() => {
                setDraft([]);
                useHistoryStore.getState().undo();
              }}
            >
              <StudioIcon name="undo" size={18} />
            </button>
            <button
              disabled={!canRedo}
              aria-label="Redo services edit"
              onClick={() => useHistoryStore.getState().redo()}
            >
              <StudioIcon name="redo" size={18} />
            </button>
            <button
              className="services-detail-toggle"
              aria-expanded={details}
              onClick={() => setDetails(!details)}
            >
              <StudioIcon name="settings" size={18} />
              {details ? 'Hide details' : 'Details'}
            </button>
          </div>
          <svg
            ref={svg}
            className="services-plan"
            aria-label="Scaled services floor plan"
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            onWheel={(e) => {
              zoom(
                Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.001))),
                world(e.clientX, e.clientY),
              );
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = { x: e.clientX, y: e.clientY };
              pointers.current.set(e.pointerId, p);
              if (pointers.current.size === 1)
                gesture.current = {
                  start: p,
                  last: p,
                  view,
                  moved: false,
                  target:
                    (e.target as Element)
                      .closest('[data-service-id]')
                      ?.getAttribute('data-service-id') ?? null,
                };
              else if (pointers.current.size === 2 && gesture.current) {
                const [a, b] = [...pointers.current.values()];
                gesture.current = {
                  ...gesture.current,
                  moved: true,
                  view,
                  pinch: {
                    d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                    mid: world((a.x + b.x) / 2, (a.y + b.y) / 2),
                  },
                };
              }
            }}
            onPointerMove={(e) => {
              if (!pointers.current.has(e.pointerId)) return;
              const p = { x: e.clientX, y: e.clientY };
              pointers.current.set(e.pointerId, p);
              const g = gesture.current;
              if (!g) return;
              if (pointers.current.size === 2 && g.pinch) {
                const [a, b] = [...pointers.current.values()],
                  d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
                const f = Math.max(0.1, Math.min(10, g.pinch.d / d));
                if (g.view.w * f < 0.3 || g.view.w * f > 200) return;
                const rect = svg.current!.getBoundingClientRect(),
                  sx = (a.x + b.x) / 2,
                  sy = (a.y + b.y) / 2;
                const w = g.view.w * f,
                  h = g.view.h * f;
                const scale = Math.min(rect.width / w, rect.height / h);
                const px = (rect.width - w * scale) / 2,
                  py = (rect.height - h * scale) / 2;
                setView({
                  x: g.pinch.mid.x - (sx - rect.left - px) / scale,
                  y: g.pinch.mid.y - (sy - rect.top - py) / scale,
                  w,
                  h,
                });
              } else if (!g.pinch) {
                if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 5) g.moved = true;
                if (g.moved) {
                  const matrix = svg.current?.getScreenCTM();
                  if (matrix)
                    setView((v) => ({
                      ...v,
                      x: v.x - (p.x - g.last.x) / matrix.a,
                      y: v.y - (p.y - g.last.y) / matrix.d,
                    }));
                }
                g.last = p;
              }
            }}
            onPointerUp={(e) => {
              const g = gesture.current;
              pointers.current.delete(e.pointerId);
              if (g && !g.moved && !pointers.current.size)
                tap(world(e.clientX, e.clientY), g.target);
              if (!pointers.current.size) gesture.current = null;
            }}
            onPointerCancel={() => {
              pointers.current.clear();
              gesture.current = null;
            }}
          >
            <defs>
              <pattern id="services-grid" width=".5" height=".5" patternUnits="userSpaceOnUse">
                <path d="M.5 0H0V.5" fill="none" stroke="#80958b" strokeWidth=".006" />
              </pattern>
            </defs>
            <rect
              x={view.x - view.w}
              y={view.y - view.h}
              width={view.w * 3}
              height={view.h * 3}
              fill="url(#services-grid)"
            />
            {rooms.map((r) => (
              <g key={r.id}>
                <polygon
                  points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="#eeeae0"
                  fillOpacity=".88"
                  stroke="#586b62"
                  strokeWidth=".14"
                  strokeLinejoin="round"
                />
                <text
                  x={r.polygon.reduce((sum, p) => sum + p.x, 0) / (r.polygon.length || 1)}
                  y={r.polygon.reduce((sum, p) => sum + p.y, 0) / (r.polygon.length || 1)}
                  fontSize=".16"
                  fill="#66736b"
                  textAnchor="middle"
                >
                  {r.name}
                </text>
              </g>
            ))}
            {walls.map((w) => (
              <line
                key={w.id}
                x1={w.a.x}
                y1={w.a.y}
                x2={w.b.x}
                y2={w.b.y}
                stroke="#586b62"
                strokeWidth={w.thicknessM}
              />
            ))}
            <ServicesContextProducts rooms={rooms} />
            {runs.map((run) => {
              const colour = SERVICE_SYSTEMS.find((s) => s.id === run.system)!.colour;
              const od = SERVICE_MATERIALS.find((m) => m.id === run.materialId)?.outerDiameterMm;
              return (
                <g key={run.id} data-service-id={run.id}>
                  <polyline
                    points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={selected === run.id ? '#b08a44' : colour}
                    strokeWidth={(od ?? run.diameterMm) / 1000}
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={colour}
                    strokeWidth="1.5"
                    strokeDasharray={run.startElevationM < 0 ? '5 3' : undefined}
                    vectorEffect="non-scaling-stroke"
                    opacity=".7"
                  />
                  <polyline
                    points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    vectorEffect="non-scaling-stroke"
                  />
                  {run.points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r=".035" fill={colour} />
                  ))}
                </g>
              );
            })}
            {fixtures.map((f) => (
              <g
                key={f.id}
                data-service-id={f.id}
                transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
              >
                <rect
                  x={-f.widthM / 2}
                  y={-f.depthM / 2}
                  width={f.widthM}
                  height={f.depthM}
                  rx={f.kind === 'toilet' ? f.widthM / 3 : 0.025}
                  fill="#f7f5ed"
                  stroke={selected === f.id ? '#a07735' : '#416457'}
                  strokeWidth=".025"
                />
                {f.kind === 'toilet' || f.kind === 'sink' ? (
                  <ellipse
                    rx={f.widthM * 0.32}
                    ry={f.depthM * 0.3}
                    fill="#c5d6d1"
                    stroke="#718a7f"
                    strokeWidth=".02"
                  />
                ) : (
                  <path
                    d={`M${-f.widthM * 0.3} 0H${f.widthM * 0.3}M0 ${-f.depthM * 0.3}V${f.depthM * 0.3}`}
                    stroke="#416457"
                    strokeWidth=".025"
                  />
                )}
                <rect
                  x={-Math.max(0.25, f.widthM) / 2}
                  y={-Math.max(0.25, f.depthM) / 2}
                  width={Math.max(0.25, f.widthM)}
                  height={Math.max(0.25, f.depthM)}
                  fill="transparent"
                />
              </g>
            ))}
            {draft.length > 0 && (
              <g pointerEvents="none">
                <polyline
                  points={draft.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={activeSystem.colour}
                  strokeWidth="3"
                  strokeDasharray="5 3"
                  vectorEffect="non-scaling-stroke"
                />
                {draft.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r=".05" fill={activeSystem.colour} />
                ))}
              </g>
            )}
          </svg>
          <div className="services-instruction" role="status">
            <span>{error || instruction}</span>
            {draft.length > 0 && (
              <>
                <button onClick={() => setDraft(draft.slice(0, -1))}>Back point</button>
                <button disabled={draft.length < 2} onClick={finish}>
                  Finish run
                </button>
                <button onClick={() => chooseTool('select')}>Cancel</button>
              </>
            )}
          </div>
        </section>
        {details && (
          <aside className="services-inspector" aria-label="Services details">
            <div className="services-inspector-title">
              <strong>
                {selectedFixture
                  ? SERVICE_FIXTURES[selectedFixture.kind].label
                  : selectedRun
                    ? 'Route details'
                    : 'Floor services'}
              </strong>
              <button aria-label="Close services details" onClick={() => setDetails(false)}>
                <StudioIcon name="close" size={18} />
              </button>
            </div>
            {selectedFixture ? (
              <>
                <p>Generic planning fixture. Edit to your chosen product’s measured dimensions.</p>
                <div className="services-fields">
                  {(['x', 'y', 'widthM', 'depthM', 'heightM'] as const).map((key) => (
                    <label key={key}>
                      {{ x: 'X', y: 'Y', widthM: 'Width', depthM: 'Depth', heightM: 'Height' }[key]}{' '}
                      (m)
                      <input
                        type="number"
                        step=".01"
                        min={key === 'x' || key === 'y' ? -10000 : 0.05}
                        max={key === 'x' || key === 'y' ? 10000 : 5}
                        value={selectedFixture[key]}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (e.target.value && e.target.validity.valid)
                            updateFixture({ [key]: value });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="services-actions">
                  <button onClick={() => setTool('move')}>Move</button>
                  <button
                    onClick={() => updateFixture({ rotation: selectedFixture.rotation + 90 })}
                  >
                    Rotate 90°
                  </button>
                  <button onClick={remove}>Remove</button>
                </div>
              </>
            ) : (
              <>
                <label>
                  Pipe / conduit material
                  <select
                    value={selectedRun?.materialId ?? materialId}
                    onChange={(e) => {
                      const m = SERVICE_MATERIALS.find((m) => m.id === e.target.value)!;
                      if (selectedRun)
                        updateRun({ materialId: m.id, diameterMm: m.nominalDiameterMm });
                      else setMaterialId(m.id);
                    }}
                  >
                    {selectedRun &&
                      !SERVICE_MATERIALS.some((m) => m.id === selectedRun.materialId) && (
                        <option value={selectedRun.materialId}>
                          Unverified material · {selectedRun.materialId}
                        </option>
                      )}
                    {SERVICE_MATERIALS.filter(
                      (m) => m.system === (selectedRun?.system ?? system),
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.supplier} · {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="services-fields">
                  <label>
                    Start elevation (m)
                    <input
                      type="number"
                      step=".01"
                      min="-20"
                      max="20"
                      value={selectedRun?.startElevationM ?? startElevation}
                      onChange={(e) => {
                        if (e.target.value && e.target.validity.valid) {
                          if (selectedRun) updateRun({ startElevationM: Number(e.target.value) });
                          else setStartElevation(Number(e.target.value));
                        }
                      }}
                    />
                  </label>
                  <label>
                    End elevation (m)
                    <input
                      type="number"
                      step=".01"
                      min="-20"
                      max="20"
                      value={selectedRun?.endElevationM ?? endElevation}
                      onChange={(e) => {
                        if (e.target.value && e.target.validity.valid) {
                          if (selectedRun) updateRun({ endElevationM: Number(e.target.value) });
                          else setEndElevation(Number(e.target.value));
                        }
                      }}
                    />
                  </label>
                </div>
                <p>
                  0 = this floor’s finished level. Negative = below floor; ground-floor routes can
                  be underground. Elevation changes are a constant gradient along the route. For a
                  vertical riser, set different elevations and tap the same point twice.
                </p>
                {estimate && (
                  <>
                    {!estimate.verifiedMaterial && (
                      <p role="status">
                        Unverified material / size. Measured geometry only; no supply quantity
                        inferred.
                      </p>
                    )}
                    <dl>
                      <div>
                        <dt>Measured centre-line</dt>
                        <dd>{estimate.lengthM.toFixed(2)} m</dd>
                      </div>
                      <div>
                        <dt>Fall, start → end</dt>
                        <dd>{estimate.fallM.toFixed(2)} m</dd>
                      </div>
                      {estimate.stockLengths !== null && (
                        <div>
                          <dt>Whole supply lengths</dt>
                          <dd>
                            {estimate.stockLengths} × {estimate.stockLengthM} m
                          </dd>
                        </div>
                      )}
                    </dl>
                    <button onClick={remove}>Remove route</button>
                  </>
                )}
                {material && (
                  <details>
                    <summary>{material.supplier} · source & sizing</summary>
                    <p>{material.notes}</p>
                    <p>
                      {material.outerDiameterMm
                        ? `Verified outside diameter: ${material.outerDiameterMm} mm.`
                        : 'Nominal size only; confirm outside diameter.'}
                    </p>
                    <a href={material.sourceUrl} target="_blank" rel="noreferrer">
                      Supplier reference ↗
                    </a>
                  </details>
                )}
              </>
            )}
            <div className="services-options">
              <label>
                <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
                5 cm grid snap
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={orthogonal}
                  onChange={(e) => setOrthogonal(e.target.checked)}
                />
                Square pipe bends
              </label>
            </div>
            <dl>
              <div>
                <dt>This floor</dt>
                <dd>
                  {runs.length} routes · {fixtures.length} fixtures
                </dd>
              </div>
              <div>
                <dt>Total route length</dt>
                <dd>
                  {summaries
                    .filter((s) => s.levelId === levelId)
                    .reduce((n, s) => n + s.lengthM, 0)
                    .toFixed(2)}{' '}
                  m
                </dd>
              </div>
            </dl>
            <details>
              <summary>Compatible fitting references</summary>
              <p>
                Choose and count fittings with your installer; bends do not automatically specify an
                elbow or tee.
              </p>
              {SERVICE_FITTINGS.filter((f) => f.system === (selectedRun?.system ?? system)).map(
                (f) => (
                  <a key={f.id} href={f.sourceUrl} target="_blank" rel="noreferrer">
                    {f.supplier} · {f.label} ↗
                  </a>
                ),
              )}
            </details>
            <p className="services-note">
              Routing and quantity coordination only. Not pressure, drainage capacity or cable
              sizing. Supplier references are not live stock. The fine line marks the route; the
              body uses published OD where available.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
