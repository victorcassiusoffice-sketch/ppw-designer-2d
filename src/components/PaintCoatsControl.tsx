import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { findWallPaintById, MAX_PAINT_COATS, MIN_PAINT_COATS } from '../data/wallPaints';

/** The same persisted coat setting in the phone brush, palette and estimate.
 * It changes demand, not visual scale. Pack prices round only after demand. */
export function PaintCoatsControl({ compact = false }: { compact?: boolean }) {
  const coats = usePropertyStore(s => s.property.wallPaintCoats);
  const setCoats = usePropertyStore(s => s.setWallPaintCoats);
  const paintId = useDesignerUIStore(s => s.wallPaintDraft.paintId);
  const recommended = findWallPaintById(paintId)?.recommended_coats ?? 2;
  return <div className={compact ? 'paint-coats-control paint-coats-control--compact' : 'paint-coats-control'}>
    <label><span>Coats</span><select aria-label="Paint coats" value={coats ?? ''} onChange={event => setCoats(event.target.value === '' ? null : Number(event.target.value))}>
      <option value="">Datasheet{compact ? '' : ` (${recommended} for this paint)`}</option>
      {Array.from({ length: MAX_PAINT_COATS - MIN_PAINT_COATS + 1 }, (_, i) => i + MIN_PAINT_COATS).map(n => <option value={n} key={n}>{n}{compact ? '' : n === 1 ? ' coat' : ' coats'}</option>)}
    </select></label>
    {!compact && <p>Applies to all finish paints. Two coats use twice the paint before rounding to whole tins. Primer is separate.</p>}
  </div>;
}
