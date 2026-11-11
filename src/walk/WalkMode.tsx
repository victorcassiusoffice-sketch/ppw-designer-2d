import type {LiveWalkView} from '../components/three/HouseStageSlot';
import { lazy,Suspense,useLayoutEffect,useCallback, useEffect, useRef, useState } from 'react';
import { SharedBuildButton } from '../sharedBuild/SharedBuildButton';
import {parkWalker,detachWalker,clearParkedWalker} from './buildReturn';
import { BoundaryTools } from '../components/three/BoundaryTools';
import { usePropertyStore } from '../store/propertyStore';
import { createPortal } from 'react-dom';
import { ThreeStage, type ThreeStageHandle } from '../components/three/ThreeStage';
import type { SceneSolids } from '../designer/roomSolids';
import type { OrbitCamera } from '../designer/roomView3d';
import { isRoofLevel, type Level } from '../designer/levels';
import { walkWords } from './words';
import { useAppPreferences } from '../i18n/AppPreferences';
import type { PlacementHint } from './placement';
import type { Property } from '../store/propertyStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { DEFAULT_WALK_CHARACTER_ID, WALK_CHARACTERS } from './characters';
import type { WalkRuntime, WalkStatus } from './runtime';
import { createTapActivator, ownTouchSequences } from './touchInput';
import './walk.css';

const EarthworkTool=lazy(()=>import('./EarthworkTool'));
const camera: OrbitCamera = { target: { x: 0, y: 0, z: 1 }, distanceM: 10, azimuthRad: 0, elevationRad: .6, fovRad: Math.PI / 3 };
const preferenceKey = 'olb-world-character-v1';
function savedCharacter(): string {
  try { const id = localStorage.getItem(preferenceKey); return WALK_CHARACTERS.find(c => c.id === id)?.id ?? DEFAULT_WALK_CHARACTER_ID; }
  catch { return DEFAULT_WALK_CHARACTER_ID; }
}

/** Callback ref: the look surface and the pad own their touch contacts while mounted. */
function useOwnedTouchSurface(): (node: HTMLDivElement | null) => void {
  const release = useRef<(() => void) | null>(null);
  return useCallback((node: HTMLDivElement | null) => {
    release.current?.(); release.current = node ? ownTouchSequences(node) : null;
  }, []);
}

function ControlsCopy({ touchFirst }: { touchFirst: boolean }): JSX.Element {
  const touch = <p key="touch"><b>Touch:</b> Use the pad to move and turn. Drag the view to look. Tap a door button when close. Tap Exit walk to return to your design.</p>;
  const keyboard = <p key="keyboard"><b>Keyboard and mouse:</b> WASD or arrows to move · Shift to run · mouse to look · V to switch view · E for doors. Esc frees the mouse; press Esc again to exit.</p>;
  return <>{touchFirst ? [touch, keyboard] : [keyboard, touch]}</>;
}

