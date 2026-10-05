import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  parsePlanFile,
  PLAN_IMPORT_LIMITS,
  PLAN_UNITS,
  reviewPlanImport,
  suggestPlanLayers,
  type PlanImportOptions,
  type PlanImportReview,
  type PlanImportSource,
  type PlanUnit,
} from '../designer/planImport';
import { validateDesignDraft, type DesignCatalogProduct } from '../designer/aiDesignContract';
import { designDraftToProperty } from '../designer/aiDesignProperty';
import { getAllProducts } from '../data/products';
import { useCatalogStore } from '../store/catalogStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useHistoryStore } from '../store/historyStore';
import { applyPage, createPage, flushCurrentPage } from '../lib/pages';
import { polygonArea } from '../lib/geometry';
import type { Property } from '../store/propertyStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import './planImport.css';

export function PlanImportButton({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  return (
    <button
      type="button"
      className="plan-import-trigger"
      title="Import a measured DXF, SVG or Designer draft"
      onClick={() => {
        onBeforeOpen?.();
        window.dispatchEvent(new CustomEvent('ppw:open-plan-import'));
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 17v-6m-3 3 3-3 3 3" />
      </svg>
      <span>Import plan</span>
    </button>
  );
}

/** A deliberately opaque full-screen task: no floating inspector obscures the house. */
export function PlanImportWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    const show = () => {
      before.current();
      useDesignerUIStore.getState().setTool('hand');
      useDesignerUIStore.getState().setEnergyPanelOpen(false);
      useDesignerUIStore.getState().setMaterialsPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
      window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
      setOpen(true);
    };
    const close = () => setOpen(false);
    window.addEventListener('ppw:open-plan-import', show);
    window.addEventListener('ppw:open-services', close);
    window.addEventListener('ppw:open-ai-design', close);
    if (new URLSearchParams(window.location.search).get('panel') === 'import') show();
    return () => {
      window.removeEventListener('ppw:open-plan-import', show);
      window.removeEventListener('ppw:open-services', close);
      window.removeEventListener('ppw:open-ai-design', close);
    };
  }, []);
  return open
    ? createPortal(<ImportWorkbench onClose={() => setOpen(false)} />, document.body)
    : null;
}

const EXAMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8000 6000"><g id="Ground rooms"><rect x="0" y="0" width="5000" height="4000"/><rect x="5000" y="0" width="3000" height="4000"/></g><g id="Upper rooms"><rect x="0" y="0" width="5000" height="4000"/></g></svg>';
function draftReview(property: Property, warnings: string[]): PlanImportReview {
  const rooms = property.rooms.filter((r) => r.kind !== 'roof'),
    points = rooms.flatMap((r) => r.polygon);
  return {
    property,
    warnings,
    roomCount: rooms.length,
    wallCount: property.walls?.length ?? 0,
    widthM: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    depthM: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
    areaM2: rooms.reduce((sum, r) => sum + polygonArea(r.polygon), 0),
  };
}

