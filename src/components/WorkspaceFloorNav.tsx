import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { activeLevelIdOf, levelsOf } from '../designer/levels';
import { StudioIcon } from './StudioIcon';
import './workspaceFloorNav.css';

/** A persistent exit to a floor, shared by Plan and the specialist workspaces. */
export function WorkspaceFloorNav({ onExit, mode = 'foundation' }: { onExit?: () => void; mode?: 'plan' | 'services' | 'foundation' }) {
  const property = usePropertyStore(s => s.property);
  const levels = levelsOf(property);
  const active = activeLevelIdOf(property);
  const current = levels.find(level => level.id === active);
  function choose(value: string) {
    const state = usePropertyStore.getState();
    const ui = useDesignerUIStore.getState();
    if (value === '__foundation' || value === '__services') {
      onExit?.();
      window.dispatchEvent(new Event(value === '__foundation' ? 'ppw:open-foundation' : 'ppw:open-services'));
      return;
    }
    if (value === '__add') value = state.addLevel(`Floor ${levels.filter(level => level.kind !== 'roof').length}`);
    if (value === '__roof') value = state.ensureRoofLevel();
    ui.setFoundationView(false);
    ui.setTool('hand');
    state.setActiveLevel(value);
    onExit?.();
  }
  return <label className="workspace-floor-nav"><StudioIcon name="storeys" size={17} /><span className="workspace-floor-caption">Floors</span>
    <select aria-label={mode === 'plan' ? 'Plan floor' : 'Return to floor'} value={mode === 'plan' ? active : ''} onChange={event => choose(event.target.value)}>
      {mode !== 'plan' && <option value="" disabled>Return to {current?.name ?? 'floor'}…</option>}
      {levels.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
      {!levels.some(level => level.kind === 'roof') && <option value="__roof">Roof</option>}
      <option value="__add">＋ Add floor</option>
      {mode !== 'foundation' && <option value="__foundation">Foundation · excavate & concrete</option>}
      {mode !== 'services' && <option value="__services">Plumbing & Electric</option>}
    </select>
  </label>;
}