export default function WalkMode({ prepareVisit, onClose, initial, levels = [],live }: {
  prepareVisit: () => { property: Property; solids: SceneSolids; invalidStairs?: number };
  initial?: PlacementHint; levels?: Level[];
  live?:LiveWalkView;
  onClose: () => void;
}): JSX.Element {
  const pref = useAppPreferences();
  const tx = walkWords(pref.locale, pref.tx);
  const [levelId, setLevelId] = useState(initial?.levelId ?? levels[0]?.id);
  const [levelChosen, setLevelChosen] = useState(!!initial);
  const [fallback, setFallback] = useState(false);
  const topFloor = [...levels].reverse().find(l => !isRoofLevel(l));
  const boundaryComponents=usePropertyStore(s=>s.property.boundaryComponents);
  const host = useRef<HTMLElement>(null);
  const walkSlot=useRef<HTMLDivElement>(null);
  const [building,setBuilding]=useState(false);
  const [earthwork,setEarthwork]=useState(false);
  const stage = useRef<ThreeStageHandle>(null);
  const runtime = useRef<WalkRuntime | null>(null);
  const [choice, setChoice] = useState(savedCharacter);
  useEffect(() => {
    const change=(e:Event)=>{const id=(e as CustomEvent<string>).detail;if(WALK_CHARACTERS.some(c=>c.id===id))setChoice(id)};
    window.addEventListener('olb:live-avatar',change);
    return ()=>window.removeEventListener('olb:live-avatar',change);
  },[]);
  const character = WALK_CHARACTERS.find(c => c.id === choice) ?? WALK_CHARACTERS[0];
  const characterCredit = character.licence === 'CC0-1.0'
    ? <a href="https://kenney.nl/assets/mini-characters" target="_blank" rel="noreferrer">Kenney · CC0</a>
    : <span title={character.licence}>{character.label} · {tx('Generated character')}</span>;
  const [started, setStarted] = useState(!!initial);
  const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('Preparing your walk…');
  const [visit, setVisit] = useState<ReturnType<typeof prepareVisit> | null>(null);
  const lastVisit = useRef<ReturnType<typeof prepareVisit> | null>(null);
  const currentVisit = useRef(visit); currentVisit.current=visit;
  const hasVisit=!!visit;
  const liveProperty=usePropertyStore(s=>s.property);
  const [status, setStatus] = useState<WalkStatus | null>(null);
  const [size, setSize] = useState({ width: innerWidth, height: innerHeight });
  const [touchControls, setTouchControls] = useState(() => window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const startedAt = useRef(initial ? performance.now() : 0);
  const stickPointer = useRef<number | null>(null);
  const lookPointer = useRef<{ id: number; x: number; y: number; startX: number; startY: number; dragged: boolean } | null>(null);
  const aimStick = useRef<number | null>(null);
  const initialPose = useRef<{ levelId: string; point?: PlacementHint['point'] } | undefined>(initial);
  const closeVisit = useRef(onClose);
  closeVisit.current = onClose;
  const prepare = useRef(prepareVisit);
  prepare.current = prepareVisit;
  const lookSurface = useOwnedTouchSurface(), stickSurface = useOwnedTouchSurface();
  const doorTap = useRef(createTapActivator(() => { runtime.current?.interact(); })).current;
  useWorkspaceFocus(host, () => { if (!runtime.current?.escape()) onClose(); }, { enabled:!building,onKeyDown: event => { if (!help) runtime.current?.keyDown(event); } });
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
  useLayoutEffect(()=>{
    if(!live||!started||!hasVisit)return;
    live.mount.show(building?null:walkSlot.current);
    live.pickWith(building?runtime.current?.editCamera??null:null);
    setReady(true);
    return ()=>{live.pickWith(null);live.mount.show(null)};
  },[live,started,hasVisit,building]);
  useEffect(()=>{
    if(!live)return;
    live.setView(started&&visit&&!building?{solids:visit.solids,width:size.width,height:size.height}:null);
    return ()=>live.setView(null);
  },[live,started,visit,building,size.width,size.height]);
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
  }, [started,liveProperty]);
  useEffect(() => {
    if (!started || !ready || !hasVisit) return;
    const surface = live ? live.surface() : stage.current?.beginWalk();
    if (!surface) return;
    let active = true, viewer: WalkRuntime | undefined;
    let release = () => surface.release();
    setLoading('Loading walk controls…');
    void import('./runtime').then(async ({ WalkRuntime: Runtime }) => {
      if (!active) return;
      const initialVisit=currentVisit.current; if(!initialVisit)return;
      lastVisit.current=initialVisit;
      viewer = new Runtime(surface, initialVisit.solids, initialVisit.property, value => { if (active) setStatus(value); }, () => closeVisit.current(), initialPose.current);
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
  }, [started, ready, choice, hasVisit,live]);
  useEffect(()=>{
    if(visit&&runtime.current&&lastVisit.current!==visit){
      lastVisit.current=visit; runtime.current.refreshDesign(visit.solids,visit.property);
    }
  },[visit]);
  useEffect(()=>{if(building)return ()=>detachWalker()},[building]);
  const buildFromHere=()=>{
    if(!status)return;
    parkWalker(liveProperty.id,{levelId:status.levelId??levelId??levels[0]?.id??'ground',point:{x:status.position[0],y:status.position[2]}});
    runtime.current?.startBuilding();setBuilding(true);
  };
  const begin = () => {
    try { localStorage.setItem(preferenceKey, choice); } catch { /* A private session can still walk. */ }
    initialPose.current = levelChosen && levelId ? { levelId } : undefined;
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
  const chooseLevel = (id: string) => {
    if (runtime.current && !runtime.current.chooseLevel(id)) { setFallback(true); return; }
    setLevelId(id); setLevelChosen(true); setFallback(false);
  };
  const levelPicker = levels.length > 0 && <label className="world-level-picker">{tx('Level')}
    <select aria-label={tx('Walk level')} value={status?.levelId ?? levelId} onChange={e => chooseLevel(e.target.value)}>
      {levels.map(l => <option key={l.id} value={l.id}>{tx(l.name)}</option>)}
    </select></label>;
  const retry = () => { setError(''); setReady(false); setVisit(null); setStatus(null); setStarted(false); setFallback(false); };
  const steerLook = (e: React.PointerEvent<HTMLDivElement>) => {
    if (aimStick.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    runtime.current?.setLookStick(x, y);
    e.currentTarget.style.setProperty('--stick-x', x * 17 + 'px'); e.currentTarget.style.setProperty('--stick-y', y * 17 + 'px');
  };
  const stopLook = (e: React.PointerEvent<HTMLDivElement>) => {
    if (aimStick.current !== e.pointerId) return;
    aimStick.current = null; runtime.current?.setLookStick(0, 0);
    e.currentTarget.style.setProperty('--stick-x','0px'); e.currentTarget.style.setProperty('--stick-y','0px');
  };
  if(building&&live)return createPortal(<div className="walk-build-return" data-testid="walk-build-return" data-world-walk="true" data-status={status?JSON.stringify(status):undefined}>
    <strong>Building in Walk</strong><button onClick={()=>{clearParkedWalker();setBuilding(false)}}>Resume walking</button>
    <button onClick={()=>runtime.current?.toggleOverview()}>Whole build</button><button onClick={onClose}>Exit walk</button>
  </div>,document.body);
  return createPortal(
    <section ref={host} className="world-walk" data-world-walk="true" role="dialog" aria-modal="true" aria-label="Walk mode"
      data-testid="world-walk" data-status={status ? JSON.stringify(status) : undefined}>
      {started && visit && <div className="world-walk-scene" ref={walkSlot}>{!live&&<ThreeStage ref={stage} solids={visit.solids} terrainCuts={liveProperty.terrainCuts} boundaryComponents={boundaryComponents} camera={camera}
        width={size.width} height={size.height} hover={null} wallView="up" presentation="architectural"
        onReady={stageReady} onFailed={() => { runtime.current?.dispose(); runtime.current = null; setError('WebGL is unavailable. Exit to return to your design.'); }} />}</div>}
      <header className="world-walk-header"><div><strong>Walk mode</strong><span>Explore your design</span></div>
        <button type="button" onClick={onClose} className="world-walk-exit">Exit walk <span aria-hidden="true">×</span></button></header>
      {!started ? <div className="world-walk-card" data-testid="walk-chooser">
        <p className="world-walk-eyebrow">A walk through your home</p><h1>Choose your character</h1>
        <div className="world-walk-characters" role="group" aria-label="Character">
          {WALK_CHARACTERS.map(character => <button key={character.id} type="button" aria-pressed={choice === character.id} onClick={() => setChoice(character.id)}>
            <img src={character.thumbnailDataUrl} data-thumbnail-source={character.thumbnailUrl} alt="" width="64" height="64" decoding="sync" loading="eager" /><span>{character.label}</span>
          </button>)}
        </div>
        {levelPicker}
        <div className="world-walk-controls-card"><strong>How to walk</strong>
          <ControlsCopy touchFirst={touchControls} />
        </div>
        <button type="button" className="world-walk-primary" onClick={begin}>Start walk</button>
        <p className="world-walk-small">Doors and movement stay in this visit. Your saved design stays as it is.</p>
        <p className="world-walk-small">{tx('Choose a level to start there, even without stairs.')}</p>
        {characterCredit}
      </div> : error ? <div className="world-walk-card" role="alert"><h1>Walk is unavailable</h1><p>{tx(error)}</p><button type="button" onClick={() => { retry(); if (topFloor) chooseLevel(topFloor.id); }}>{tx(topFloor ? 'Go to top floor' : 'Choose another starting point')}</button><button type="button" onClick={onClose}>Return to design</button></div>
      : !status ? <div className="world-walk-loading" role="status" aria-live="polite"><span className="world-walk-spinner" aria-hidden="true" />{loading}</div> : <>
        <div className="world-walk-look" ref={lookSurface} aria-label="Drag to look"
          onPointerDown={e => {
            if (!e.isPrimary || status.locked || e.button !== 0) return;
            lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragged: false };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e => { const p = lookPointer.current; if (p?.id !== e.pointerId) return;
            p.dragged ||= Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 5;
            if (p.dragged) runtime.current?.dragLook(e.clientX - p.x, e.clientY - p.y);
            p.x = e.clientX; p.y = e.clientY;
          }}
          onPointerUp={e => { const p = lookPointer.current; lookPointer.current = null;
            if (p?.id === e.pointerId && !p.dragged) void runtime.current?.moveToScreen(e.clientX,e.clientY);
          }} onPointerCancel={() => { lookPointer.current = null; }} />
        <div className="world-walk-toolbar">
          {live&&<button type="button" onClick={buildFromHere}>Build from here</button>}
          <button type="button" aria-expanded={earthwork} onClick={()=>{if(document.pointerLockElement)document.exitPointerLock?.();setEarthwork(v=>!v)}}>Dig / fill</button>
          {earthwork&&<Suspense fallback={null}><EarthworkTool view={{element:()=>host.current,ray:(x,y)=>runtime.current?.drawingRay(x,y)??null,project:p=>runtime.current?.drawingProjection(p)??null}} onClose={()=>setEarthwork(false)}/></Suspense>}
          <SharedBuildButton/>
          <BoundaryTools beforeOpen={()=>{if(document.pointerLockElement)document.exitPointerLock?.()}} view={{
            element:()=>host.current,
            ray:(x,y)=>runtime.current?.drawingRay(x,y)??null,
            project:p=>runtime.current?.drawingProjection(p)??null,
          }}/>
          {levelPicker}
          <button type="button" data-testid="walk-cutaway" aria-pressed={!!status.cutaway} onClick={() => runtime.current?.toggleCutaway()}>{tx('Cutaway')}</button>
          <button type="button" data-testid="walk-overview" aria-pressed={!!status.overview} onClick={() => runtime.current?.toggleOverview()}>{tx('Whole build')}</button>
          {!touchControls && <button type="button" onClick={() => runtime.current?.lock()}>{tx('Mouse look')}</button>}
          <button type="button" onClick={() => runtime.current?.toggleView()}>{status.mode === 'third' ? 'First person' : 'Third person'}</button>
          <button type="button" aria-pressed={running} onClick={() => { setRunning(!running); runtime.current?.setRunning(!running); }}>{running ? 'Running' : 'Walk / run'}</button>
          <button type="button" aria-expanded={help} onClick={() => { runtime.current?.clearInput(); setHelp(!help); }}>Controls</button>
        </div>
        {(fallback || status.notice || !!visit?.invalidStairs) && <div className="world-walk-notice" role="status">
          {fallback ? <>{tx('No clear standing surface on this level.')} {topFloor && <button type="button" onClick={() => chooseLevel(topFloor.id)}>{tx('Go to top floor')}</button>}</>
            : tx(status.notice || 'A stair no longer fits its floors. It is unavailable in this visit.')}
        </div>}
        {help && <div className="world-walk-help"><strong>How to walk</strong><ControlsCopy touchFirst={touchControls} /><button type="button" onClick={() => setHelp(false)}>Got it</button></div>}
        <div className="world-walk-aim" aria-hidden="true">·</div>
        <div className="world-walk-door" role="status">{status.blocked ? <span>Step away so the door can move safely.</span> : status.door && <button type="button" aria-label={status.door}
          onPointerDown={event => doorTap.pointerDown(event)} onPointerUp={event => doorTap.pointerUp(event)} onPointerCancel={event => doorTap.pointerCancel(event)} onClick={() => doorTap.click()}>{status.door}{!touchControls && <> <kbd aria-hidden="true">E</kbd></>}</button>}</div>
        <div className="world-walk-stick" ref={stickSurface} role="application" aria-label="Move and turn with one thumb" tabIndex={0}
          onPointerDown={event => { stickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }}
          onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <span className="world-walk-stick-knob" /><span className="world-walk-stick-label">Move + turn</span>
        </div>
        {touchControls && <div className="world-look-stick" aria-label={tx('Look around')} role="application"
          onPointerDown={e => { aimStick.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); steerLook(e); }}
          onPointerMove={steerLook} onPointerUp={stopLook} onPointerCancel={stopLook} onLostPointerCapture={stopLook}>
          <span className="world-walk-stick-knob"/><span className="world-walk-stick-label">{tx('Look')}</span>
        </div>}
        <p className="world-walk-hint">{touchControls ? 'Pad: move + turn · Drag: look · Tap doors · Exit walk: return' : status.locked ? 'Esc frees the mouse · E doors · V view' : tx('Click or drag · Click to walk · Drag to look · E doors · V view · B whole build · Esc exits')}</p>
        <span className="world-walk-credit">{characterCredit}</span>
      </>}
    </section>, document.body,
  );
}
