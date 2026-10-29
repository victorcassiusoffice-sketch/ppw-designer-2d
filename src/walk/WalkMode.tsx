import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ThreeStage, type ThreeStageHandle } from '../components/three/ThreeStage';
import type { SceneSolids } from '../designer/roomSolids';
import type { OrbitCamera } from '../designer/roomView3d';
import type { Property } from '../store/propertyStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { DEFAULT_WALK_CHARACTER_ID, WALK_CHARACTERS } from './characters';
import type { WalkRuntime, WalkStatus } from './runtime';
import './walk.css';

const camera: OrbitCamera = { target: { x: 0, y: 0, z: 1 }, distanceM: 10, azimuthRad: 0, elevationRad: .6, fovRad: Math.PI / 3 };
const preferenceKey = 'olb-world-character-v1';
function savedCharacter(): string {
  try { const id = localStorage.getItem(preferenceKey); return WALK_CHARACTERS.find(c => c.id === id)?.id ?? DEFAULT_WALK_CHARACTER_ID; }
  catch { return DEFAULT_WALK_CHARACTER_ID; }
}

function ControlsCopy({ touchFirst }: { touchFirst: boolean }): JSX.Element {
  const touch = <p key="touch"><b>Touch:</b> Use the pad to move and turn. Drag the view to look. Tap a door button when close. Tap Exit walk to return to your design.</p>;
  const keyboard = <p key="keyboard"><b>Keyboard and mouse:</b> WASD or arrows to move · Shift to run · mouse to look · V to switch view · E for doors. Esc frees the mouse; press Esc again to exit.</p>;
  return <>{touchFirst ? [touch, keyboard] : [keyboard, touch]}</>;
}

