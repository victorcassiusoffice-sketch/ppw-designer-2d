import { useDesignStore } from '../store/designStore';
import { usePropertyStore } from '../store/propertyStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useObjectPlacementStore, type ObjectPlacementMode } from '../store/objectPlacementStore';
import { getProductById } from '../data/products';
import { placedItemElevationCm } from '../designer/placedItemElevation';
import { levelHeightM } from '../designer/building';
import { roomLevelId } from '../designer/levels';
import { objectAccessWarnings } from '../designer/objectAccessWarnings';
import './objectPlacement.css';

/** Flush context row. Hidden until an object is selected or carried. */
export function ObjectPlacementControls(): JSX.Element | null {
  const armed = usePlacementIntentStore(s => s.armedProductId);
  const rotation = usePlacementIntentStore(s => s.armedRotation);
  const selectedId = useDesignStore(s => s.selectedInstanceId);
  const property = usePropertyStore(s => s.property);
  const mode = useObjectPlacementStore(s => s.mode);
  const room = property.rooms.find(r => r.placedItems.some(i => i.instanceId === selectedId));
  const item = room?.placedItems.find(i => i.instanceId === selectedId);
  const product = getProductById(armed ?? item?.productId ?? '');
  if (!product || (!armed && !item)) return null;
  const heightM = levelHeightM(property, room ? roomLevelId(room) : property.activeLevelId ?? 'ground');
  const height = item && room ? placedItemElevationCm(item, product, room.placedItems, getProductById, heightM) : 0;
  const maxHeight = Math.max(0, heightM * 100 - product.dimensions_cm.height);
  return <div className="object-placement-controls" data-testid="object-placement-controls" aria-label="Object placement">
    <div role="group" aria-label="Object grid">
      {([['grid', '50 cm'], ['half', '25 cm'], ['free', 'Free']] as [ObjectPlacementMode, string][]).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={mode === value} onClick={() => useObjectPlacementStore.getState().setMode(value)}>{label}</button>)}
    </div>
    {mode === 'free' && <span className="object-placement-note">Object overlap on · walls stay solid</span>}
    {armed && <><button type="button" aria-label="Turn carried object left" onClick={() => usePlacementIntentStore.getState().rotateArmed(-45)}>↶</button><span aria-live="polite">{Math.round(rotation)}°</span><button type="button" aria-label="Turn carried object right" onClick={() => usePlacementIntentStore.getState().rotateArmed(45)}>↷</button><button type="button" onClick={() => usePlacementIntentStore.getState().setArmed(null)}>Cancel</button></>}
    {!armed && item && <button type="button" onClick={() => usePlacementIntentStore.getState().setArmed(item.productId)} title="Carry another of this exact product and variant">Copy type</button>}
    {!armed && item && room && objectAccessWarnings(room, item, product).map(warning => <span className="object-placement-warning" role="status" key={warning}>{warning}</span>)}
    {!armed && item && product.placement === 'wall' && <label>Height <input type="number" aria-label="Wall item height in centimetres" min={0} max={maxHeight} step={5} value={Math.round(height)} onChange={e => {
      if (!e.target.value.trim()) return;
      const value = Number(e.target.value);
      if (Number.isFinite(value)) usePropertyStore.getState().updateItem(item.instanceId, { mountHeightCm: Math.min(maxHeight, Math.max(0, value)) });
    }} /> cm</label>}
  </div>;
}
