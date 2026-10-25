import { useId, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { normaliseMaterialsSettings } from '../designer/materials';
import { WallHeightControl } from './WallHeightControl';

/** Uses the same saved level-height and Materials inputs as both design views. */
export function WallDimensionsControl({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [notice, setNotice] = useState('');
  const id = useId();
  const materials = usePropertyStore(s => s.property.materials);
  const thicknessMm = normaliseMaterialsSettings(materials).wall.thicknessM * 1000;
  return <div className="wall-dimensions">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>Height & thickness</button>
    {open && <div id={id} className="wall-dimensions-fields">
      <span>Wall height · selected floor</span>
      <WallHeightControl idPrefix="paint-wall-height" />
      <label>Wall thickness · whole building (mm)
        <input key={thicknessMm} type="number" aria-label="Masonry wall thickness in millimetres" min={25} max={2000} step={5} defaultValue={thicknessMm}
          onBlur={event => {
            const value = event.currentTarget.valueAsNumber;
            if (!Number.isFinite(value) || value < 25 || value > 2000) {
              event.currentTarget.value = String(thicknessMm); setNotice('Enter 25–2,000 mm. The previous thickness was kept.'); return;
            }
            if (Math.abs(value - thicknessMm) < 1e-6) { setNotice('Thickness unchanged.'); return; }
            usePropertyStore.getState().setMasonryWallThickness(value / 1000);
            setNotice('Masonry drawing and Materials now share this thickness. Review supplier rates for the changed specification.');
          }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      </label>
      <p>Editing thickness applies to masonry across all floors. Glass retains its own thickness. Centre lines stay fixed. Unit sizes, joints and mix ratios remain in Materials.</p>
      {notice && <p role="status">{notice}</p>}
    </div>}
  </div>;
}
