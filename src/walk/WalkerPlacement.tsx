import { createPortal } from 'react-dom';
import { useToolPanel } from '../hooks/useToolPanel';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointer, type RefObject } from 'react';
import type { Property } from '../store/propertyStore';
import type { ThreeStageHandle } from '../components/three/ThreeStage';
import type { prepareWalkVisit } from './visit';
import type { PlacementHint } from './placement';
import { activeLevelIdOf, type Level } from '../designer/levels';
import { walkWords } from './words';
import { useAppPreferences } from '../i18n/AppPreferences';

type Stage = Partial<Pick<ThreeStageHandle, 'walkRay' | 'projectPoint'>>;
interface Preview { hint: PlacementHint | null; x: number; y: number }
interface Props {
  property: Property; levels: Level[]; stageRef: RefObject<Stage | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  prepare: () => ReturnType<typeof prepareWalkVisit>; onPlace: (hint: PlacementHint) => void;
}

export function WalkerPlacement({ property, levels, stageRef, viewportRef, prepare, onPlace }: Props) {
  const pref = useAppPreferences();
  const tx = walkWords(pref.locale, pref.tx);
  const [armed, setArmed] = useToolPanel();
  const [level, setLevel] = useState(activeLevelIdOf(property));
  const selected = levels.some(l => l.id === level) ? level : levels[0]?.id;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [invalid, setInvalid] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const sequence = useRef(0);
  const token = useRef<HTMLButtonElement>(null);
  const make = async () => {
    const [{ createWalkWorld }, { pickSpawn }] = await Promise.all([import('./scene'), import('./placement')]);
    const { property: snapshot, solids } = prepare();
    return { world: createWalkWorld(solids, snapshot), pickSpawn };
  };
  const resource = useRef<ReturnType<typeof make> | null>(null);
  const callbacks = useRef({ pick: async (_x: number, _y: number, _drop: boolean) => {} });
  useEffect(() => () => {
    sequence.current++; gesture.current = null;
    const pending = resource.current; resource.current = null;
    void pending?.then(({ world }) => world.dispose(), () => {});
  }, [property]);

  useEffect(() => {
    if (typeof __TEST_HOOKS__ === 'undefined' || !__TEST_HOOKS__ || !token.current) return;
    const el = token.current;
    const project = (event: Event) => {
      const { x, y, height, reply } = (event as CustomEvent).detail;
      const rect = viewportRef?.current?.getBoundingClientRect();
      const point = stageRef.current?.projectPoint?.(x, y, height);
      if (rect && point) reply({ x: rect.left + point.x, y: rect.top + point.y });
    };
    el.addEventListener('world-walk-project', project);
    return () => el.removeEventListener('world-walk-project', project);
  }, [stageRef, viewportRef]);
  const cancel = useCallback(() => {
    sequence.current++; gesture.current = null;
    const pending = resource.current; resource.current = null; void pending?.then(({ world }) => world.dispose(), () => {});
    setArmed(false); setInvalid(false); setPreview(null);
  }, [setArmed]);
  callbacks.current.pick = async (x, y, drop) => {
    const id = ++sequence.current;
    const rect = viewportRef?.current?.getBoundingClientRect(), stage = stageRef.current;
    const ray = rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      ? stage?.walkRay?.(x - rect.left, y - rect.top) : null;
    let result: Preview = { x, y, hint: null };
    if (ray && selected && rect) {
      try {
        const { world, pickSpawn } = await (resource.current ??= make());
        if (sequence.current !== id) return;
        const spawn = pickSpawn(world, ray, selected);
        if (spawn) {
          const p = spawn.position, screen = stage?.projectPoint?.(p.x, p.z, p.y);
          result = { x: screen ? rect.left + screen.x : x, y: screen ? rect.top + screen.y : y,
            hint: { point: { x: p.x, y: p.z }, levelId: selected } };
        }
      } catch { if (sequence.current === id) resource.current = null; }
    }
    if (sequence.current !== id) return;
    setPreview(result);
    if (drop && result.hint) { cancel(); onPlace(result.hint); }
    else if (drop) setInvalid(true);
  };

  useEffect(() => {
    const view = viewportRef?.current;
    if (!armed || !view) return;
    let contact: { id: number; x: number; y: number } | undefined;
    const tool = (e: PointerEvent) => (e.target as Element | null)?.closest('button,select,input,label,.world-walk-placement');
    const down = (e: PointerEvent) => {
      if (tool(e) || gesture.current || e.button !== 0 || !e.isPrimary) return;
      e.stopImmediatePropagation(); contact = { id: e.pointerId, x: e.clientX, y: e.clientY };
      view.setPointerCapture(e.pointerId); void callbacks.current.pick(e.clientX, e.clientY, false);
    };
    const move = (e: PointerEvent) => {
      if (tool(e) || gesture.current || !e.isPrimary) return;
      e.stopImmediatePropagation(); void callbacks.current.pick(e.clientX, e.clientY, false);
    };
    const up = (e: PointerEvent) => {
      if (contact?.id !== e.pointerId) return;
      e.stopImmediatePropagation(); contact = undefined; void callbacks.current.pick(e.clientX, e.clientY, true);
    };
    const abortContact = () => { contact = undefined; sequence.current++; setPreview(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); token.current?.focus(); } };
    view.addEventListener('pointerdown', down, true); view.addEventListener('pointermove', move, true);
    view.addEventListener('pointerup', up, true); view.addEventListener('pointercancel', abortContact, true);
    window.addEventListener('keydown', esc, true);
    return () => {
      view.removeEventListener('pointerdown', down, true); view.removeEventListener('pointermove', move, true);
      view.removeEventListener('pointerup', up, true); view.removeEventListener('pointercancel', abortContact, true);
      window.removeEventListener('keydown', esc, true);
    };
  }, [armed, viewportRef, cancel]);
  const moved = (e: ReactPointer) => gesture.current?.id === e.pointerId &&
    Math.hypot(e.clientX - gesture.current.x, e.clientY - gesture.current.y) > 5;
  return <div className="world-walk-placement">
    <button ref={token} type="button" className="world-person-token" data-testid="place-walker" aria-label={tx('Place a person')}
      aria-pressed={armed} title={tx('Drag a person onto the land or a floor')}
      onPointerDown={e => { if (e.button !== 0 || !e.isPrimary) return; e.stopPropagation(); setArmed(true); setInvalid(false);
        gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (moved(e)) { e.stopPropagation(); void callbacks.current.pick(e.clientX, e.clientY, false); } }}
      onPointerUp={e => { if (gesture.current?.id !== e.pointerId) return; e.stopPropagation(); const place = moved(e); gesture.current = null;
        if (place) void callbacks.current.pick(e.clientX, e.clientY, true); }}
      onPointerCancel={cancel} onClick={e => { if (e.detail === 0) setArmed(!armed); }}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="4" r="2.5"/><path d="M7 13l2-5h6l2 5M10 10v5l-2 7m6-12v5l2 7"/></svg>
    </button>
    {armed && createPortal(<div className="world-placement-options world-placement-sheet">
      <label>{tx('Place a person')}<select value={selected} aria-label={tx('Placement level')} onChange={e => { sequence.current++; setLevel(e.target.value); setPreview(null); setInvalid(false); }}>
        {levels.map(l => <option key={l.id} value={l.id}>{tx(l.name)}</option>)}</select></label>
      <button type="button" onClick={cancel}>{tx('Cancel')}</button>
      <small role="status">{tx(invalid ? 'Choose clear ground on this level.' : 'Drag the person or tap a clear spot.')}</small>
    </div>, document.body)}
    {armed && preview && <span aria-hidden="true" className="world-placement-ring" data-valid={!!preview.hint}
      style={{ left: preview.x, top: preview.y }}>{preview.hint ? '✓' : '×'}</span>}
  </div>;
}
