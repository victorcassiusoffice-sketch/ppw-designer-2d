import { useEffect, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useOpeningSelectionStore } from '../store/openingSelectionStore';
import { activeLevelIdOf } from '../designer/levels';
import { useDisciplineVisibilityStore } from '../store/disciplineVisibilityStore';
import type { Opening } from '../designer/openings';
import { openingHeightM } from '../designer/openingGeometry';
import './openingSelection.css';

function MetresField({ label, value, min = 0, onCommit }: { label: string; value: number; min?: number; onCommit: (n: number) => boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return <label>{label}<span><input type="number" min={min} step="0.01" value={text} aria-label={label}
    onChange={e => setText(e.target.value)} onBlur={() => {
      const next = Number(text);
      if (!text.trim() || !Number.isFinite(next) || next < min || !onCommit(next)) setText(String(value));
    }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />m</span></label>;
}

/** One dismissible edge inspector shared by Plan and House; no camera writes. */
export function OpeningSelectionEditor() {
  const property = usePropertyStore(s => s.property);
  const selectedId = useOpeningSelectionStore(s => s.selectedId);
  const select = useOpeningSelectionStore(s => s.select);
  const wallsVisible = useDisciplineVisibilityStore(s => s.visible.structure && s.parts.walls);
  const room = property.rooms.find(r => r.openings?.some(o => o.id === selectedId));
  const opening = room?.openings?.find(o => o.id === selectedId);
  const level = activeLevelIdOf(property);
  const [error, setError] = useState('');
  useEffect(() => {
    if (selectedId && (!opening || !wallsVisible || (room?.levelId ?? 'ground') !== level)) select(null);
    setError('');
  }, [selectedId, opening, wallsVisible, room?.levelId, level, select]);
  useEffect(() => {
    if (!selectedId) return;
    const handle = (e: KeyboardEvent) => {
      // This capture listener can predate Walk's focus owner. Never let it
      // remove a saved opening or consume the foreground visit's Escape.
      if (document.querySelector('[data-world-walk="true"]')) return;
      const input = e.target instanceof HTMLElement && !!e.target.closest('input,textarea,select,[contenteditable="true"]');
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); select(null); }
      else if (!input && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault(); e.stopImmediatePropagation(); usePropertyStore.getState().removeOpening(selectedId); select(null);
      }
    };
    window.addEventListener('keydown', handle, true);
    return () => window.removeEventListener('keydown', handle, true);
  }, [selectedId, select]);
  if (!opening || !room || !wallsVisible || (room.levelId ?? 'ground') !== level) return null;
  const label = opening.kind === 'window' ? 'Window' : opening.kind === 'door' ? 'Door' : 'Opening';
  const patch = (change: Partial<Opening>) => {
    const ok = usePropertyStore.getState().updateOpening(opening.id, change);
    setError(ok ? '' : 'That size or position does not fit. Keep clear of the wall ends and other openings.');
    return ok;
  };
  return <section className="opening-selection-editor" aria-label={`${label} properties`} data-testid="opening-selection-editor">
    <header><strong>{label} · {room.name}</strong><button type="button" aria-label="Close opening properties" title="Close (Esc)" onClick={() => select(null)}>×</button></header>
    <div className="opening-selection-fields">
      <MetresField label="Opening width" min={0.05} value={opening.widthM} onCommit={widthM => patch({ widthM, ...(opening.shape === 'circle' ? { heightM: widthM } : {}) })} />
      <MetresField label="Distance along wall" value={opening.offsetM} onCommit={offsetM => patch({ offsetM })} />
      {opening.shape !== 'circle' && <MetresField label="Opening height" min={0.05} value={openingHeightM(opening)} onCommit={heightM => patch({ heightM })} />}
    </div>
    {opening.kind === 'door' && <div className="opening-selection-actions">
      <button type="button" onClick={() => patch({ flipFacing: !opening.flipFacing })}>Flip swing</button>
      <button type="button" onClick={() => patch({ flipHand: !opening.flipHand })}>Swap hinge</button>
    </div>}
    {(opening.kind === 'window' || opening.kind === 'hole') && <MetresField label="Sill height" value={opening.sillM ?? (opening.kind === 'window' ? .9 : 0)} onCommit={sillM => patch({ sillM })} />}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="opening-selection-remove" onClick={() => { usePropertyStore.getState().removeOpening(opening.id); select(null); }}>Remove {label.toLowerCase()}</button>
  </section>;
}
