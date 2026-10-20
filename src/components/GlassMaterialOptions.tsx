import { useEffect, useMemo, useState } from 'react';
import { MAURITIUS_GLASS, findGlassMaterial, glassTakeoff } from '../data/mauritiusGlass';
import { propertyMaterialsGeometry } from '../designer/propertyMaterials';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';

export function GlassMaterialOptions() {
  const draft = useDesignerUIStore(s => s.wallPaintDraft);
  const setDraft = useDesignerUIStore(s => s.setWallPaintDraft);
  const property = usePropertyStore(s => s.property);
  const reference = findGlassMaterial(draft.materialProductId);
  const thickness = draft.thicknessMm ?? 10;
  const [thicknessText, setThicknessText] = useState(String(thickness));
  useEffect(() => setThicknessText(String(thickness)), [thickness]);
  const totals = useMemo(() => propertyMaterialsGeometry(property, 'active').walls.filter(w => w.construction === 'glass').reduce((sum, wall) => {
    const q = glassTakeoff(Math.max(0, wall.lengthM * wall.heightM - wall.openingAreaM2), (wall.thicknessM ?? .01) * 1000, wall.materialProductId);
    return q ? { area: sum.area + q.areaM2, volume: sum.volume + q.volumeM3, mass: sum.mass + q.glassMassKg } : sum;
  }, { area: 0, volume: 0, mass: 0 }), [property]);
  return <div className="glass-material-options">
    <label>Glass specification<select aria-label="Glass specification" value={reference?.id ?? 'custom'} onChange={event => {
      const next = findGlassMaterial(event.target.value);
      setDraft({ materialProductId: next?.id, thicknessMm: next?.thicknessMm ?? draft.thicknessMm ?? 10 });
    }}><option value="custom">Custom thickness · supplier to confirm</option>{MAURITIUS_GLASS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
    <label>Glass thickness (mm)<input aria-label="Glass thickness (mm)" type="number" min={2} max={40} step={.01} value={thicknessText} onChange={event => setThicknessText(event.target.value)} onBlur={() => {
      const value = Number(thicknessText);
      if (thicknessText.trim() && Number.isFinite(value) && value >= 2 && value <= 40) {
        if (value !== thickness) setDraft({ thicknessMm: value, materialProductId: undefined });
      } else setThicknessText(String(thickness));
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
    {reference && <p><a href={reference.sourceUrl} target="_blank" rel="noreferrer">Supplier specification ↗</a><br />{reference.use}</p>}
    <div className="glass-material-metrics" aria-label="Glass on this floor">
      <span><b>{totals.area.toFixed(2)}</b> m² net</span><span><b>{totals.volume.toFixed(3)}</b> m³ envelope</span><span><b>{totals.mass.toFixed(1)}</b> kg glass</span>
    </div>
    <p>Current floor totals, after openings. No masonry or paint is counted for glass. Frames, fittings and cutting waste need a supplier schedule.</p>
  </div>;
}
