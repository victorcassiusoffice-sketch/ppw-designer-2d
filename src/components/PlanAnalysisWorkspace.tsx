import { useEffect, useRef } from 'react';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { AnalysisCartSummary } from './AnalysisCartSummary';
import { MaterialsPanel } from './MaterialsPanel';
import { EnergySummary } from './EnergyPanel';

export function PlanAnalysisWorkspace() {
  const materials = useDesignerUIStore(s => s.materialsPanelOpen);
  const energy = useDesignerUIStore(s => s.energyPanelOpen);
  const view = useDesignerUIStore(s => s.viewMode);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('panel') === 'materials') useDesignerUIStore.getState().setMaterialsPanelOpen(true);
  }, []);
  useEffect(() => {
    if (!materials && !energy) return;
    if (materials) { usePropertyStore.getState().selectItem(null); usePlacementIntentStore.getState().setArmed(null); }
    const close = () => { useDesignerUIStore.getState().setMaterialsPanelOpen(false); useDesignerUIStore.getState().setEnergyPanelOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"][aria-modal="true"]')) { e.stopImmediatePropagation(); close(); } };
    const away = (e: PointerEvent) => { const target = e.target as HTMLElement; if (view === 'plan' && target.closest('.konvajs-content') && !ref.current?.contains(target)) close(); };
    const scene = () => { if (materials) close(); };
    window.addEventListener('ppw:house-scene-pointer', scene);
    document.addEventListener('keydown', escape, true); document.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('ppw:house-scene-pointer', scene); document.removeEventListener('keydown', escape, true); document.removeEventListener('pointerdown', away, true); };
  }, [materials, energy, view]);
  if (view === '3d' || (!materials && !energy)) return null;
  return <aside ref={ref} className={`plan-analysis-workspace${materials ? '' : ' is-energy'}`} aria-label={materials ? 'Materials workspace' : 'Solar and energy workspace'}><header className="plan-analysis-header"><strong>{materials ? 'Materials' : 'Solar & energy'}</strong><button onClick={() => { useDesignerUIStore.getState().setMaterialsPanelOpen(false); useDesignerUIStore.getState().setEnergyPanelOpen(false); }}>Done ×</button></header><div className="plan-analysis-body">{materials ? <MaterialsPanel /> : <div className="p-3"><EnergySummary compact /></div>}</div><AnalysisCartSummary /></aside>;
}
