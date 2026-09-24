import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCart } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { formatCurrency } from '../lib/currency';
import { PRECISION_STEP_M, useDesignerUIStore } from '../store/designerUIStore';
import { useHistoryStore } from '../store/historyStore';
import { usePropertyStore } from '../store/propertyStore';
import { activeLevelIdOf, isOutdoorRoom, isRoofRoom, levelsOf, isRoofLevel } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import './houseWorkspace.css';

export type HouseMode = 'build' | 'furnish' | 'paint' | 'floor' | 'garden' | 'energy';
const MODES: Array<[HouseMode, string, string]> = [
  ['build', 'Build', 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7'],
  ['furnish', 'Furnish', 'M4 13V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6M3 12h3v5h12v-5h3v8H3v-8ZM5 20v2m14-2v2'],
  ['paint', 'Paint', 'M4 3h13v7H4V3Zm13 3h3v8H11v7'],
  ['floor', 'Surfaces', 'm3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5'],
  ['garden', 'Garden', 'M12 21v-9M12 15C4 15 3 9 4 5c5 0 8 3 8 7M12 12c0-6 4-9 9-9 0 6-3 10-9 10M6 21h12'],
  ['energy', 'Solar', 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z'],
];

function area(points: { x: number; y: number }[]) {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
}

/** The architectural workspace uses the same property, catalog and history as Plan. */
export function HouseWorkspace({ mode, onMode, onPlan, onSave, onCart, children, inspector, externalPanel, drawing, onDraw, onSelect, wallDrawing = false, onWalls, selection }: {
  mode: HouseMode; onMode: (mode: HouseMode) => void; onPlan?: () => void; onSave?: () => void; onCart?: () => void;
  children: ReactNode; inspector: ReactNode; externalPanel: boolean; drawing: boolean;
  onDraw: () => void; onSelect: () => void;
  wallDrawing?: boolean; onWalls?: () => void;
  selection?: { id: string; name: string; onDeselect: () => void };
}) {
  const cart = useCart();
  const currency = useCurrencyStore((s) => s.currency);
  const precision = useDesignerUIStore((s) => s.precision);
  const property = usePropertyStore((s) => s.property);
  const [mobileInspector, setMobileInspector] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = () => setMobileInspector(false);
    window.addEventListener('ppw:close-house-details', close);
    return () => window.removeEventListener('ppw:close-house-details', close);
  }, []);
  useEffect(() => {
    if (!mobileInspector) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || inspectorRef.current?.contains(target) || target.closest('.house-details-button, .house-selection-strip, .house-rail, [data-testid="wallpaint-3d-canvas"]')) return;
      setMobileInspector(false);
    };
    const scene = (event: Event) => { setMobileInspector(false); event.preventDefault(); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('ppw:house-scene-pointer', scene);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('ppw:house-scene-pointer', scene); };
  }, [mobileInspector]);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const rooms = property.rooms.filter((r) => isDrawnPolygon(r.polygon) && !isOutdoorRoom(r) && !isRoofRoom(r));
  const current = activeLevelIdOf(property);
  const levelName = property.levels?.find((l) => l.id === current)?.name ?? 'Ground';
  const totalArea = rooms.reduce((sum, room) => sum + area(room.polygon), 0);
  const name = property.name || 'My house';
  return <div className="house-workspace">
    <header className="house-header">
      <div className="house-brand" aria-label="PPW House Studio"><span className="house-mark">P</span><div><strong>HOUSE STUDIO</strong><span>{name}</span></div></div>
      <div className="house-view-switch" aria-label="Design view"><button onClick={onPlan}>2D Plan</button><button aria-pressed="true">3D House</button></div>
      <div className="house-project-actions">
        <button title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => useHistoryStore.getState().undo()}>↶</button>
        <button title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={() => useHistoryStore.getState().redo()}>↷</button>
        {onCart && <button className="house-cart" title="View cart" aria-label="View cart" onClick={onCart}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 4h2l3 12h11l2-9H6M9 21h.01M18 21h.01" /></svg></button>}
        {onSave && <button className="house-save" onClick={onSave}>Save</button>}
        <button title="Save, load, quote and project tools" aria-label="Project tools" onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-menu'))}>•••</button>
      </div>
    </header>
    <div className="house-main">
      <nav className="house-rail" aria-label="House design tools">
        {MODES.map(([id, label, path]) => <button key={id} type="button" aria-pressed={mode === id} title={label} onClick={() => { const nextOpen = id === 'garden' || id === 'build' || id === 'energy'; onMode(id); setMobileInspector(nextOpen && !(mobileInspector && mode === id)); window.dispatchEvent(new CustomEvent('ppw:close-view-settings')); }} data-testid={`house-mode-${id}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg><span>{label}</span>
        </button>)}
      </nav>
      <div className="house-scene-column">
        <div className="house-scene-bar">
          <div className="house-floor-picker"><span className="house-status-dot" /><strong className="sr-only">{levelName}</strong><select aria-label="View floor" value={current} onChange={event => { onSelect(); usePropertyStore.getState().setActiveLevel(event.target.value); }}>
            {levelsOf(property).map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
          </select><span className="house-scene-label">{drawing || wallDrawing ? `Snap ${PRECISION_STEP_M[precision]} m` : `${totalArea.toFixed(1)} m²`}</span></div>
          <div className="house-scene-actions">
            <button aria-pressed={!drawing && !wallDrawing} onClick={onSelect}>Select</button>
            {onWalls && <button aria-pressed={wallDrawing} onClick={() => { setMobileInspector(false); onWalls(); }} data-testid="house-draw-walls">Walls</button>}
            <button aria-pressed={drawing} onClick={() => { setMobileInspector(false); onDraw(); }} data-testid="house-draw-room">▱ <span>Draw room</span></button>
            {!externalPanel && <button className="house-details-button" aria-expanded={mobileInspector} onClick={() => { setMobileInspector(!mobileInspector); window.dispatchEvent(new CustomEvent('ppw:close-catalog')); window.dispatchEvent(new CustomEvent('ppw:close-view-settings')); }}>Details</button>}
          </div>
        </div>
        {selection && <div className="house-selection-strip" data-testid="house-selection-strip">
          <span><small>SELECTED</small><strong>{selection.name}</strong></span>
          <button type="button" onClick={() => setMobileInspector(!mobileInspector)} aria-expanded={mobileInspector}>Edit item</button>
          <button type="button" aria-label="Clear selected item" title="Deselect item" onClick={() => { setMobileInspector(false); selection.onDeselect(); }}>×</button>
        </div>}
        {children}
      </div>
      {!externalPanel && <aside ref={inspectorRef} className={`house-inspector ${mobileInspector ? 'is-open' : ''}`} aria-label="House details">
        <div className="house-summary">
          <div className="house-eyebrow">{selection ? 'ITEM OPTIONS' : 'HOME TOOLS'}<button className="house-close-details" aria-label="Close house details" onClick={() => setMobileInspector(false)}>Close ×</button></div>
          <h2>{selection ? 'Selected item' : mode === 'energy' ? 'Solar & energy' : mode === 'garden' ? 'Garden & outdoors' : 'Build your home'}</h2><p>{selection ? 'Drag the item in your design to move it' : mode === 'garden' ? 'Shape the space around your home' : 'Rooms, walls, floors, openings and roof'}</p>
          {!selection && <div className="house-metrics"><div><strong>{totalArea.toFixed(1)}</strong><span>m² floor area</span></div><div><strong>{rooms.length}</strong><span>rooms</span></div><div><strong>{levelsOf(property).filter((l) => !isRoofLevel(l)).length}</strong><span>floors</span></div></div>}
        </div>
        <div className="house-inspector-content">{inspector}</div>
        <div className="house-inspector-foot"><div className="house-estimate"><span>Product estimate</span><strong>{formatCurrency(cart.subtotal, currency)}</strong></div><p>From the products and finishes in your plan.</p>{onCart && <button className="house-estimate-button" onClick={onCart}>View products & quantities ↗</button>}</div>
      </aside>}
    </div>
  </div>;
}
