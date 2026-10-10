import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useHistoryStore } from '../store/historyStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { WorkspaceFloorNav } from './WorkspaceFloorNav';
import {
  beginWorkspaceNavigation,
  cancelWorkspaceNavigation,
  finishWorkspaceNavigation,
} from '../designer/workspaceNavigation';
import { roomLevelId, isOutdoorRoom, isRoofRoom } from '../designer/levels';
import { normaliseMaterialsSettings } from '../designer/materials';
import {
  EMPTY_FOUNDATION,
  FOUNDATION_KINDS,
  FOUNDATION_ELEMENT_LIMIT,
  defaultFoundationRebar,
  estimateFoundation,
  foundationElementBounds,
  foundationExcavationBounds,
  foundationIsFilled,
  type FoundationExcavation,
  type FoundationElement,
  type FoundationKind,
  type FoundationModel,
} from '../designer/foundation';
import './foundationWorkspace.css';

const fmt = (v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 3 });
// Pointer geometry uses a 50 mm grid and 25 mm centres. Round its arithmetic
// to millimetres so decimal subtraction never leaks into saved dimensions.
// Numeric inputs keep the exact precision entered by the customer.
const pointerMetres = (value: number) => Math.round(value * 1000) / 1000 || 0;
export function FoundationLaunchButton({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  return (
    <button
      type="button"
      className="foundation-launch"
      onClick={() => {
        onBeforeOpen?.();
        window.dispatchEvent(new Event('ppw:open-foundation'));
      }}
    >
      <span aria-hidden="true">▱</span> Foundation
    </button>
  );
}
export function FoundationWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    const show = () => {
      beginWorkspaceNavigation('foundation');
      before.current();
      const ui = useDesignerUIStore.getState();
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new Event('ppw:close-house-details'));
      window.dispatchEvent(new Event('ppw:close-catalog'));
      setOpen(true);
    };
    const close = (event: Event) => {
      if (event.type !== 'ppw:open-services') cancelWorkspaceNavigation('foundation');
      setOpen(false);
    };
    const unsubscribe = usePropertyStore.subscribe((state, previous) => {
      if (state.property.id === previous.property.id) return;
      cancelWorkspaceNavigation('foundation');
      setOpen(false);
    });
    window.addEventListener('ppw:open-foundation', show);
    const switches = ['ppw:open-services', 'ppw:open-plan-import', 'ppw:open-ai-design'];
    switches.forEach((name) => window.addEventListener(name, close));
    if (new URLSearchParams(location.search).get('panel') === 'foundation') show();
    return () => {
      unsubscribe();
      finishWorkspaceNavigation('foundation');
      window.removeEventListener('ppw:open-foundation', show);
      switches.forEach((name) => window.removeEventListener(name, close));
    };
  }, []);
  return open
    ? createPortal(
        <FoundationWorkbench
          onClose={() => {
            finishWorkspaceNavigation('foundation');
            setOpen(false);
          }}
        />,
        document.body,
      )
    : null;
}
function Dimension({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => boolean;
  min: number;
  max: number;
  step?: number;
}) {
  const [invalid, setInvalid] = useState(false);
  return (
    <label className="foundation-field">
      <span>{label}</span>
      <input
        aria-label={label}
        key={value}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        onBlur={(event) => {
          const n = event.currentTarget.valueAsNumber;
          const valid = Number.isFinite(n) && n >= min && n <= max && (n === value || onChange(n));
          setInvalid(!valid);
          if (!valid) event.currentTarget.value = String(value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {invalid && <small role="status">Check this dimension; the previous value was kept.</small>}
    </label>
  );
}
function FoundationWorkbench({ onClose }: { onClose: () => void }) {
  const property = usePropertyStore((s) => s.property);
  const model = property.foundation ?? EMPTY_FOUNDATION;
  const settings = normaliseMaterialsSettings(property.materials);
  const estimate = estimateFoundation(model, settings.concrete);
  const rooms = property.rooms.filter(
    (r) => roomLevelId(r) === 'ground' && !isOutdoorRoom(r) && !isRoofRoom(r),
  );
  const [selectedId, setSelectedId] = useState<string | null>(model.elements[0]?.id ?? null);
  const selected = model.elements.find((e) => e.id === selectedId);
  const [tool, setTool] = useState<FoundationKind | 'select' | 'pan' | 'move'>('select');
  const [firstCorner, setFirstCorner] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [view, setView] = useState({ x: -2, y: -2, w: 14, h: 10 });
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    pointerId: number;
    moved: boolean;
    view: typeof view;
  } | null>(null);
  const canUndo = useHistoryStore((s) => s.past.length > 0),
    canRedo = useHistoryStore((s) => s.future.length > 0);
  const basePoints = useMemo(
    () => [
      ...rooms.flatMap((r) => r.polygon),
      ...model.elements.flatMap((e) => {
        const b = foundationExcavationBounds(e) ?? foundationElementBounds(e);
        return [
          { x: b.minX, y: b.minY },
          { x: b.maxX, y: b.maxY },
        ];
      }),
    ],
    [rooms, model.elements],
  );
  function fit() {
    if (!basePoints.length) {
      setView({ x: -2, y: -2, w: 14, h: 10 });
      return;
    }
    const x = Math.min(...basePoints.map((p) => p.x)) - 1,
      y = Math.min(...basePoints.map((p) => p.y)) - 1;
    setView({
      x,
      y,
      w: Math.max(3, Math.max(...basePoints.map((p) => p.x)) - x + 1),
      h: Math.max(3, Math.max(...basePoints.map((p) => p.y)) - y + 1),
    });
  }
  // Entering the workspace fits once. Editing dimensions must not move the camera.
  const fitOnEntry = useRef(fit);
  fitOnEntry.current = fit;
  useEffect(() => {
    fitOnEntry.current();
  }, [property.id]);
  useWorkspaceFocus(host, () => {
    if (tool !== 'select' || firstCorner) chooseTool('select');
    else onClose();
  });
  function save(next: FoundationModel) {
    const ok = usePropertyStore.getState().setFoundation(next);
    setError(
      ok
        ? ''
        : 'These dimensions cannot be saved. Check the supported range, cover, layers and bar spacing. Your previous foundation is preserved.',
    );
    return ok;
  }
  function chooseTool(next: typeof tool) {
    setTool(next);
    setFirstCorner(null);
    setError('');
  }
  function update(patch: Partial<FoundationElement>) {
    if (selected?.excavation && patch.depthM !== undefined && patch.topElevationM === undefined) {
      patch = {
        ...patch,
        topElevationM:
          selected.excavation.topElevationM - selected.excavation.depthM + patch.depthM,
      };
    }
    return selected
      ? save({
          ...model,
          elements: model.elements.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)),
        })
      : false;
  }
  function updateExcavation(patch: Partial<FoundationExcavation>) {
    if (!selected?.excavation) return false;
    const excavation = { ...selected.excavation, ...patch };
    return update({
      excavation,
      ...(patch.depthM !== undefined || patch.topElevationM !== undefined
        ? { topElevationM: excavation.topElevationM - excavation.depthM + selected.depthM }
        : {}),
    });
  }
  function updateRebar(patch: Partial<FoundationElement['rebar']>) {
    return selected ? update({ rebar: { ...selected.rebar, ...patch } }) : false;
  }
  function changeMix(path: string, value: number | string) {
    const concrete = { ...settings.concrete, [path]: value };
    usePropertyStore.getState().setMaterialsSettings({ ...settings, concrete });
    return true;
  }
  function world(x: number, y: number) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    return {
      x: pointerMetres(Math.round(point.x * 20) / 20),
      y: pointerMetres(Math.round(point.y * 20) / 20),
    };
  }
  function tap(x: number, y: number, id: string | null) {
    if (tool === 'pan') return;
    if (tool === 'select') {
      setSelectedId(id);
      if (id) setDetailsOpen(true);
      return;
    }
    const p = world(x, y);
    if (tool === 'move') {
      if (update(p)) chooseTool('select');
      return;
    }
    if (!firstCorner) {
      setFirstCorner(p);
      return;
    }
    const lengthM = pointerMetres(Math.abs(p.x - firstCorner.x));
    const widthM = pointerMetres(Math.abs(p.y - firstCorner.y));
    if (lengthM < 0.1 || widthM < 0.1) {
      setError('Make the rectangle at least 0.1 m in both directions.');
      return;
    }
    if (model.elements.length >= FOUNDATION_ELEMENT_LIMIT) {
      setError(`Maximum ${FOUNDATION_ELEMENT_LIMIT} foundation elements per project.`);
      return;
    }
    const e: FoundationElement = {
      id: nanoid(10),
      name: `${FOUNDATION_KINDS.find((k) => k.id === tool)!.label} ${model.elements.length + 1}`,
      kind: tool,
      x: pointerMetres((p.x + firstCorner.x) / 2),
      y: pointerMetres((p.y + firstCorner.y) / 2),
      lengthM,
      widthM,
      depthM: 0.2,
      topElevationM: -0.8,
      rebar: defaultFoundationRebar(),
      excavation: { depthM: 1, topElevationM: 0, marginM: 0, stage: 'excavated' },
    };
    if (save({ ...model, version: 1, enabled: true, elements: [...model.elements, e] })) {
      setSelectedId(e.id);
      setDetailsOpen(true);
      chooseTool('select');
    }
  }
  function zoom(factor: number) {
    setView((v) => {
      const f = Math.min(2000 / Math.max(v.w, v.h), Math.max(0.5 / Math.min(v.w, v.h), factor));
      return { x: v.x + (v.w * (1 - f)) / 2, y: v.y + (v.h * (1 - f)) / 2, w: v.w * f, h: v.h * f };
    });
  }
  const field = (
    label: string,
    key: 'x' | 'y' | 'lengthM' | 'widthM' | 'depthM' | 'topElevationM',
    min: number,
    max: number,
  ) =>
    selected && (
      <Dimension
        label={label}
        value={selected[key]}
        min={min}
        max={max}
        onChange={(n) => update({ [key]: n })}
      />
    );
  const rebarField = (
    label: string,
    key: Exclude<keyof FoundationElement['rebar'], 'enabled'>,
    min: number,
    max: number,
    step = 1,
  ) =>
    selected && (
      <Dimension
        label={label}
        value={selected.rebar[key]}
        min={min}
        max={max}
        step={step}
        onChange={(n) => updateRebar({ [key]: n })}
      />
    );
  return (
    <div
      ref={host}
      className="foundation-workspace"
      role="dialog"
      aria-modal="true"
      aria-label="Foundation design"
    >
      <header className="foundation-header">
        <button onClick={onClose}>← Back</button>
        <button
          onClick={() => {
            onClose();
            const ui = useDesignerUIStore.getState();
            ui.setFoundationView(true);
            ui.setViewMode('3d');
          }}
        >
          3D foundation
        </button>
        <div>
          <h1>Foundation</h1>
          <p>Excavate → add concrete → review reinforcement</p>
        </div>
        <WorkspaceFloorNav onExit={onClose} />
        <button
          aria-label={detailsOpen ? 'Hide foundation details' : 'Show foundation details'}
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          Details {detailsOpen ? '−' : '+'}
        </button>
      </header>
      <nav className="foundation-tools" aria-label="Foundation tools">
        <button aria-pressed={tool === 'select'} onClick={() => chooseTool('select')}>
          Select
        </button>
        {FOUNDATION_KINDS.map((k) => (
          <button key={k.id} aria-pressed={tool === k.id} onClick={() => chooseTool(k.id)}>
            {k.label}
          </button>
        ))}
        <button aria-pressed={tool === 'pan'} onClick={() => chooseTool('pan')}>
          Move view
        </button>
        <button onClick={fit}>Fit</button>
        <button aria-label="Zoom foundation in" onClick={() => zoom(0.8)}>
          +
        </button>
        <button aria-label="Zoom foundation out" onClick={() => zoom(1.25)}>
          −
        </button>
        <button disabled={!canUndo} onClick={() => useHistoryStore.getState().undo()}>
          Undo
        </button>
        <button disabled={!canRedo} onClick={() => useHistoryStore.getState().redo()}>
          Redo
        </button>
      </nav>
      <div className="foundation-body">
        <main className="foundation-drawing">
          <div className="foundation-instruction">
            {tool === 'select'
              ? 'Select a foundation to edit · blank space deselects'
              : tool === 'pan'
                ? 'Drag to move the plan'
                : tool === 'move'
                  ? 'Tap the new centre of the selected foundation'
                  : firstCorner
                    ? 'Tap the opposite corner · 50 mm drawing snap · Esc cancels'
                    : 'Draw the excavation: first corner, then opposite corner'}
          </div>
          <svg
            ref={svg}
            aria-label="Scaled foundation plan"
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            onPointerDown={(event) => {
              if (gesture.current) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              gesture.current = {
                x: event.clientX,
                y: event.clientY,
                pointerId: event.pointerId,
                moved: false,
                view,
              };
            }}
            onPointerMove={(event) => {
              const g = gesture.current;
              if (!g || g.pointerId !== event.pointerId) return;
              const dx = event.clientX - g.x,
                dy = event.clientY - g.y;
              if (Math.hypot(dx, dy) > 5) g.moved = true;
              if (tool === 'pan') {
                const matrix = svg.current?.getScreenCTM();
                if (matrix)
                  setView({ ...g.view, x: g.view.x - dx / matrix.a, y: g.view.y - dy / matrix.d });
              }
            }}
            onPointerUp={(event) => {
              const g = gesture.current;
              if (!g || g.pointerId !== event.pointerId) return;
              gesture.current = null;
              if (!g.moved) {
                const hit = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest('[data-foundation-id]');
                tap(event.clientX, event.clientY, hit?.getAttribute('data-foundation-id') ?? null);
              }
            }}
            onPointerCancel={() => {
              gesture.current = null;
            }}
          >
            <defs>
              <pattern id="foundation-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                <path d="M 1 0 H 0 V 1" fill="none" stroke="#a1b3a7" strokeWidth="0.012" />
              </pattern>
            </defs>
            <rect
              x={view.x}
              y={view.y}
              width={view.w}
              height={view.h}
              fill="url(#foundation-grid)"
            />
            {rooms.map((r) => (
              <polygon
                key={r.id}
                points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="#fcfaf338"
                stroke="#455d4b"
                strokeWidth="0.04"
                strokeDasharray=".12 .08"
              />
            ))}
            {model.elements.map((e) => {
              const b = foundationElementBounds(e);
              const hole = foundationExcavationBounds(e);
              return (
                <g key={e.id} data-foundation-id={e.id}>
                  {hole && (
                    <rect
                      x={hole.minX}
                      y={hole.minY}
                      width={hole.maxX - hole.minX}
                      height={hole.maxY - hole.minY}
                      fill="#897459"
                      fillOpacity={model.enabled ? 0.55 : 0.2}
                      stroke="#6d513a"
                      strokeWidth=".04"
                      strokeDasharray=".16 .1"
                    />
                  )}
                  <rect
                    x={b.minX}
                    y={b.minY}
                    width={e.lengthM}
                    height={e.widthM}
                    fill={selectedId === e.id ? '#adbe9c' : '#b9bbb0'}
                    fillOpacity={!foundationIsFilled(e) ? 0.08 : model.enabled ? 0.8 : 0.25}
                    stroke={selectedId === e.id ? '#315f4f' : '#687967'}
                    strokeWidth="0.04"
                  />
                  <text
                    x={e.x}
                    y={e.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="0.22"
                    fill="#293c30"
                  >
                    {fmt(e.lengthM)} × {fmt(e.widthM)} m
                    {e.excavation ? ` · ${fmt(e.excavation.depthM)} m deep` : ''}
                  </text>
                </g>
              );
            })}
            {firstCorner && <circle cx={firstCorner.x} cy={firstCorner.y} r="0.1" fill="#315f4f" />}
          </svg>
          <div className="foundation-totals">
            <div>
              <small>Excavation</small>
              <strong>{fmt(estimate.excavationVolumeM3)} m³</strong>
            </div>
            <div>
              <small>Concrete in design</small>
              <strong>{fmt(estimate.volumeM3)} m³</strong>
            </div>
            <div>
              <small>With {settings.concrete.wastePct}% allowance</small>
              <strong>{fmt(estimate.concreteOrderM3)} m³</strong>
            </div>
            <div>
              <small>Scheduled straight steel</small>
              <strong>
                {estimate.rebarComplete ? `${fmt(estimate.rebarMassKg)} kg` : 'Review overlaps'}
              </strong>
            </div>
          </div>
          {!estimate.concreteComplete && (
            <p className="foundation-pending" role="status">
              {fmt(estimate.pendingConcreteM3)} m³ planned concrete awaits Add concrete. Design
              preview only; no site work is marked complete.
            </p>
          )}
          {error && (
            <p role="status" className="foundation-error">
              {error}
            </p>
          )}
        </main>
        {detailsOpen && (
          <aside className="foundation-details" aria-label="Foundation details">
            <label className="foundation-toggle">
              <input
                type="checkbox"
                checked={model.enabled}
                onChange={(e) => save({ ...model, enabled: e.target.checked })}
              />
              Include foundation in Materials
            </label>
            <p>
              Uses these solids instead of the old ground-base allowance. Shared concrete is counted
              once.
            </p>
            <label className="foundation-field">
              <span>Selected element</span>
              <select
                aria-label="Selected foundation"
                value={selectedId ?? ''}
                onChange={(e) => {
                  setSelectedId(e.target.value || null);
                  chooseTool('select');
                }}
              >
                <option value="">Choose or draw an element</option>
                {model.elements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <>
                <section className="foundation-stage" aria-label="Excavation and concrete stages">
                  <h2>
                    {selected.excavation
                      ? foundationIsFilled(selected)
                        ? '2 · Concrete added'
                        : '1 · Excavation'
                      : 'Concrete geometry'}
                  </h2>
                  {selected.excavation ? (
                    <>
                      <div className="foundation-grid-fields">
                        <Dimension
                          label="Excavation depth m"
                          value={selected.excavation.depthM}
                          min={0.01}
                          max={30}
                          onChange={(n) => updateExcavation({ depthM: n })}
                        />
                        <Dimension
                          label="Excavation top elevation m"
                          value={selected.excavation.topElevationM}
                          min={-30}
                          max={10}
                          onChange={(n) => updateExcavation({ topElevationM: n })}
                        />
                        <Dimension
                          label="Excavation margin each side m"
                          value={selected.excavation.marginM}
                          min={0}
                          max={20}
                          onChange={(n) => updateExcavation({ marginM: n })}
                        />
                      </div>
                      <p>
                        Hole bottom:{' '}
                        {fmt(selected.excavation.topElevationM - selected.excavation.depthM)} m.
                        Vertical sides are a quantity envelope; ground conditions and safe support
                        need project review.
                      </p>
                      <button
                        className="foundation-stage-action"
                        onClick={() =>
                          updateExcavation({
                            stage: foundationIsFilled(selected) ? 'excavated' : 'filled',
                          })
                        }
                      >
                        {foundationIsFilled(selected) ? 'Show excavation only' : 'Add concrete'}
                      </button>
                      <p>
                        These are design stages. Fill thickness sits at the hole bottom; changing
                        hole depth moves it with the bottom. No site completion or supplier order is
                        recorded.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Saved concrete is preserved. Add its measured excavation to inspect the hole
                        separately.
                      </p>
                      <button
                        onClick={() =>
                          update({
                            excavation: {
                              topElevationM: Math.max(0, selected.topElevationM),
                              depthM:
                                Math.max(0, selected.topElevationM) -
                                selected.topElevationM +
                                selected.depthM,
                              marginM: 0,
                              stage: 'filled',
                            },
                          })
                        }
                      >
                        Add excavation envelope
                      </button>
                    </>
                  )}
                </section>
                <div className="foundation-grid-fields">
                  {field('Length m', 'lengthM', 0.1, 1000)}
                  {field('Width m', 'widthM', 0.1, 1000)}
                  {field('Concrete depth m', 'depthM', 0.01, 10)}
                  {field('Top elevation m', 'topElevationM', -30, 10)}
                  {field('Centre X m', 'x', -10000, 10000)}
                  {field('Centre Y m', 'y', -10000, 10000)}
                </div>
                <p>
                  Top {fmt(selected.topElevationM)} m · underside{' '}
                  {fmt(selected.topElevationM - selected.depthM)} m relative to ground floor.
                  Starting dimensions are placeholders to replace with checked drawings.
                </p>
                <div className="foundation-actions">
                  <button aria-pressed={tool === 'move'} onClick={() => chooseTool('move')}>
                    Move element
                  </button>
                  <button
                    onClick={() => {
                      if (
                        save({
                          ...model,
                          elements: model.elements.filter((e) => e.id !== selected.id),
                        })
                      )
                        setSelectedId(null);
                    }}
                  >
                    Remove selected
                  </button>
                </div>
                <details>
                  <summary>Rebar schedule</summary>
                  <label className="foundation-toggle">
                    <input
                      type="checkbox"
                      checked={selected.rebar.enabled}
                      onChange={(e) => updateRebar({ enabled: e.target.checked })}
                    />
                    Include entered straight-bar mesh
                  </label>
                  <p>
                    Enter the engineer’s schedule. Thickness, cover, spacing and steel grade are not
                    designed by this tool.
                  </p>
                  <div className="foundation-grid-fields">
                    {rebarField('Bar diameter mm', 'diameterMm', 4, 50)}
                    {rebarField('Bar spacing mm', 'spacingMm', 10, 2000)}
                    {rebarField('Mesh layers', 'layers', 1, 10)}
                    {rebarField('Cover mm', 'coverMm', 0, 300)}
                    {rebarField('Stock length m', 'stockLengthM', 0.5, 30, 0.1)}
                    {rebarField('Lap length m', 'lapLengthM', 0, 10, 0.01)}
                    {rebarField('Steel allowance %', 'wastePct', 0, 100)}
                  </div>
                  <p>
                    <a
                      href="https://www.joonasco.com/steel-mauritius/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Joonas: high-tensile 8–32 mm
                    </a>{' '}
                    ·{' '}
                    <a href="https://www.kosto.mu/material-info/" target="_blank" rel="noreferrer">
                      Kosto: bars, mesh and bending schedules
                    </a>
                    . Confirm grade, availability and lengths. Links are supplier references.
                  </p>
                </details>
              </>
            ) : (
              <p>
                Choose Slab, Strip or Pad, then tap two corners. Numerical dimensions remain
                editable.
              </p>
            )}
            <details open>
              <summary>Concrete supply & ratio</summary>
              <label className="foundation-field">
                <span>Supply method</span>
                <select
                  value={settings.concrete.supply}
                  onChange={(e) => changeMix('supply', e.target.value)}
                >
                  <option value="ready-mix">Ready-mix · order by volume</option>
                  <option value="site-mix">Site-mix · estimate ingredients</option>
                </select>
              </label>
              {settings.concrete.supply === 'ready-mix' && (
                <label className="foundation-field">
                  <span>Concrete product reference</span>
                  <select
                    aria-label="Concrete product reference"
                    value={model.concreteProductId ?? ''}
                    onChange={(event) =>
                      save({
                        ...model,
                        concreteProductId: (event.target.value ||
                          undefined) as FoundationModel['concreteProductId'],
                      })
                    }
                  >
                    <option value="">Supplier / specification to confirm</option>
                    <option value="premix-classics">UBP / Premix · The Classics</option>
                    <option value="premix-pro">UBP / Premix · The Pro Series</option>
                  </select>
                </label>
              )}
              <div className="foundation-supplier">
                <strong>UBP / Premix · Mauritius</strong>
                <p>
                  <a
                    href="https://premix.mu/en/product-category/the-classics/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    The Classics
                  </a>{' '}
                  ·{' '}
                  <a
                    href="https://premix.mu/en/product-category/the-pro-series/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    The Pro Series
                  </a>
                </p>
                <p>
                  Product-family references checked 9 Oct 2026. Confirm the project grade, placement
                  requirements and quotation with the supplier; selecting a family never approves a
                  foundation or changes its ratio.
                </p>
                {settings.concrete.supply === 'site-mix' && (
                  <p>
                    <a
                      href="https://www.espacemaison.mu/shop/building-materials/structural-work-and-masonry/rocksand-and-macadams"
                      target="_blank"
                      rel="noreferrer"
                    >
                      UBP rocksand 0–4 and macadam references
                    </a>
                    . Granular grading is not the concrete mix ratio; confirm material suitability
                    and bulk density before purchasing.
                  </p>
                )}
              </div>
              <Dimension
                label="Concrete allowance %"
                value={settings.concrete.wastePct}
                min={0}
                max={100}
                step={1}
                onChange={(n) => changeMix('wastePct', n)}
              />
              {settings.concrete.supply === 'site-mix' && (
                <>
                  <p>
                    Loose dry-volume parts; shared with Materials for all concrete. A ratio is not a
                    strength class.
                  </p>
                  <div className="foundation-grid-fields">
                    {(['cement', 'sand', 'aggregate'] as const).map((key) => (
                      <Dimension
                        key={key}
                        label={`${key[0].toUpperCase()}${key.slice(1)} parts`}
                        value={settings.concrete[key]}
                        min={key === 'aggregate' ? 0 : 0.01}
                        max={100}
                        step={0.1}
                        onChange={(n) => changeMix(key, n)}
                      />
                    ))}
                    <Dimension
                      label="Dry volume factor"
                      value={settings.concrete.dryVolumeFactor}
                      min={1}
                      max={3}
                      onChange={(n) => changeMix('dryVolumeFactor', n)}
                    />
                  </div>
                  {estimate.mix && (
                    <p>
                      Foundation allocation: {fmt(estimate.mix.cementKg)} kg cement ·{' '}
                      {fmt(estimate.mix.sandM3)} m³ rocksand · {fmt(estimate.mix.aggregateM3)} m³
                      macadam. Final bag rounding is shared in Materials.
                    </p>
                  )}
                </>
              )}
            </details>
            {estimate.warnings.map((w) => (
              <p key={w} className="foundation-note">
                {w}
              </p>
            ))}
            <details>
              <summary>Project review & services</summary>
              <p>
                Soil investigation, loads and a professional foundation design determine the
                dimensions and reinforcement. Excavation support, blinding, membranes, drainage,
                sleeves and workmanship are separate schedules.
              </p>
              <p>
                Remaining measured excavation void: {fmt(estimate.remainingExcavationM3)} m³. This
                is not a backfill order: soil bulking, compaction, drainage and other layers are not
                inferred.
              </p>
              <p>
                <a
                  href="https://www.koloscement.com/media/lpolxoii/bat-sima_-guide-de-la-construction.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  Kolos construction guide
                </a>{' '}
                requires trial mixes and competent approval. No foundation preset certifies building
                compliance.
              </p>
              <button onClick={() => window.dispatchEvent(new Event('ppw:open-services'))}>
                Coordinate plumbing & electrics
              </button>
            </details>
          </aside>
        )}
      </div>
    </div>
  );
}
