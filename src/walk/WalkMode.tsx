import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ThreeStage, type ThreeStageHandle } from '../components/three/ThreeStage';
import type { SceneSolids } from '../designer/roomSolids';
import type { OrbitCamera } from '../designer/roomView3d';
import type { Property } from '../store/propertyStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { DEFAULT_WALK_CHARACTER_ID, WALK_CHARACTERS } from './characters';
import { WalkRuntime, type WalkStatus } from './runtime';
import './walk.css';

const camera: OrbitCamera = { target: { x: 0, y: 0, z: 1 }, distanceM: 10, azimuthRad: 0, elevationRad: .6, fovRad: Math.PI / 3 };
const preferenceKey = 'olb-world-character-v1';
function savedCharacter(): string {
  try { const id = localStorage.getItem(preferenceKey); return WALK_CHARACTERS.find(c => c.id === id)?.id ?? DEFAULT_WALK_CHARACTER_ID; }
  catch { return DEFAULT_WALK_CHARACTER_ID; }
}

export default function WalkMode({ property, solids, onClose }: { property: Property; solids: SceneSolids; onClose: () => void }): JSX.Element {
  const host = useRef<HTMLElement>(null);
  const stage = useRef<ThreeStageHandle>(null);
  const runtime = useRef<WalkRuntime | null>(null);
  const [choice, setChoice] = useState(savedCharacter);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<WalkStatus | null>(null);
  const [size, setSize] = useState({ width: innerWidth, height: innerHeight });
  const startedAt = useRef(0);
  const stickPointer = useRef<number | null>(null);
  const lookPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  useWorkspaceFocus(host, onClose, { onKeyDown: event => { if (!help) runtime.current?.keyDown(event); } });
  useEffect(() => {
    const resize = () => setSize({ width: innerWidth, height: innerHeight });
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  const stageReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!started || !ready) return;
    const surface = stage.current?.beginWalk();
    if (!surface) return;
    let active = true, viewer: WalkRuntime | undefined;
    try {
      viewer = new WalkRuntime(surface, solids, property, value => { if (active) setStatus(value); }, onClose);
      runtime.current = viewer;
      viewer.load(WALK_CHARACTERS.find(c => c.id === choice)!, startedAt.current).catch(reason => {
        if (active) { setError(reason instanceof Error ? reason.message : 'Walk could not load. Please exit and try again.'); viewer?.dispose(); runtime.current = null; }
      });
    } catch (reason) { surface.release(); setError(reason instanceof Error ? reason.message : 'Walk could not start.'); }
    return () => { active = false; viewer?.dispose(); runtime.current = null; };
  }, [started, ready, choice, solids, property]);
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
      {started && <div className="world-walk-scene"><ThreeStage ref={stage} solids={solids} camera={camera}
        width={size.width} height={size.height} hover={null} wallView="up" presentation="architectural"
        onReady={stageReady} onFailed={() => { runtime.current?.dispose(); runtime.current = null; setError('WebGL is unavailable. Exit to return to your design.'); }} /></div>}
      <header className="world-walk-header"><div><strong>Walk mode</strong><span>Explore your design</span></div>
        <button type="button" onClick={onClose} className="world-walk-exit">Exit walk <span aria-hidden="true">×</span></button></header>
      {!started ? <div className="world-walk-card" data-testid="walk-chooser">
        <p className="world-walk-eyebrow">A walk through your home</p><h1>Choose your character</h1>
        <div className="world-walk-characters" role="group" aria-label="Character">
          {WALK_CHARACTERS.map(character => <button key={character.id} type="button" aria-pressed={choice === character.id} onClick={() => setChoice(character.id)}>
            <img src={character.thumbnailUrl} alt="" width="96" height="96" /><span>{character.label}</span>
          </button>)}
        </div>
        <div className="world-walk-controls-card"><strong>Ready in ten seconds</strong>
          <p><b>Keyboard:</b> WASD or arrows to move · Shift to run · mouse to look · V to switch view · E for doors · Esc to exit.</p>
          <p><b>Phone:</b> use one thumb to move and turn on the pad. Drag the open view to look. Tap the door button when close.</p>
        </div>
        <button type="button" className="world-walk-primary" onClick={begin}>Start walk</button>
        <p className="world-walk-small">Doors and movement stay in this visit. Your saved design stays as it is.</p>
        <p className="world-walk-small">Roof coverings are hidden so connected roof terraces remain accessible.</p>
        <a href="https://kenney.nl/assets/mini-characters" target="_blank" rel="noreferrer">Characters by Kenney · CC0</a>
      </div> : error ? <div className="world-walk-card" role="alert"><h1>Walk is unavailable</h1><p>{error}</p><button type="button" onClick={onClose}>Return to design</button></div>
      : !status ? <div className="world-walk-loading" role="status">Preparing your walk…</div> : <>
        <div className="world-walk-look" aria-label="Drag to look" onClick={() => { if (matchMedia('(pointer:fine)').matches) runtime.current?.lock(); }}
          onPointerDown={event => { if (event.pointerType !== 'mouse' || !status.locked) { lookPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); } }}
          onPointerMove={event => { const pointer = lookPointer.current; if (pointer?.id === event.pointerId) { runtime.current?.dragLook(event.clientX - pointer.x, event.clientY - pointer.y); pointer.x = event.clientX; pointer.y = event.clientY; } }}
          onPointerUp={() => { lookPointer.current = null; }} onPointerCancel={() => { lookPointer.current = null; }} />
        <div className="world-walk-toolbar">
          <button type="button" onClick={() => runtime.current?.toggleView()}>{status.mode === 'third' ? 'First person' : 'Third person'}</button>
          <button type="button" aria-pressed={running} onClick={() => { setRunning(!running); runtime.current?.setRunning(!running); }}>{running ? 'Running' : 'Walk / run'}</button>
          <button type="button" aria-expanded={help} onClick={() => { runtime.current?.clearInput(); setHelp(!help); }}>Controls</button>
        </div>
        {help && <div className="world-walk-help"><strong>Make yourself at home</strong><p>WASD / arrows: move. Shift: run. Mouse / drag: look. V: first / third person. E: door within 2 m. Escape: exit.</p><p>On a phone, the pad moves forward / back and turns left / right with one thumb.</p><button type="button" onClick={() => setHelp(false)}>Got it</button></div>}
        <div className="world-walk-aim" aria-hidden="true">·</div>
        <div className="world-walk-door" role="status">{status.blocked ? <span>Step away so the door can move safely.</span> : status.door && <button type="button" onClick={() => runtime.current?.interact()}>{status.door} <kbd>E</kbd></button>}</div>
        <div className="world-walk-stick" role="application" aria-label="Move and turn with one thumb" tabIndex={0}
          onPointerDown={event => { stickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }}
          onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <span className="world-walk-stick-knob" /><span className="world-walk-stick-label">Move + turn</span>
        </div>
        <p className="world-walk-hint">{status.locked ? 'E doors · V view · Esc exit' : 'Click or drag to look · E doors · V view'}</p>
        <a className="world-walk-credit" href="https://kenney.nl/assets/mini-characters" target="_blank" rel="noreferrer">Kenney · CC0</a>
      </>}
    </section>, document.body,
  );
}
