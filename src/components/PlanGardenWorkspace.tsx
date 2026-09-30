import { useEffect } from 'react';
import { GardenPanel } from './GardenPanel';
import { useGardenEditorStore } from '../store/gardenEditorStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { useWallStore } from '../store/wallStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useDrawProgressStore } from '../store/drawProgressStore';
import { activeLevelIdOf } from '../designer/levels';
import './GardenPanel.css';

/** Reserved layout space, never a modal laid over the garden being edited. */
export function PlanGardenWorkspace() {
  const open = useGardenEditorStore((s) => s.panelOpen);
  const placement = useGardenEditorStore((s) => s.placement);
  const view = useDesignerUIStore((s) => s.viewMode);
  const tool = useDesignerUIStore((s) => s.tool);
  const activeLevel = usePropertyStore((s) => s.property.activeLevelId ?? 'ground');
  const propertyId = usePropertyStore((s) => s.property.id);
  const armedProduct = usePlacementIntentStore((s) => s.armedProductId);
  const energyOpen = useDesignerUIStore((s) => s.energyPanelOpen);
  const materialsOpen = useDesignerUIStore(s => s.materialsPanelOpen);
  const drawingWalls = useDrawProgressStore((s) => s.enabled);
  useEffect(() => {
    const show = () => {
      if (useDesignerUIStore.getState().viewMode === '3d') return;
      const store = usePropertyStore.getState();
      if (activeLevelIdOf(store.property) !== 'ground') store.setActiveLevel('ground');
      useDesignerUIStore.getState().setTool('hand');
      useDesignerUIStore.getState().setEnergyPanelOpen(false);
      useDesignerUIStore.getState().setMaterialsPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      useWallStore.getState().setDraw({ phase: 'idle' });
      useGardenEditorStore.getState().open();
    };
    window.addEventListener('ppw:open-garden', show);
    window.addEventListener('ppw:edit-garden', show);
    return () => { window.removeEventListener('ppw:open-garden', show); window.removeEventListener('ppw:edit-garden', show); };
  }, []);
  useEffect(() => {
    if (view === '3d' || tool !== 'hand' || activeLevel !== 'ground' || armedProduct || energyOpen || materialsOpen || drawingWalls) useGardenEditorStore.getState().close();
  }, [view, tool, activeLevel, armedProduct, energyOpen, materialsOpen, drawingWalls]);
  useEffect(() => () => useGardenEditorStore.getState().close(), [propertyId]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (useGardenEditorStore.getState().placement) useGardenEditorStore.getState().place(null);
      else useGardenEditorStore.getState().close();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [open]);
  if (!open || view === '3d') return null;
  return <aside className={`plan-garden-workspace${placement ? ' is-drawing' : ''}`} aria-label="Garden tools" data-testid="plan-garden-workspace">
    {placement ? <div className="plan-garden-instruction" role="status">
      <span>{placement.mode === 'draw' ? 'Drag two corners to draw the surface. Nothing is added until you release.' : placement.mode === 'resize' ? 'Drag two corners to resize the surface.' : 'Tap the plan to place this garden element.'}</span>
      <button type="button" onClick={() => useGardenEditorStore.getState().place(null)}>Cancel</button>
    </div> : <GardenPanel architectural onClose={() => useGardenEditorStore.getState().close()} onRequestPlacement={(intent) => useGardenEditorStore.getState().place(intent)} />}
  </aside>;
}
