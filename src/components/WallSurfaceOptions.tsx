import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';
import { WALL_CONSTRUCTIONS } from '../designer/wallConstruction';
import { brandIdOfPaint, findWallPaintById, WALL_PAINTS } from '../data/wallPaints';
import './wallSurfaceOptions.css';

/** Shared by the desktop palette and the phone sheet: no floating controls. */
export function WallSurfaceOptions({ compact = false }: { compact?: boolean }): JSX.Element {
  const draft = useDesignerUIStore((state) => state.wallPaintDraft);
  const setDraft = useDesignerUIStore((state) => state.setWallPaintDraft);
  const surfaceMode = draft.operation === 'construction';
  const chooseSide = (side: 'interior' | 'exterior') => {
    const current = findWallPaintById(draft.paintId);
    const compatible = side === 'exterior' && current?.use === 'interior'
      ? WALL_PAINTS.find((paint) => brandIdOfPaint(paint) === brandIdOfPaint(current) && (paint.use === 'exterior' || paint.use === 'both')) : current;
    setDraft({ side, ...(compatible && compatible.id !== draft.paintId ? { paintId: compatible.id, colourHex: undefined, colourName: undefined } : {}) });
    if (side === 'exterior') useDesignerUIStore.getState().setWallView('up');
  };
  if (compact) return <div className="wall-surface-compact">
    <button type="button" onClick={() => { setDraft({ operation: 'paint' }); chooseSide(draft.side === 'exterior' ? 'interior' : 'exterior'); }} title="Switch between painting the inside and outside face">
      {draft.side === 'exterior' ? 'Outside' : 'Inside'} ↔
    </button>
    <button type="button" onClick={() => { setDraft({ operation: 'construction', erase: false }); window.dispatchEvent(new CustomEvent('ppw:open-menu', { detail: { section: 'wallpaint' } })); }}>Materials</button>
  </div>;
  return <section className="wall-surface-options" aria-label="Wall surface and paint side">
    <div className="wall-surface-tabs" role="group" aria-label="Wall tool">
      <button type="button" aria-pressed={!surfaceMode} onClick={() => setDraft({ operation: 'paint' })}>Paint colour</button>
      <button type="button" aria-pressed={surfaceMode} onClick={() => setDraft({ operation: 'construction', erase: false })}>Wall material</button>
    </div>
    {surfaceMode ? <>
      <div className="wall-construction-cards">
        {WALL_CONSTRUCTIONS.map((surface) => <button type="button" key={surface.id} aria-pressed={(draft.construction ?? 'plastered-brick') === surface.id}
          onClick={() => setDraft({ construction: surface.id, operation: 'construction', erase: false })} title={surface.detail}>
          <span className={`wall-surface-sample wall-surface-sample--${surface.id}`} aria-hidden="true" />{surface.name}
        </button>)}
      </div>
      <p>Tap a wall to change its material. Existing paint stays on top.</p>
      <button type="button" className="wall-surface-apply-room" onClick={() => {
        const state = usePropertyStore.getState();
        state.setWallConstruction(state.property.activeRoomId, null, draft.construction ?? 'plastered-brick');
      }}>Apply material to active room</button>
      <p>Visual construction choice; no material price added.</p>
    </> : <>
      <div className="wall-surface-tabs" role="group" aria-label="Paint side">
        <button type="button" aria-pressed={draft.side !== 'exterior'} onClick={() => chooseSide('interior')}>Inside</button>
        <button type="button" aria-pressed={draft.side === 'exterior'} onClick={() => chooseSide('exterior')}>Outside</button>
      </div>
      <p>{draft.side === 'exterior' ? 'Outside face only. Rotate the house to see exterior paint.' : 'Inside face only. Outside paint stays independent.'}</p>
    </>}
  </section>;
}