export default function WalkMode({ prepareVisit, onClose }: {
  prepareVisit: () => { property: Property; solids: SceneSolids };
  onClose: () => void;
}): JSX.Element {
  const host = useRef<HTMLElement>(null);
  const stage = useRef<ThreeStageHandle>(null);
  const runtime = useRef<WalkRuntime | null>(null);
  const [choice, setChoice] = useState(savedCharacter);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('Preparing your walk…');
  const [visit, setVisit] = useState<ReturnType<typeof prepareVisit> | null>(null);
  const [status, setStatus] = useState<WalkStatus | null>(null);
  const [size, setSize] = useState({ width: innerWidth, height: innerHeight });
  const [touchControls, setTouchControls] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const startedAt = useRef(0);
  const stickPointer = useRef<number | null>(null);
  const lookPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const prepare = useRef(prepareVisit);
  prepare.current = prepareVisit;
  useWorkspaceFocus(host, () => { if (!runtime.current?.escape()) onClose(); }, { onKeyDown: event => { if (!help) runtime.current?.keyDown(event); } });
  useEffect(() => {
    const resize = () => setSize({ width: innerWidth, height: innerHeight });
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const pointer = window.matchMedia?.('(pointer: coarse)');
    if (!pointer) return;
    const update = () => setTouchControls(pointer.matches);
    update();
    pointer.addEventListener('change', update);
    return () => pointer.removeEventListener('change', update);
  }, []);
  const stageReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!started) return;
    // Let the progress line paint before constructing the private walk scene.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        try { setVisit(prepare.current()); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Walk could not start.'); }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [started]);
  useEffect(() => {
    if (!started || !ready || !visit) return;
    const surface = stage.current?.beginWalk();
    if (!surface) return;
    let active = true, viewer: WalkRuntime | undefined;
    let release = () => surface.release();
    setLoading('Loading walk controls…');
    void import('./runtime').then(async ({ WalkRuntime: Runtime }) => {
      if (!active) return;
      viewer = new Runtime(surface, visit.solids, visit.property, value => { if (active) setStatus(value); }, onClose);
      release = () => viewer?.dispose();
      runtime.current = viewer;
      await viewer.load(WALK_CHARACTERS.find(c => c.id === choice)!, startedAt.current,
        message => { if (active) setLoading(message); });
    }).catch(reason => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'Walk could not load. Please exit and try again.');
        release(); release = () => {}; runtime.current = null;
      }
    });
    return () => { active = false; release(); runtime.current = null; };
  }, [started, ready, choice, visit]);
  const begin = () => {
    try { localStorage.setItem(preferenceKey, choice); } catch { /* A private session can still walk. */ }
    startedAt.current = performance.now(); setStarted(true);
  };
  const stopStick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== event.pointerId) return;
    runtime.current?.setStick(0, 0); stickPointer.current = null;
    event.currentTarget.style.setProperty('--stick-x', '0px'); event.currentTarget.style.setProperty('--stick-y', '0px');
  };
  const moveStick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - rect.left - rect.width / 2) / 40, y = (event.clientY - rect.top - rect.height / 2) / 40;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    runtime.current?.setStick(Math.abs(x) < .12 ? 0 : x, Math.abs(y) < .12 ? 0 : y);
    event.currentTarget.style.setProperty('--stick-x', `${x * 36}px`); event.currentTarget.style.setProperty('--stick-y', `${y * 36}px`);
  };
  return createPortal(
    <section ref={host} className="world-walk" data-world-walk="true" role="dialog" aria-modal="true" aria-label="Walk mode"
      data-testid="world-walk" data-status={status ? JSON.stringify(status) : undefined}>
      {started && visit && <div className="world-walk-scene"><ThreeStage ref={stage} solids={visit.solids} camera={camera}
        width={size.width} height={size.height} hover={null} wallView="up" presentation="architectural"
        onReady={stageReady} onFailed={() => { runtime.current?.dispose(); runtime.current = null; setError('WebGL is unavailable. Exit to return to your design.'); }} /></div>}
      <header className="world-walk-header"><div><strong>Walk mode</strong><span>Explore your design</span></div>
        <button type="button" onClick={onClose} className="world-walk-exit">Exit walk <span aria-hidden="true">×</span></button></header>
      {!started ? <div className="world-walk-card" data-testid="walk-chooser">
        <p className="world-walk-eyebrow">A walk through your home</p><h1>Choose your character</h1>
        <div className="world-walk-characters" role="group" aria-label="Character">
          {WALK_CHARACTERS.map(character => <button key={character.id} type="button" aria-pressed={choice === character.id} onClick={() => setChoice(character.id)}>
            <img src={character.thumbnailDataUrl} data-thumbnail-source={character.thumbnailUrl} alt="" width="64" height="64" decoding="sync" loading="eager" /><span>{character.label}</span>
          </button>)}
        </div>
        <div className="world-walk-controls-card"><strong>How to walk</strong>
          <ControlsCopy touchFirst={touchControls} />
        </div>
        <button type="button" className="world-walk-primary" onClick={begin}>Start walk</button>
        <p className="world-walk-small">Doors and movement stay in this visit. Your saved design stays as it is.</p>
        <p className="world-walk-small">Roof coverings are hidden so connected roof terraces remain accessible.</p>
        <a href="https://kenney.nl/assets/mini-characters" target="_blank" rel="noreferrer">Characters by Kenney · CC0</a>
      </div> : error ? <div className="world-walk-card" role="alert"><h1>Walk is unavailable</h1><p>{error}</p><button type="button" onClick={onClose}>Return to design</button></div>
      : !status ? <div className="world-walk-loading" role="status" aria-live="polite"><span className="world-walk-spinner" aria-hidden="true" />{loading}</div> : <>
        <div className="world-walk-look" aria-label="Drag to look" onClick={() => { if (matchMedia('(pointer:fine)').matches) runtime.current?.lock(); }}
          onPointerDown={event => { if (event.pointerType !== 'mouse' || !status.locked) { lookPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); } }}
          onPointerMove={event => { const pointer = lookPointer.current; if (pointer?.id === event.pointerId) { runtime.current?.dragLook(event.clientX - pointer.x, event.clientY - pointer.y); pointer.x = event.clientX; pointer.y = event.clientY; } }}
          onPointerUp={() => { lookPointer.current = null; }} onPointerCancel={() => { lookPointer.current = null; }} />
        <div className="world-walk-toolbar">
          <button type="button" onClick={() => runtime.current?.toggleView()}>{status.mode === 'third' ? 'First person' : 'Third person'}</button>
          <button type="button" aria-pressed={running} onClick={() => { setRunning(!running); runtime.current?.setRunning(!running); }}>{running ? 'Running' : 'Walk / run'}</button>
          <button type="button" aria-expanded={help} onClick={() => { runtime.current?.clearInput(); setHelp(!help); }}>Controls</button>
        </div>
        {help && <div className="world-walk-help"><strong>How to walk</strong><ControlsCopy touchFirst={touchControls} /><button type="button" onClick={() => setHelp(false)}>Got it</button></div>}
        <div className="world-walk-aim" aria-hidden="true">·</div>
        <div className="world-walk-door" role="status">{status.blocked ? <span>Step away so the door can move safely.</span> : status.door && <button type="button" aria-label={status.door} onClick={() => runtime.current?.interact()}>{status.door}{!touchControls && <> <kbd aria-hidden="true">E</kbd></>}</button>}</div>
        <div className="world-walk-stick" role="application" aria-label="Move and turn with one thumb" tabIndex={0}
          onPointerDown={event => { stickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }}
          onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <span className="world-walk-stick-knob" /><span className="world-walk-stick-label">Move + turn</span>
        </div>
        <p className="world-walk-hint">{touchControls ? 'Pad: move + turn · Drag: look · Tap doors · Exit walk: return' : status.locked ? 'Esc frees the mouse · E doors · V view' : 'Click or drag to look · E doors · V view · Esc exits'}</p>
        <a className="world-walk-credit" href="https://kenney.nl/assets/mini-characters" target="_blank" rel="noreferrer">Kenney · CC0</a>
      </>}
    </section>, document.body,
  );
}
