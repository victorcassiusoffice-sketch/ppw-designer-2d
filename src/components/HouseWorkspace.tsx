import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCart } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { formatCurrency } from '../lib/currency';
import { PRECISION_STEP_M, useDesignerUIStore } from '../store/designerUIStore';
import { useHistoryStore } from '../store/historyStore';
import { usePropertyStore } from '../store/propertyStore';
import { activeLevelIdOf, isOutdoorRoom, isRoofRoom, levelsOf, isRoofLevel } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import type { BuildingControlsProps } from './BuildingControls';
import { HouseCostPanel } from './HouseCostPanel';
import { isShowcaseReadOnly, DEMO_NOTICE } from '../lib/showcaseSafety';
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
export function HouseWorkspace({ mode, onMode, onPlan, onSave, onCart, children, inspector, externalPanel, drawing, onDraw, onSelect, wallDrawing = false, onWalls, selection, buildTool = 'select', onBuildTool, onFloorAdded }: {
  mode: HouseMode; onMode: (mode: HouseMode) => void; onPlan?: () => void; onSave?: () => void; onCart?: () => void;
  children: ReactNode; inspector: ReactNode; externalPanel: boolean; drawing: boolean;
  onDraw: () => void; onSelect: () => void;
  wallDrawing?: boolean; onWalls?: () => void;
  selection?: { id: string; name: string; productId?: string; onDeselect: () => void };
  buildTool?: BuildingControlsProps['tool']; onBuildTool?: BuildingControlsProps['onToolChange']; onFloorAdded?: () => void;
}) {
  const cart = useCart();
  const readOnly = isShowcaseReadOnly();
  const currency = useCurrencyStore((s) => s.currency);
  const precision = useDesignerUIStore((s) => s.precision);
  const property = usePropertyStore((s) => s.property);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const panelOpen = mobileInspector || costOpen;
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = () => { setMobileInspector(false); setCostOpen(false); };
    window.addEventListener('ppw:close-house-details', close);
    return () => window.removeEventListener('ppw:close-house-details', close);
  }, []);
  useEffect(() => {
    if (!panelOpen) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || inspectorRef.current?.contains(target) || target.closest('.house-details-button, .house-checkout-toggle, .house-selection-strip, .house-rail, [data-testid="wallpaint-3d-canvas"]')) return;
      setMobileInspector(false); setCostOpen(false);
    };
    const scene = (event: Event) => { setMobileInspector(false); setCostOpen(false); event.preventDefault(); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('ppw:house-scene-pointer', scene);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('ppw:house-scene-pointer', scene); };
  }, [panelOpen]);
  useEffect(() => {
    if (selection?.productId) { setCostOpen(true); setMobileInspector(false); }
  }, [selection?.id, selection?.productId]);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const rooms = property.rooms.filter((r) => isDrawnPolygon(r.polygon) && !isOutdoorRoom(r) && !isRoofRoom(r));
  const current = activeLevelIdOf(property);
  const levelName = property.levels?.find((l) => l.id === current)?.name ?? 'Ground';
  const totalArea = rooms.reduce((sum, room) => sum + area(room.polygon), 0);
  const name = property.name || 'My house';
  const levels = levelsOf(property);
  const onRoof = levels.some(level => level.id === current && isRoofLevel(level));
  const canUseStairs = !onRoof && levels.filter(level => !isRoofLevel(level)).length > 1;
  function selectFloor(id: string) {
    setMobileInspector(false); setCostOpen(false); onSelect();
    const store = usePropertyStore.getState();
    if (id === '__add-floor') {
      const storeys = levels.filter(level => !isRoofLevel(level));
      const source = onRoof ? storeys[storeys.length - 1]?.id : current;
      store.addLevel(undefined, source);
      onFloorAdded?.();
    } else store.setActiveLevel(id === '__roof' ? store.ensureRoofLevel() : id);
  }
  function toggleCost() {
    useDesignerUIStore.getState().setTool('hand');
    useDesignerUIStore.getState().setEnergyPanelOpen(false);
    setMobileInspector(false); setCostOpen(!costOpen);
    window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
    window.dispatchEvent(new CustomEvent('ppw:close-view-settings'));
  }
  return <div className="house-workspace">
    <header className="house-header">
      <div className="house-brand" aria-label="PPW House Studio"><span className="house-mark">P</span><div><strong>{readOnly ? 'DEMO' : 'HOUSE STUDIO'}</strong><span title={readOnly ? DEMO_NOTICE : name}>{readOnly ? 'Preview · no orders' : name}</span></div></div>
      <div className="house-view-switch" aria-label="Design view"><button onClick={onPlan}>2D Plan</button><button aria-pressed="true">3D House</button></div>
      <div className="house-project-actions">
        <button title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => useHistoryStore.getState().undo()}>↶</button>
        <button title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={() => useHistoryStore.getState().redo()}>↷</button>
        {onCart && <button className="house-cart house-checkout-toggle" title={readOnly ? 'Products and estimate' : 'Products, cost and checkout'} aria-label="Products and cost" aria-expanded={costOpen} onClick={toggleCost}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 7 9-4 9 4v11l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v11M7.5 5 9 4l9 4v5" /></svg><span className="house-cart-count">{cart.totalItemCount}</span></button>}
        {onSave && <button className="house-save" onClick={onSave}>Save</button>}
        <button title={readOnly ? 'Save locally, load and project tools' : 'Save, load, quote and project tools'} aria-label="Project tools" onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-menu'))}>•••</button>
      </div>
    </header>
    <div className="house-main">
      <nav className="house-rail" aria-label="House design tools">
        {MODES.map(([id, label, path]) => <button key={id} type="button" aria-pressed={mode === id} title={label} onClick={() => { setCostOpen(false); const nextOpen = id === 'garden' || id === 'build' || id === 'energy'; onMode(id); setMobileInspector(nextOpen && !(mobileInspector && mode === id)); window.dispatchEvent(new CustomEvent('ppw:close-view-settings')); }} data-testid={`house-mode-${id}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg><span>{label}</span>
        </button>)}
      </nav>
      <div className="house-scene-column">
        <div className="house-scene-bar">
          <div className="house-floor-picker"><span className="house-status-dot" /><strong className="sr-only">{levelName}</strong><select aria-label="View floor" value={current} onChange={event => selectFloor(event.target.value)}>
            {levelsOf(property).map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
            {!levels.some(isRoofLevel) && <option value="__roof">Roof</option>}
            <option value="__add-floor">＋ Add floor</option>
          </select><span className="house-scene-label">{drawing || wallDrawing ? `Snap ${PRECISION_STEP_M[precision]} m` : `${totalArea.toFixed(1)} m²`}</span></div>
          <button type="button" className="house-cost-pill house-checkout-toggle" onClick={toggleCost} aria-label={`Product estimate ${formatCurrency(cart.subtotal, currency)}. Open products and cost`} aria-expanded={costOpen}><span>Estimate</span><strong>{formatCurrency(cart.subtotal, currency)}</strong></button>
          <div className="house-scene-actions">
            <button aria-pressed={!drawing && !wallDrawing && buildTool === 'select'} onClick={onSelect}>Select</button>
            {onWalls && <button disabled={onRoof} aria-pressed={wallDrawing} onClick={() => { setMobileInspector(false); onWalls(); }} data-testid="house-draw-walls">Walls</button>}
            <button disabled={onRoof} aria-pressed={drawing} onClick={() => { setMobileInspector(false); onDraw(); }} data-testid="house-draw-room">▱ <span>Draw room</span></button>
            {!externalPanel && <button className="house-details-button" aria-expanded={mobileInspector} onClick={() => { setCostOpen(false); setMobileInspector(!mobileInspector); window.dispatchEvent(new CustomEvent('ppw:close-catalog')); window.dispatchEvent(new CustomEvent('ppw:close-view-settings')); }}>Details</button>}
          </div>
        </div>
        {onBuildTool && mode === 'build' && <div className="house-opening-tools" role="group" aria-label="Doors windows and stairs">
          {(['door', 'window', 'stair'] as const).map(tool => <button key={tool} type="button" aria-pressed={buildTool === tool} disabled={onRoof || (tool === 'stair' && !canUseStairs)} title={tool === 'stair' && !canUseStairs ? 'Add another floor first' : undefined} onClick={() => { setCostOpen(false); setMobileInspector(false); onBuildTool(buildTool === tool ? 'select' : tool); }}>{tool === 'door' ? 'Door' : tool === 'window' ? 'Window' : 'Stairs'}</button>)}
          <span>{onRoof ? 'Choose a floor to add openings' : buildTool === 'door' || buildTool === 'window' ? `Tap a wall to add a ${buildTool}` : buildTool === 'stair' ? 'Tap clear floor space to place stairs' : !canUseStairs ? 'Add floor for stairs' : 'Build on the selected floor'}</span>
          {buildTool !== 'select' && buildTool !== 'wall' && buildTool !== 'room' && <button type="button" onClick={() => onBuildTool('select')}>Done</button>}
        </div>}
        {selection && <div className="house-selection-strip" data-testid="house-selection-strip">
          <span><small>SELECTED</small><strong>{selection.name}</strong></span>
          {selection.productId && <button type="button" onClick={toggleCost} aria-expanded={costOpen}>Product details</button>}
          <button type="button" onClick={() => { setCostOpen(false); setMobileInspector(!mobileInspector); }} aria-expanded={mobileInspector}>Edit item</button>
          <button type="button" aria-label="Clear selected item" title="Deselect item" onClick={() => { setMobileInspector(false); setCostOpen(false); selection.onDeselect(); }}>×</button>
        </div>}
        {children}
      </div>
      {(!externalPanel || costOpen) && <aside ref={inspectorRef} className={`house-inspector ${panelOpen ? 'is-open' : ''}`} aria-label="House details">
        <div className="house-summary">
          <div className="house-eyebrow">{costOpen ? 'PRODUCTS & COST' : selection ? 'ITEM OPTIONS' : 'HOME TOOLS'}<button className="house-close-details" aria-label="Close house details" onClick={() => { setMobileInspector(false); setCostOpen(false); }}>Close ×</button></div>
          <h2>{costOpen ? 'Your design basket' : selection ? 'Selected item' : mode === 'energy' ? 'Solar & energy' : mode === 'garden' ? 'Garden & outdoors' : 'Build your home'}</h2><p>{costOpen ? 'Catalog products and measured finishes' : selection ? 'Drag the item in your design to move it' : mode === 'garden' ? 'Shape the space around your home' : 'Rooms, walls, floors, openings and roof'}</p>
          {!selection && <div className="house-metrics"><div><strong>{totalArea.toFixed(1)}</strong><span>m² floor area</span></div><div><strong>{rooms.length}</strong><span>rooms</span></div><div><strong>{levelsOf(property).filter((l) => !isRoofLevel(l)).length}</strong><span>floors</span></div></div>}
        </div>
        <div className="house-inspector-content">{costOpen ? <HouseCostPanel productId={selection?.productId} onCart={onCart} onEdit={selection ? () => { setCostOpen(false); setMobileInspector(true); } : undefined} /> : inspector}</div>
        {!costOpen && <div className="house-inspector-foot"><div className="house-estimate"><span>Product estimate</span><strong>{formatCurrency(cart.subtotal, currency)}</strong></div><p>From the products and finishes in your plan.</p>{onCart && <button className="house-estimate-button" onClick={onCart}>View products & quantities ↗</button>}</div>}
      </aside>}
    </div>
  </div>;
}
