import { useDesignerUIStore } from '../store/designerUIStore';
import type { OpeningKind } from '../designer/openings';
import { openingHeightM, openingSillM } from '../designer/openingGeometry';

/** Measured opening options shared by the two authoring views. */
export function OpeningDimensions() {
  const draft = useDesignerUIStore(s => s.doorDraft);
  const set = useDesignerUIStore(s => s.setDoorDraft);
  return <details className="opening-dimensions"><summary>Size &amp; shape</summary><div className="opening-dimensions-fields">
    <label>Type<select aria-label="Opening type" value={draft.kind} onChange={e => set({ kind: e.target.value as OpeningKind })}>
      <option value="door">Door</option><option value="doorway">Doorway</option><option value="window">Window</option><option value="hole">Wall opening</option>
    </select></label>
    <label>Profile<select aria-label="Opening profile" value={draft.shape ?? 'rectangle'} onChange={e => set({ shape: e.target.value as 'rectangle' | 'arch' | 'circle', ...(e.target.value === 'circle' ? { heightM: draft.widthM } : {}) })}>
      <option value="rectangle">Rectangle</option><option value="arch">Arch</option>{(draft.kind === 'window' || draft.kind === 'hole') && <option value="circle">Circle</option>}
    </select></label>
    <label>Width (m)<input aria-label="Custom opening width" type="number" min="0.05" step="0.01" value={draft.widthM} onChange={e => { const widthM = Number(e.target.value); if (widthM >= .05) set({ widthM, ...(draft.shape === 'circle' ? { heightM: widthM } : {}) }); }} /></label>
    {draft.shape !== 'circle' && <label>Height (m)<input aria-label="Opening height" type="number" min="0.05" step="0.01" value={openingHeightM(draft)} onChange={e => { const heightM = Number(e.target.value); if (heightM >= .05) set({ heightM }); }} /></label>}
    {(draft.kind === 'window' || draft.kind === 'hole') && <label>Bottom / sill (m)<input aria-label="Opening sill height" type="number" min="0" step="0.01" value={openingSillM(draft)} onChange={e => { const sillM = Number(e.target.value); if (sillM >= 0) set({ sillM }); }} /></label>}
  </div></details>;
}