function ImportWorkbench({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null),
    revision = useRef(0),
    applying = useRef(false);
  const [source, setSource] = useState<PlanImportSource | null>(null),
    [jsonReview, setJsonReview] = useState<PlanImportReview | null>(null);
  const [options, setOptions] = useState<PlanImportOptions>({
    name: 'Imported plan',
    metresPerUnit: 0.001,
    wallHeightM: 2.7,
    wallThicknessM: 0.15,
    layers: [],
  });
  const [unit, setUnit] = useState<PlanUnit | 'custom'>('mm'),
    [reading, setReading] = useState(false),
    [error, setError] = useState(''),
    [ack, setAck] = useState(false),
    [floor, setFloor] = useState(0);
  const [reference, setReference] = useState('1000'),
    [realLength, setRealLength] = useState('1');
  const merchantProducts = useCatalogStore((s) => s.products);
  const catalog = useMemo<DesignCatalogProduct[]>(
    () =>
      [...getAllProducts(), ...merchantProducts].map((p) => ({
        id: p.id,
        name: p.name,
        supplier: p.supplier,
        category: p.category,
        widthM: p.dimensions_cm.length / 100,
        depthM: p.dimensions_cm.width / 100,
        heightM: p.dimensions_cm.height / 100,
        placement: p.placement ?? 'floor',
      })),
    [merchantProducts],
  );
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  useWorkspaceFocus(dialog, onClose);
  const result = useMemo<{ review: PlanImportReview | null; error: string }>(() => {
    if (jsonReview) return { review: jsonReview, error: '' };
    if (!source) return { review: null, error: '' };
    try {
      return { review: reviewPlanImport(source, options), error: '' };
    } catch (e) {
      return {
        review: null,
        error: e instanceof Error ? e.message : 'Review the drawing settings.',
      };
    }
  }, [source, options, jsonReview]);
  function change(next: Partial<PlanImportOptions>) {
    setOptions((o) => ({ ...o, ...next }));
    setAck(false);
    setError('');
  }
  function receive(name: string, text: string) {
    if (name.toLowerCase().endsWith('.json')) {
      const value: unknown = JSON.parse(text);
      const validated = validateDesignDraft(
        value && typeof value === 'object' && 'draft' in value
          ? (value as { draft: unknown }).draft
          : value,
        catalog,
      );
      if (!validated.ok)
        throw new Error(`Designer draft JSON: ${validated.errors.slice(0, 3).join(' ')}`);
      setJsonReview(
        draftReview(designDraftToProperty(validated.draft, catalog), validated.warnings),
      );
      setSource(null);
      setFloor(0);
      return;
    }
    const parsed = parsePlanFile(name, text);
    const selectedUnit = parsed.suggestedUnit ?? (parsed.metresPerUnit ? 'custom' : 'mm');
    setSource(parsed);
    setJsonReview(null);
    setUnit(selectedUnit);
    setFloor(0);
    const layers = suggestPlanLayers(parsed).map((l) => ({
      ...l,
      floor: /\bupper\b/i.test(l.name)
        ? 1
        : Math.min(11, Number(l.name.match(/\b(?:floor|level)[ _-]*(\d+)\b/i)?.[1] ?? 0)),
    }));
    setOptions({
      name: parsed.name,
      metresPerUnit:
        parsed.metresPerUnit ?? PLAN_UNITS[selectedUnit === 'custom' ? 'mm' : selectedUnit].metres,
      wallHeightM: 2.7,
      wallThicknessM: 0.15,
      layers,
    });
  }
  async function readFile(file?: File) {
    if (!file) return;
    const current = ++revision.current;
    setReading(false);
    setSource(null);
    setJsonReview(null);
    setAck(false);
    setError('');
    if (file.size > PLAN_IMPORT_LIMITS.bytes) {
      setError('Use a plan export smaller than 2 MB.');
      return;
    }
    if (!/\.(dxf|svg|json)$/i.test(file.name)) {
      setError(
        'Export a 2D plan as ASCII DXF or SVG. Native DWG, RVT, SKP, IFC, PDF and photo conversion is not supported.',
      );
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      if (current !== revision.current) return;
      receive(file.name, text);
    } catch (e) {
      if (current === revision.current)
        setError(e instanceof Error ? e.message : 'The file could not be read.');
    } finally {
      if (current === revision.current) setReading(false);
    }
  }
  function example() {
    revision.current++;
    setReading(false);
    setAck(false);
    setError('');
    receive('Two-storey example.svg', EXAMPLE);
  }
  function apply() {
    if (!result.review || !ack || applying.current) return;
    applying.current = true;
    try {
      const review = source ? reviewPlanImport(source, options) : result.review;
      createPage(review.property.name);
      applyPage({ property: review.property, walls: [], floorZones: [], wallTreatments: {} });
      flushCurrentPage();
      useHistoryStore.getState().reset();
      useDesignerUIStore.getState().setViewMode('plan');
      onClose();
    } catch (e) {
      applying.current = false;
      setError(
        e instanceof Error
          ? e.message
          : 'The plan could not be added. The previous page is preserved.',
      );
    }
  }
  const review = result.review;
  const previewLevels = review?.property.levels?.filter((l) => l.kind !== 'roof') ?? [];
  const previewFloor = Math.min(floor, Math.max(0, previewLevels.length - 1));
  const level = previewLevels[previewFloor];
  const rooms =
    review?.property.rooms.filter(
      (r) => r.kind !== 'roof' && (r.levelId ?? 'ground') === (level?.id ?? 'ground'),
    ) ?? [];
  const walls =
    review?.property.walls?.filter((w) => (w.levelId ?? 'ground') === (level?.id ?? 'ground')) ??
    [];
  const points = [...rooms.flatMap((r) => r.polygon), ...walls.flatMap((w) => [w.a, w.b])];
  const minX = Math.min(0, ...points.map((p) => p.x)),
    minY = Math.min(0, ...points.map((p) => p.y));
  const width = Math.max(1, ...points.map((p) => p.x)) - minX,
    depth = Math.max(1, ...points.map((p) => p.y)) - minY,
    padding = Math.max(width, depth) * 0.09;
  return (
    <div
      className="plan-import-page"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-import-title"
      data-testid="plan-import-workbench"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="plan-import-header">
        <button type="button" onClick={onClose} aria-label="Back to designer">
          ← <span>Designer</span>
        </button>
        <div>
          <small>BRING YOUR PLANS</small>
          <h1 id="plan-import-title">From drawing to editable space.</h1>
        </div>
        <span className="plan-import-private">On your device</span>
      </header>
      <main className="plan-import-layout">
        <section className="plan-import-settings" aria-label="Import settings">
          <div className="plan-import-intro">
            <span className="plan-import-step">01 / OPEN</span>
            <h2>Bring a measured plan</h2>
            <p>
              Use room boundaries or wall centre lines from your design software. Review the scale
              and floors, then build on the result in 2D and 3D.
            </p>
            <label className="plan-import-file">
              Choose DXF, SVG or draft JSON
              <input
                type="file"
                accept=".dxf,.svg,.json"
                aria-label="Choose plan file"
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="plan-import-help-row">
              <small>Up to 2 MB · processed locally</small>
              <button type="button" onClick={example}>
                Try an example
              </button>
            </div>
            {reading && <p role="status">Reading drawing…</p>}
          </div>
          <details className="plan-import-guidance">
            <summary>Export from your software</summary>
            <ul>
              <li>
                <strong>AutoCAD / CAD:</strong> ASCII DXF, model-space XY geometry. Export closed
                room polylines or straight wall centre lines. Explode blocks.
              </li>
              <li>
                <strong>Revit:</strong> export a floor plan as DXF; room/area boundaries as closed
                polylines. Native RVT is not read here.
              </li>
              <li>
                <strong>SketchUp:</strong> use Top view, Parallel Projection and Full Scale in 2D
                Graphic → DXF export (requires a suitable subscription). Native SKP and 3D meshes
                are not house-plan imports.
              </li>
              <li>
                <strong>SVG:</strong> static outlines with straight lines, polygons, rectangles and
                linear paths. Flatten styles and curves. Confirm the drawing scale, especially for
                paper exports.
              </li>
              <li>
                <strong>Designer JSON:</strong> version 1 proposals from AI design / PPW MCP,
                validated against the current catalogue.
              </li>
            </ul>
            <p>
              DWG, RVT, SKP, IFC, scanned images and PDF sheets need a supported plan export first.
              Furniture symbols, doors and windows are not automatically reconstructed from CAD
              lines.
            </p>
            <a
              href="https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-42C75024-4D71-4831-8910-2747168624A3.htm"
              target="_blank"
              rel="noreferrer"
            >
              Revit export guide ↗
            </a>
            {' · '}
            <a
              href="https://help.sketchup.com/en/sketchup/importing-and-exporting-cad-files"
              target="_blank"
              rel="noreferrer"
            >
              SketchUp export guide ↗
            </a>
          </details>
          {source && (
            <>
              <div className="plan-import-settings-card">
                <span className="plan-import-step">02 / SCALE</span>
                <label>
                  Plan name
                  <input
                    value={options.name}
                    maxLength={100}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </label>
                <div className="plan-import-fields">
                  <label>
                    Drawing units
                    <select
                      value={unit}
                      onChange={(e) => {
                        const next = e.target.value as PlanUnit | 'custom';
                        setUnit(next);
                        change({
                          metresPerUnit:
                            next === 'custom' ? options.metresPerUnit : PLAN_UNITS[next].metres,
                        });
                      }}
                    >
                      {Object.entries(PLAN_UNITS).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                      <option value="custom">Calibrated</option>
                    </select>
                  </label>
                  <label>
                    Metres / drawing unit
                    <input
                      aria-label="Metres per drawing unit"
                      type="number"
                      min="0.000000001"
                      step="any"
                      value={options.metresPerUnit}
                      onChange={(e) => {
                        setUnit('custom');
                        change({ metresPerUnit: Number(e.target.value) });
                      }}
                    />
                  </label>
                </div>
                <details>
                  <summary>Calibrate a known dimension</summary>
                  <p>Use a measured reference from the original drawing.</p>
                  <div className="plan-import-fields">
                    <label>
                      Distance in file units
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    <label>
                      Actual distance · m
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={realLength}
                        onChange={(e) => setRealLength(e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={!(Number(reference) > 0 && Number(realLength) > 0)}
                    onClick={() => {
                      setUnit('custom');
                      change({ metresPerUnit: Number(realLength) / Number(reference) });
                    }}
                  >
                    Use this calibration
                  </button>
                </details>
                <div className="plan-import-fields">
                  <label>
                    Wall height · m
                    <input
                      type="number"
                      min="2"
                      max="6"
                      step=".1"
                      value={options.wallHeightM}
                      onChange={(e) => change({ wallHeightM: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Free-wall thickness · m
                    <input
                      type="number"
                      min=".05"
                      max=".6"
                      step=".01"
                      value={options.wallThicknessM}
                      onChange={(e) => change({ wallThicknessM: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </div>
              <div className="plan-import-settings-card">
                <span className="plan-import-step">03 / LAYERS & FLOORS</span>
                <p>
                  Room boundaries must close. Wall layers should contain centre lines, not both
                  faces of each wall. Leave annotations and furniture off.
                </p>
                <div className="plan-import-layers">
                  {options.layers.map((layer, index) => (
                    <div className="plan-import-layer" key={layer.name}>
                      <strong title={layer.name}>
                        {layer.name}
                        <small>
                          {source.shapes.filter((s) => s.layer === layer.name).length} outlines /
                          runs
                        </small>
                      </strong>
                      <select
                        aria-label={`Import ${layer.name} as`}
                        value={layer.role}
                        onChange={(e) =>
                          change({
                            layers: options.layers.map((l, i) =>
                              i === index ? { ...l, role: e.target.value as typeof l.role } : l,
                            ),
                          })
                        }
                      >
                        <option value="skip">Skip layer</option>
                        <option value="rooms">Room boundaries</option>
                        <option value="walls">Wall centre lines</option>
                      </select>
                      <select
                        aria-label={`Floor for ${layer.name}`}
                        value={layer.floor}
                        disabled={layer.role === 'skip'}
                        onChange={(e) =>
                          change({
                            layers: options.layers.map((l, i) =>
                              i === index ? { ...l, floor: Number(e.target.value) } : l,
                            ),
                          })
                        }
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? 'Ground' : `Floor ${i}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {(error || result.error) && (
            <div className="plan-import-error" role="alert">
              {error || result.error}
            </div>
          )}
        </section>
        <section className="plan-import-review" aria-label="Plan import review">
          <div className="plan-import-review-heading">
            <div>
              <span className="plan-import-step">04 / REVIEW</span>
              <h2>{review?.property.name ?? 'A clear starting point.'}</h2>
            </div>
            {review && (
              <select
                aria-label="Import preview floor"
                value={previewFloor}
                onChange={(e) => setFloor(Number(e.target.value))}
              >
                {review.property.levels
                  ?.filter((l) => l.kind !== 'roof')
                  .map((l, i) => (
                    <option key={l.id} value={i}>
                      {l.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          {review ? (
            <>
              <div className="plan-import-map">
                <svg
                  viewBox={`${minX - padding} ${minY - padding} ${width + padding * 2} ${depth + padding * 2}`}
                  role="img"
                  aria-label="Imported geometry preview"
                >
                  {rooms
                    .filter((r) => r.polygon.length >= 3)
                    .map((room, i) => (
                      <polygon
                        key={room.id}
                        points={room.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill={i % 2 ? '#e1d5ba' : '#bed4c8'}
                        stroke="#53675f"
                        strokeWidth={Math.max(0.06, width / 200)}
                        strokeLinejoin="round"
                      />
                    ))}
                  {walls.map((w) => (
                    <line
                      key={w.id}
                      x1={w.a.x}
                      y1={w.a.y}
                      x2={w.b.x}
                      y2={w.b.y}
                      stroke="#98703e"
                      strokeWidth={w.thicknessM}
                      strokeLinecap="square"
                    />
                  ))}
                </svg>
                <div className="plan-import-map-caption">
                  <span>Measured geometry</span>
                  <span>
                    {width.toFixed(2)} × {depth.toFixed(2)} m
                  </span>
                </div>
              </div>
              <div className="plan-import-facts">
                <span>
                  <strong>{review.roomCount}</strong> rooms
                </span>
                <span>
                  <strong>{review.wallCount}</strong> free walls
                </span>
                <span>
                  <strong>{review.areaM2.toFixed(1)} m²</strong> room area
                </span>
              </div>
              <details
                className="plan-import-notes"
                open={review.warnings.some((w) => /skipped|not converted/i.test(w))}
              >
                <summary>What transfers & what needs review</summary>
                <ul>
                  {review.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </details>
              <label className="plan-import-ack">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I
                checked the real-world dimensions, selected layers and floor alignment. This is an
                editable plan; construction and services need professional review.
              </label>
              <button
                type="button"
                className="plan-import-primary"
                disabled={!ack || reading}
                onClick={apply}
              >
                Add as a new plan <span aria-hidden="true">→</span>
              </button>
              <p className="plan-import-preserved">
                Your current design stays saved as a separate plan.
              </p>
            </>
          ) : (
            <div className="plan-import-empty">
              <svg viewBox="0 0 180 150" aria-hidden="true">
                <path d="M30 35h75v30h45v65H30z" fill="#cad9ca" stroke="#637d6d" strokeWidth="4" />
                <path d="M30 85h75m0-50v95m0-35h45" fill="none" stroke="#637d6d" strokeWidth="3" />
                <path
                  d="M18 35v95m-5-95h10m-10 95h10M30 143h120"
                  stroke="#b59666"
                  strokeWidth="2"
                />
              </svg>
              <h3>Your drawing, with its scale intact.</h3>
              <p>
                Choose a file to review the editable room and wall geometry before it reaches your
                canvas.
              </p>
              <span>Open → Check → Continue designing</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
