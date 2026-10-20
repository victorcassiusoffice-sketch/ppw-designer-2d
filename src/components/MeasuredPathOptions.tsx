import { useEffect } from 'react';
import { useMeasuredPathToolStore, measuredToolPreview } from '../store/measuredPathToolStore';
import { usePropertyStore } from '../store/propertyStore';
import { activeLevelIdOf } from '../designer/levels';
import { roofConfigOf } from '../designer/building';
import { roofMeasuredAreas } from '../designer/roofSurface';
import './MeasuredPathOptions.css';

/** Mount inside an existing dock, never over the drawing surface. Pointer
 * adapters remain thin: they call tap(point)/setHover(point) in world metres. */
export function MeasuredPathOptions() {
  const tool = useMeasuredPathToolStore();
  const { target, propertyId: drawingPropertyId, levelId: drawingLevelId, cancel } = tool;
  const property = usePropertyStore(s => s.property);
  const levelId = activeLevelIdOf(property);
  useEffect(() => {
    if (target && (drawingPropertyId !== property.id || drawingLevelId !== levelId)) cancel();
  }, [property.id, levelId, target, drawingPropertyId, drawingLevelId, cancel]);
  useEffect(() => {
    if (!target) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [target, cancel]);
  if (!tool.target) return null;
  const preview = measuredToolPreview(tool);
  const roof = roofConfigOf(property);
  const areas = roof.outline ? roofMeasuredAreas(roof.outline, roof) : null;
  const instruction = !tool.start ? 'Tap the start point.' : tool.pendingEnd ? 'Tap a point the curve should bend through.' : 'Tap the end point.';
  return <section className="measured-path-options" aria-label="Measured path controls">
    <div className="measured-path-options__heading"><strong>{tool.target === 'wall' ? 'Curved walls' : tool.target === 'roof' ? 'Roof outline' : 'Outdoor outline'}</strong><button type="button" aria-label="Cancel measured drawing" onClick={tool.cancel}>×</button></div>
    <div className="measured-path-options__row" role="group" aria-label="Path segment">
      <button type="button" aria-pressed={tool.segmentKind === 'line'} onClick={() => tool.setSegmentKind('line')}>Straight</button>
      <button type="button" aria-pressed={tool.segmentKind === 'quadratic'} onClick={() => tool.setSegmentKind('quadratic')}>Curve</button>
      <button type="button" onClick={tool.back} disabled={!tool.start}>Undo point</button>
      <button type="button" onClick={tool.finish}>{tool.target === 'wall' ? 'Done' : 'Close outline'}</button>
    </div>
    <p aria-live="polite">{tool.error ?? instruction} {preview ? `${preview.lengthM.toFixed(2)} m` : ''}</p>
    {tool.target === 'roof' && <label>Overhang (m)<input type="number" min="0" max="1.5" step="0.05" value={roof.overhangM}
      onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 0 && value <= 1.5) usePropertyStore.getState().setRoofConfig({ ...roof, overhangM: value }); }} /></label>}
    {tool.target === 'roof' && areas && <small>Projected {areas.projectedM2.toFixed(2)} m² · covering {areas.coveringM2.toFixed(2)} m²</small>}
    <small>Curves share the same measured geometry in plan and 3D; chord deviation ≤ 3 mm. Esc cancels.</small>
  </section>;
}
