import { quoteAwareAmount } from '../lib/quotedProducts';
import { ServicesLaunchButton } from './ServicesWorkspace';
import { FoundationLaunchButton } from './FoundationWorkspace';
import { PlanImportButton } from './PlanImportWorkspace';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCart } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { formatCurrency } from '../lib/currency';
import { isPitchEmbed } from '../demo/pitchEmbed';
import { PRECISION_STEP_M, useDesignerUIStore } from '../store/designerUIStore';
import { useHistoryStore } from '../store/historyStore';
import { usePropertyStore } from '../store/propertyStore';
import { activeLevelIdOf, isOutdoorRoom, isRoofRoom, levelsOf, isRoofLevel } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import type { BuildingControlsProps } from './BuildingControls';
import { HouseCostPanel } from './HouseCostPanel';
import { ClearControls } from './ClearControls';
import { AiDesignButton } from './AiDesignWorkspace';
import { isShowcaseReadOnly, DEMO_NOTICE } from '../lib/showcaseSafety';
import { DOOR_WIDTHS_M } from '../designer/openings';
import { StudioIcon, type StudioIconName } from './StudioIcon';
import './houseWorkspace.css';

export type HouseMode = 'build' | 'furnish' | 'paint' | 'floor' | 'garden' | 'energy' | 'materials';
const MODES: Array<[HouseMode, string, StudioIconName]> = [
  ['build', 'Build', 'room'], ['furnish', 'Furnish', 'furnish'],
  ['paint', 'Paint', 'roller'], ['floor', 'Surfaces', 'storeys'],
  ['garden', 'Garden', 'garden'], ['materials', 'Materials', 'materials'],
  ['energy', 'Solar', 'bolt'],
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
  const doorDraft = useDesignerUIStore((s) => s.doorDraft);
  const property = usePropertyStore((s) => s.property);
  const foundationView = useDesignerUIStore(s => s.foundationView);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [buildPaletteOpen, setBuildPaletteOpen] = useState(false);
  const panelOpen = mobileInspector || costOpen;
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = () => { setMobileInspector(false); setCostOpen(false); };
    const open = () => { setMobileInspector(true); setCostOpen(false); };
    window.addEventListener('ppw:close-house-details', close);
    window.addEventListener('ppw:show-house-details', open);
    return () => { window.removeEventListener('ppw:close-house-details', close); window.removeEventListener('ppw:show-house-details', open); };
  }, []);
  useEffect(() => {
    if (!panelOpen) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || inspectorRef.current?.contains(target) || target.closest('.house-details-button, .house-checkout-toggle, .house-selection-strip, .house-rail, [data-testid="wallpaint-3d-canvas"]')) return;
      setMobileInspector(false); setCostOpen(false);
    };
    const scene = (event: Event) => {
      const position = inspectorRef.current ? getComputedStyle(inspectorRef.current).position : '';
      // A dock beside/below the scene must not swallow the next editing
      // gesture. An overlay still consumes the click that dismisses it.
      setMobileInspector(false); setCostOpen(false);
      if (position === 'absolute' || position === 'fixed') event.preventDefault();
    };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('ppw:house-scene-pointer', scene);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('ppw:house-scene-pointer', scene); };
  }, [panelOpen]);
  useEffect(() => {
    setCostOpen(false); setMobileInspector(false);
  }, [selection?.id, selection?.productId]);
  useEffect(() => { if (mode === 'materials') { setMobileInspector(true); setCostOpen(false); } }, [mode]);
  useEffect(() => { if (drawing || wallDrawing || buildTool !== 'select') setBuildPaletteOpen(true); }, [drawing, wallDrawing, buildTool]);
  useEffect(() => {
    if (!buildPaletteOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setBuildPaletteOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [buildPaletteOpen]);

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
    if (id === '__foundation') { onSelect(); window.dispatchEvent(new Event('ppw:open-foundation')); return; }
    useDesignerUIStore.getState().setFoundationView(false);
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
    useDesignerUIStore.getState().setMaterialsPanelOpen(false);
    setMobileInspector(false); setCostOpen(!costOpen);
    window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
    window.dispatchEvent(new CustomEvent('ppw:close-view-settings'));
  }
  return <div className="house-workspace" data-build-open={buildPaletteOpen}>
    <header className="house-header">
      <div className="house-brand" aria-label="PPW House Studio"><span className="house-mark"><StudioIcon name="room" /></span><div><strong>{readOnly ? 'DEMO' : 'HOUSE STUDIO'}</strong><span title={readOnly ? DEMO_NOTICE : name}>{readOnly ? 'Preview · no orders' : name}</span></div></div>
      <div className="house-view-switch" aria-label="Design view"><button onClick={onPlan} aria-label="2D Plan"><StudioIcon name="box" size={18} /><span>2D <span className="studio-view-word">Plan</span></span></button><button aria-label="3D House" aria-pressed="true"><StudioIcon name="cube" size={18} /><span>3D <span className="studio-view-word">House</span></span></button></div>
      <div className="house-project-actions">
        <AiDesignButton onBeforeOpen={onSelect} />
        <PlanImportButton onBeforeOpen={onSelect} />
        <ClearControls inline />
        <button title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => useHistoryStore.getState().undo()}><StudioIcon name="undo" size={18} /></button>
        <button title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={!canRedo} onClick={() => useHistoryStore.getState().redo()}><StudioIcon name="redo" size={18} /></button>
        {onCart && <button className="house-cart house-checkout-toggle" title={readOnly ? 'Products and estimate' : 'Products, cost and checkout'} aria-label="Products and cost" aria-expanded={costOpen} onClick={toggleCost}><StudioIcon name="cart" size={20} /><span className="house-cart-count">{cart.totalItemCount}</span></button>}
        {onSave && <button className="house-save" onClick={onSave}>Save</button>}
        <button title={readOnly ? 'Save locally, load and project tools' : 'Save, load, quote and project tools'} aria-label="Project tools" onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-menu'))}><StudioIcon name="more" /></button>
      </div>
    </header>
    <div className="house-main">
      <nav className="house-rail" aria-label="House design tools">
        <FoundationLaunchButton onBeforeOpen={onSelect} />
        {property.foundation?.enabled && <button type="button" aria-label="Foundation cutaway" aria-pressed={foundationView} onClick={() => useDesignerUIStore.getState().setFoundationView(!foundationView)}><StudioIcon name="storeys" /><span>{foundationView ? 'Restore ground' : 'Below ground'}</span></button>}
        {MODES.map(([id, label, icon]) => <button key={id} type="button" aria-pressed={mode === id} title={label} onClick={() => { setCostOpen(false); const nextOpen = id === 'garden' || id === 'energy' || id === 'materials'; onMode(id); setBuildPaletteOpen(id === 'build' && !(buildPaletteOpen && mode === 'build')); setMobileInspector(nextOpen && !(mobileInspector && mode === id)); window.dispatchEvent(new CustomEvent('ppw:close-view-settings')); }} data-testid={`house-mode-${id}`}>
          <StudioIcon name={icon} /><span>{label}</span>
        </button>)}
      </nav>
      <div className="house-scene-column">
        <div className="house-scene-bar">
          <div className="house-floor-picker"><span className="house-status-dot" /><strong className="sr-only">{levelName}</strong><select aria-label="View floor" value={current} onChange={event => selectFloor(event.target.value)}>
            {levelsOf(property).map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
            {!levels.some(isRoofLevel) && <option value="__roof">Roof</option>}
            <option value="__add-floor">＋ Add floor</option>
            <option value="__foundation">Foundation</option>
          </select><ServicesLaunchButton compact onBeforeOpen={onSelect} /><span className="house-scene-label">{drawing || wallDrawing ? `Snap ${PRECISION_STEP_M[precision]} m` : `${totalArea.toFixed(1)} m²`}</span></div>
          {!isPitchEmbed() && <button type="button" className="house-cost-pill house-checkout-toggle" onClick={toggleCost} aria-label={`Product estimate ${quoteAwareAmount(cart, cart.subtotal, formatCurrency(cart.subtotal, currency))}. Open products and cost`} aria-expanded={costOpen}><span>Estimate</span><strong>{quoteAwareAmount(cart, cart.subtotal, formatCurrency(cart.subtotal, currency))}</strong></button>}
          <div className="house-quick-tools"><button type="button" aria-label="Select and move objects" aria-pressed={!drawing && !wallDrawing && buildTool === 'select'} onClick={() => { onSelect(); setBuildPaletteOpen(false); }}><StudioIcon name="cursor" size={18} /></button><button type="button" aria-label="Build tools" aria-controls="house-build-palette" aria-expanded={buildPaletteOpen} onClick={() => { onMode('build'); setBuildPaletteOpen(!buildPaletteOpen); setMobileInspector(false); }}><StudioIcon name="room" size={18} /><span>Build</span></button></div>
          <div id="house-build-palette" className="house-scene-actions">
            <button aria-pressed={!drawing && !wallDrawing && buildTool === 'select'} onClick={onSelect}><StudioIcon name="cursor" size={18} /><span>Select</span></button>
            {onWalls && <button disabled={onRoof} aria-pressed={wallDrawing} onClick={() => { setMobileInspector(false); onWalls(); }} data-testid="house-draw-walls"><StudioIcon name="pen" size={18} /><span>Walls</span></button>}
            <button disabled={onRoof} aria-pressed={drawing} onClick={() => { setMobileInspector(false); onDraw(); }} data-testid="house-draw-room"><StudioIcon name="box" size={18} /><span>Draw room</span></button>
            {onBuildTool && mode === 'build' && <div className="house-opening-tools" role="group" aria-label="Doors windows and stairs" data-active-tool={buildTool}>
              {(['door', 'window', 'stair'] as const).map(tool => <button key={tool} type="button" aria-pressed={buildTool === tool} disabled={onRoof || (tool === 'stair' && !canUseStairs)} title={tool === 'stair' && !canUseStairs ? 'Add another floor first' : undefined} onClick={() => { setCostOpen(false); setMobileInspector(false); onBuildTool(buildTool === tool ? 'select' : tool); }}><StudioIcon name={tool} size={18} /><span>{tool === 'door' ? 'Door' : tool === 'window' ? 'Window' : 'Stairs'}</span></button>)}
              <span>{onRoof ? 'Choose a floor to add openings' : buildTool === 'door' || buildTool === 'window' ? 'Slide along a wall · release to place · repeat or Done' : buildTool === 'stair' ? 'Tap clear floor space to place stairs' : !canUseStairs ? 'Add floor for stairs' : 'Build on the selected floor'}</span>
              {buildTool !== 'select' && buildTool !== 'wall' && buildTool !== 'room' && <button type="button" onClick={() => onBuildTool('select')}>Done</button>}
            </div>}
            {!externalPanel && <button className="house-details-button" aria-expanded={mobileInspector} onClick={() => { setCostOpen(false); setMobileInspector(!mobileInspector); window.dispatchEvent(new CustomEvent('ppw:close-catalog')); window.dispatchEvent(new CustomEvent('ppw:close-view-settings')); }}>Details</button>}
          </div>
        </div>
        {onBuildTool && (buildTool === 'door' || buildTool === 'window') && <div className="house-opening-options" role="group" aria-label="Opening placement options">
          <label>Width <select aria-label="Opening width" value={doorDraft.widthM} onChange={event => useDesignerUIStore.getState().setDoorDraft({ widthM: Number(event.target.value) })}>
            {[...new Set([...(buildTool === 'window' ? [0.6, 0.9, 1.2, 1.5, 1.8, 2.4] : DOOR_WIDTHS_M), doorDraft.widthM])].sort((a, b) => a - b).map(width => <option key={width} value={width}>{width} m</option>)}
          </select></label>
          {buildTool === 'door' && <><button type="button" aria-pressed={doorDraft.flipFacing} onClick={() => useDesignerUIStore.getState().toggleDoorFacing()} title="Flip swing side (F)">Flip side</button><button type="button" aria-pressed={doorDraft.flipHand} onClick={() => useDesignerUIStore.getState().toggleDoorHand()} title="Swap hinge (H)">Flip hinge</button></>}
          <small>Slide along a wall · release to place · repeat or Done. Esc cancels · right-drag or two fingers move the view</small>
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
          <h2>{costOpen ? 'Your design basket' : selection ? 'Selected item' : mode === 'materials' ? 'Materials' : mode === 'energy' ? 'Solar & energy' : mode === 'garden' ? 'Garden & outdoors' : 'Build your home'}</h2><p>{costOpen ? 'Catalog products and measured finishes' : selection ? 'Drag the item in your design to move it' : mode === 'materials' ? 'Measured quantities · editable assumptions' : mode === 'garden' ? 'Shape the space around your home' : 'Rooms, walls, floors, openings and roof'}</p>
          {!selection && <div className="house-metrics"><div><strong>{totalArea.toFixed(1)}</strong><span>m² floor area</span></div><div><strong>{rooms.length}</strong><span>rooms</span></div><div><strong>{levelsOf(property).filter((l) => !isRoofLevel(l)).length}</strong><span>floors</span></div></div>}
        </div>
        <div className="house-inspector-content">{costOpen ? <HouseCostPanel productId={selection?.productId} onCart={onCart} onEdit={selection ? () => { setCostOpen(false); setMobileInspector(true); } : undefined} /> : inspector}</div>
        {!costOpen && <div className="house-inspector-foot">{!isPitchEmbed() && <div className="house-estimate"><span>Product estimate</span><strong>{quoteAwareAmount(cart, cart.subtotal, formatCurrency(cart.subtotal, currency))}</strong></div>}<p>From the products and finishes in your plan.</p>{onCart && <button className="house-estimate-button" onClick={onCart}>View products & quantities ↗</button>}</div>}
      </aside>}
    </div>
  </div>;
}
