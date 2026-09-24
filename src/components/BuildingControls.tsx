import { useEffect, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { activeLevelIdOf, isRoofLevel } from '../designer/levels';
import { fitStairInRoom, validateStairPlacement } from '../designer/stairPlacement';
import {
  buildingLevels, levelHeightM, MAX_LEVEL_HEIGHT_M, MIN_LEVEL_HEIGHT_M,
  roofConfigOf, stairRiseM, type BuildingStair, type RoofConfig,
} from '../designer/building';

export interface BuildingControlsProps {
  layout?: 'toolbar' | 'sidebar';
  view: 'building' | 'floor';
  onViewChange: (view: 'building' | 'floor') => void;
  showRoof: boolean;
  onShowRoofChange: (show: boolean) => void;
  tool: 'select' | 'wall' | 'room' | 'stair' | 'window' | 'door';
  onToolChange: (tool: 'select' | 'wall' | 'room' | 'stair' | 'window' | 'door') => void;
  onGardenToggle: () => void;
  gardenOpen: boolean;
}

const BUTTON = 'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-ppw-rim bg-white px-3 text-xs font-medium text-[#37362f] transition-colors hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal disabled:cursor-not-allowed disabled:opacity-35';
const ACTIVE = '!border-ppw-teal !bg-[#e7f1eb] !text-ppw-teal';
const FIELD = 'h-11 min-w-0 rounded-xl border border-ppw-rim bg-white px-2 text-base tabular-nums text-[#37362f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal md:text-sm';
const TOOL = 'inline-flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent px-1 text-[10px] font-medium text-[#5b5852] transition-colors hover:border-ppw-rim hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal disabled:cursor-not-allowed disabled:opacity-35 md:flex-none md:flex-row md:gap-2 md:px-3 md:text-xs';

type BuildIconName = 'floor' | 'house' | 'wall' | 'plus' | 'select' | 'stairs' | 'window' | 'door' | 'garden' | 'roof' | 'settings' | 'close' | 'up' | 'down';
function BuildIcon({ name, className = 'h-[18px] w-[18px]' }: { name: BuildIconName; className?: string }) {
  const paths: Record<BuildIconName, string> = {
    floor: 'M3 8 12 3l9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5',
    house: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
    wall: 'M3 20V8l12-5v12l-12 5Zm12-5 6 4V7l-6-4M3 12l12-5M3 16l12-5M9 6v4M7 14v4',
    plus: 'M12 5v14M5 12h14',
    select: 'm5 3 14 9-7 1-3 8-4-18Z',
    stairs: 'M3 21v-6h6V9h6V3h6M3 21h18V3',
    window: 'M4 3h16v18H4V3Zm8 0v18M4 12h16',
    door: 'M5 21V3h14v18M3 21h18M14 12h1',
    garden: 'M12 21v-9M12 15C4 15 3 9 4 5c5 0 8 3 8 7M12 12c0-6 4-9 9-9 0 6-3 10-9 10M6 21h12',
    roof: 'm2 13 10-9 10 9M4 13h16M6 13v7h12v-7M9 20v-5h6v5',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    close: 'm6 6 12 12M6 18 18 6',
    up: 'm6 14 6-6 6 6',
    down: 'm6 10 6 6 6-6',
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function BuildingNumber({ label, value, min, max, step = 0.1, unit = 'm', testId, onCommit, invalidMessage }: {
  label: string; value: number; min?: number; max?: number; step?: number; unit?: string;
  testId: string; onCommit: (value: number) => boolean | void; invalidMessage?: string;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(2))));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraft(String(Number(value.toFixed(2)))); setError(null); }, [value]);
  function commit() {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number)) {
      setDraft(String(Number(value.toFixed(2))));
      setError('Enter a finite number.');
      return;
    }
    if ((min !== undefined && number < min) || (max !== undefined && number > max)) {
      setDraft(String(Number(value.toFixed(2))));
      setError(min !== undefined && max !== undefined ? `Use ${min}–${max} ${unit}.`
        : min !== undefined ? `Use at least ${min} ${unit}.` : `Use at most ${max} ${unit}.`);
      return;
    }
    if (onCommit(number) === false) {
      setDraft(String(Number(value.toFixed(2))));
      setError(invalidMessage ?? 'This value could not be applied.');
    } else setError(null);
  }
  return <label className="flex min-w-0 flex-col gap-1 text-xs text-[#5b5852]">
    {label} ({unit})
    <input className={FIELD} type="number" inputMode="decimal" min={min} max={max} step={step}
      value={draft} data-testid={testId} aria-invalid={!!error}
      aria-describedby={error ? `${testId}-error` : undefined}
      onChange={(event) => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') { setDraft(String(Number(value.toFixed(2)))); setError(null); }
      }} />
    {error && <span id={`${testId}-error`} className="text-[11px] text-ppw-coral" role="alert">{error}</span>}
  </label>;
}

/** House tools stay in sight; dimensions float over the scene only when needed. */
export function BuildingControls({
  layout = 'toolbar', view, onViewChange, showRoof, onShowRoofChange, tool, onToolChange, onGardenToggle, gardenOpen,
}: BuildingControlsProps): JSX.Element {
  const property = usePropertyStore((state) => state.property);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspector, setInspector] = useState<'floor' | 'roof' | 'stairs'>('floor');
  const [selectedStairId, setSelectedStairId] = useState<string | null>(null);
  const [stairError, setStairError] = useState<string | null>(null);
  const levels = buildingLevels(property);
  const activeId = activeLevelIdOf(property);
  const active = levels.find((entry) => entry.level.id === activeId) ?? levels[0];
  const activeIndex = levels.findIndex((entry) => entry.level.id === activeId);
  const onRoofLevel = isRoofLevel(active.level);
  const storeys = levels.filter((entry) => !isRoofLevel(entry.level));
  const storeyIndex = storeys.findIndex((entry) => entry.level.id === activeId);
  const lowerStairLevel = storeyIndex < storeys.length - 1 ? storeys[storeyIndex] : storeys[storeyIndex - 1];
  const upperStairLevel = storeyIndex < storeys.length - 1 ? storeys[storeyIndex + 1] : storeys[storeyIndex];
  const canPlaceStairs = !onRoofLevel && !!lowerStairLevel && !!upperStairLevel;
  const roof = roofConfigOf(property);
  const hasRoof = levels.some((entry) => isRoofLevel(entry.level));
  const stairs = property.stairs ?? [];
  const stair = stairs.find((entry) => entry.id === selectedStairId)
    ?? stairs.find((entry) => entry.fromLevelId === activeId) ?? stairs[0];
  const floorName = (id: string) => levels.find((entry) => entry.level.id === id)?.level.name ?? 'Floor';
  const height = levelHeightM(property, activeId);
  useEffect(() => { setStairError(null); }, [stair?.id]);
  useEffect(() => {
    if (!detailsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetailsOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [detailsOpen]);

  function selectFloor(id: string) {
    usePropertyStore.getState().setActiveLevel(id);
    onToolChange('select');
    const selected = levels.find((entry) => entry.level.id === id);
    if (selected && isRoofLevel(selected.level)) onShowRoofChange(true);
  }

  function chooseTool(next: BuildingControlsProps['tool']) {
    if (gardenOpen) onGardenToggle();
    onToolChange(next);
    if (next === 'stair') setInspector('stairs');
    if (next === 'window' || next === 'door' || next === 'wall' || next === 'room') setDetailsOpen(false);
    if (next === 'wall' || next === 'room') window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
  }

  function addFloor() {
    const source = onRoofLevel ? storeys[storeys.length - 1]?.level.id : activeId;
    usePropertyStore.getState().addLevel(undefined, source);
    onToolChange('select');
    onViewChange('building');
    onShowRoofChange(false);
    setDetailsOpen(false);
    setInspector('floor');
  }

  function toggleRoof() {
    if (gardenOpen) onGardenToggle();
    onToolChange('select');
    const nextShow = !hasRoof || !showRoof;
    if (!nextShow && onRoofLevel) {
      const highestStorey = storeys[storeys.length - 1];
      if (highestStorey) usePropertyStore.getState().setActiveLevel(highestStorey.level.id);
    }
    if (nextShow && (!hasRoof || !property.roof)) {
      usePropertyStore.getState().setRoofConfig(roof);
    }
    onShowRoofChange(nextShow);
    if (nextShow) onViewChange('building');
    setInspector('roof');
    setDetailsOpen(nextShow);
  }

  function changeRoof(patch: Partial<RoofConfig>) {
    usePropertyStore.getState().setRoofConfig({ ...roof, ...patch });
    onShowRoofChange(true);
    onViewChange('building');
  }

  function updateStair(patch: Partial<BuildingStair>) {
    if (!stair) return false;
    const valid = validateStairPlacement(property, { ...stair, ...patch });
    if (!valid.ok) { setStairError(valid.message); return false; }
    const updated = usePropertyStore.getState().updateStair(stair.id, patch);
    setStairError(updated ? null : 'This stair could not be changed. Check the space on both connected floors.');
    return updated;
  }

  function fitStairs() {
    if (!canPlaceStairs) return;
    const rise = upperStairLevel.elevationM - lowerStairLevel.elevationM;
    const fitted = fitStairInRoom(property, property.activeRoomId, {
      id: 'preview', fromLevelId: lowerStairLevel.level.id, toLevelId: upperStairLevel.level.id,
      x: 0, y: 0, widthM: 1, runM: Math.max(3, rise * 1.2), rotation: 0,
    });
    if (!fitted) { setStairError('No clear fit in this room on both floors. Choose a larger room or use tap placement.'); return; }
    const id = usePropertyStore.getState().addStair(fitted);
    if (id) { setSelectedStairId(id); setStairError(null); onToolChange('select'); }
  }

  const toolHelp = tool === 'wall' ? 'Drag a wall, then tap or drag the next corner. Return to the first corner to make a room. Finish run keeps open walls.' : tool === 'room' ? 'Drag from corner to corner to build a room. Two fingers move the view.' : tool === 'stair'
    ? canPlaceStairs
      ? `Tap the floor to place stairs from ${lowerStairLevel.level.name} to ${upperStairLevel.level.name}.`
      : 'Add a second floor, then select a floor to place stairs.'
    : tool === 'window' ? `Tap a wall on ${active.level.name} to add a window.`
      : tool === 'door' ? `Tap a wall on ${active.level.name} to add a door.` : null;

  return <section className="shrink-0 min-w-0 border-b border-ppw-rim bg-[#faf8f3] text-[#37362f]" aria-label="Building controls" data-testid="building-controls" data-layout={layout}>
    <div className="flex min-w-0 items-center gap-1.5 px-2 pt-1.5 md:gap-2 md:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
        <span className="hidden text-ppw-teal md:block"><BuildIcon name="floor" /></span>
        <select aria-label="Active floor" data-testid="building-floor-select" value={activeId}
          className={`${FIELD} w-full text-[13px] md:w-40`} onChange={(event) => selectFloor(event.target.value)}>
          {levels.map((entry) => <option key={entry.level.id} value={entry.level.id}>{entry.level.name}</option>)}
        </select>
        <div className="hidden gap-1 md:flex">
          <button type="button" className={`${BUTTON} w-11 px-0`} aria-label="Floor below" title="Floor below" disabled={activeIndex <= 0} onClick={() => selectFloor(levels[activeIndex - 1].level.id)}><BuildIcon name="down" /></button>
          <button type="button" className={`${BUTTON} w-11 px-0`} aria-label="Floor above" title="Floor above" disabled={activeIndex >= levels.length - 1} onClick={() => selectFloor(levels[activeIndex + 1].level.id)}><BuildIcon name="up" /></button>
        </div>
      </div>
      <button type="button" className={`${BUTTON} w-11 px-2 sm:w-auto`} onClick={addFloor} data-testid="building-add-floor" aria-label="Add floor"
        title={`Add a floor using the ${onRoofLevel ? 'top floor' : active.level.name} layout`}><BuildIcon name="plus" /><span className="hidden sm:inline">Floor</span></button>
      <div className="flex shrink-0 gap-0.5 rounded-xl bg-[#ebe7df] p-0.5 md:ml-auto" role="group" aria-label="Building view">
        <button type="button" className={`${BUTTON} gap-1 border-transparent bg-transparent px-2 ${view === 'building' ? '!border-white !bg-white shadow-sm' : ''}`} aria-label="Whole building" title="Whole building" aria-pressed={view === 'building'} data-testid="building-view-building" onClick={() => onViewChange('building')}><BuildIcon name="house" /><span className="text-[11px] md:text-xs">House</span></button>
        <button type="button" className={`${BUTTON} gap-1 border-transparent bg-transparent px-2 ${view === 'floor' ? '!border-white !bg-white shadow-sm' : ''}`} aria-label="This floor" title="This floor" aria-pressed={view === 'floor'} data-testid="building-view-floor" onClick={() => onViewChange('floor')}><BuildIcon name="floor" /><span className="text-[11px] md:text-xs">Floor</span></button>
      </div>
      <button type="button" className={`${BUTTON} w-11 px-0 ${detailsOpen ? ACTIVE : ''}`}
        data-testid="building-details-toggle" aria-label="Build settings" title="Build settings" aria-expanded={detailsOpen} aria-controls="building-details"
        onClick={() => { if (gardenOpen) onGardenToggle(); setDetailsOpen(!detailsOpen); }}><BuildIcon name="settings" /></button>
    </div>

    <div className="flex min-w-0 items-center gap-0.5 px-2 py-1 md:gap-1 md:px-3" role="group" aria-label="House building tools">
      <select aria-label="3D build tool" data-testid="building-tool-select" value={tool}
        className={`${FIELD} mr-1 flex-1 text-[13px] md:hidden ${tool !== 'select' ? ACTIVE : ''}`}
        onChange={(event) => chooseTool(event.target.value as BuildingControlsProps['tool'])}>
        <option value="select">Select / move</option>
        <option value="wall" disabled={onRoofLevel}>Draw walls</option>
        <option value="room" disabled={onRoofLevel}>Draw room</option>
        <option value="stair" disabled={!canPlaceStairs}>Stairs</option>
        <option value="window" disabled={onRoofLevel}>Window</option>
        <option value="door" disabled={onRoofLevel}>Door</option>
      </select>
      <button type="button" className={`${TOOL} hidden md:inline-flex ${tool === 'select' ? ACTIVE : ''}`} aria-pressed={tool === 'select'} onClick={() => chooseTool('select')}><BuildIcon name="select" />Select / move</button>
      <button type="button" className={`${TOOL} hidden md:inline-flex ${tool === 'wall' ? ACTIVE : ''}`} aria-pressed={tool === 'wall'} disabled={onRoofLevel} onClick={() => chooseTool(tool === 'wall' ? 'select' : 'wall')}><BuildIcon name="wall" />Draw walls</button>
      <button type="button" className={`${TOOL} hidden md:inline-flex ${tool === 'room' ? ACTIVE : ''}`} aria-pressed={tool === 'room'} disabled={onRoofLevel} onClick={() => chooseTool(tool === 'room' ? 'select' : 'room')}><BuildIcon name="house" />Draw room</button>
      <button type="button" className={`${TOOL} hidden md:inline-flex ${tool === 'stair' ? ACTIVE : ''}`} aria-pressed={tool === 'stair'} disabled={!canPlaceStairs} title={canPlaceStairs ? `Stairs: ${lowerStairLevel.level.name} to ${upperStairLevel.level.name}` : 'Add a second floor to build stairs'} onClick={() => chooseTool(tool === 'stair' ? 'select' : 'stair')}><BuildIcon name="stairs" />Stairs</button>
      <button type="button" className={`${TOOL} hidden md:inline-flex ${tool === 'window' ? ACTIVE : ''}`} aria-pressed={tool === 'window'} disabled={onRoofLevel} onClick={() => chooseTool(tool === 'window' ? 'select' : 'window')}><BuildIcon name="window" />Window</button>
      <button type="button" className={`${TOOL} hidden md:inline-flex ${tool === 'door' ? ACTIVE : ''}`} aria-pressed={tool === 'door'} disabled={onRoofLevel} onClick={() => chooseTool(tool === 'door' ? 'select' : 'door')}><BuildIcon name="door" />Door</button>
      <span className="mx-0.5 h-6 w-px shrink-0 bg-ppw-rim md:mx-2" />
      <button type="button" className={`${TOOL} ${gardenOpen ? ACTIVE : ''}`} aria-pressed={gardenOpen} data-testid="building-garden-toggle" onClick={() => { setDetailsOpen(false); onToolChange('select'); onGardenToggle(); }}><BuildIcon name="garden" />Garden</button>
      <button type="button" className={`${TOOL} ${hasRoof && showRoof ? ACTIVE : ''}`} aria-pressed={hasRoof && showRoof} title={hasRoof ? showRoof ? 'Hide roof' : 'Show roof' : 'Add roof'} data-testid="building-roof-toggle" onClick={toggleRoof}><BuildIcon name="roof" />Roof</button>
      <span className="ml-auto hidden whitespace-nowrap pl-3 text-[11px] text-[#787369] lg:block">{storeys.length} {storeys.length === 1 ? 'floor' : 'floors'} · {active.elevationM.toFixed(2)} m elevation</span>
    </div>

    {toolHelp && !detailsOpen && layout !== 'sidebar' && <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-ppw-rim bg-[#fffdf8]/95 pl-3 text-[11px] shadow-lg backdrop-blur-sm md:left-1/2 md:right-auto md:w-max md:max-w-[calc(100%-24px)] md:-translate-x-1/2" role="status">
      <span>{toolHelp}</span>
      <button type="button" className="min-h-11 shrink-0 rounded-r-2xl px-3 font-semibold text-ppw-teal hover:bg-ppw-mist" onClick={() => onToolChange('select')}>Done</button>
    </div>}

    {(detailsOpen || layout === 'sidebar') && <div id={layout === 'sidebar' ? undefined : "building-details"} className="absolute inset-x-2 bottom-2 z-30 flex max-h-[55%] flex-col overflow-hidden rounded-2xl border border-ppw-rim bg-[#fffdf8] shadow-[0_12px_40px_rgba(44,43,38,0.18)] md:bottom-3 md:left-auto md:right-3 md:top-[112px] md:max-h-none md:w-[304px]" data-testid="building-details" role="region" aria-label="Build inspector">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ppw-rim py-1 pl-4 pr-1">
        <div><p className="text-[13px] font-semibold">Build settings</p><p className="text-[10px] text-[#787369]">{active.level.name}</p></div>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#5b5852] hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal" aria-label="Close build settings" onClick={() => setDetailsOpen(false)}><BuildIcon name="close" /></button>
      </div>
      <div className="flex shrink-0 gap-1 border-b border-ppw-rim px-2 py-1" role="group" aria-label="Build setting category">
        {(['floor', 'stairs', 'roof'] as const).map((section) => <button type="button" key={section} className={`${BUTTON} flex-1 border-transparent px-2 ${inspector === section ? ACTIVE : 'bg-transparent'}`} aria-pressed={inspector === section} onClick={() => setInspector(section)}><BuildIcon name={section === 'stairs' ? 'stairs' : section} />{section === 'floor' ? 'Floor' : section === 'stairs' ? 'Stairs' : 'Roof'}</button>)}
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
        {toolHelp && <div className="mb-3 rounded-xl bg-[#e7f1eb] p-3 text-xs text-[#315149]" role="status"><p>{toolHelp}</p><button type="button" className="mt-1 min-h-11 font-semibold underline underline-offset-2" onClick={() => { setDetailsOpen(false); window.dispatchEvent(new CustomEvent('ppw:close-house-details')); }}>Place in scene</button></div>}
        {inspector === 'floor' && <fieldset className="min-w-0">
          <legend className="mb-3 text-[13px] font-semibold">Floor dimensions</legend>
          {!onRoofLevel ? <>
            <BuildingNumber key={`height-${activeId}`} label="Wall height" value={height} min={MIN_LEVEL_HEIGHT_M} max={MAX_LEVEL_HEIGHT_M} testId="building-floor-height"
              onCommit={(value) => usePropertyStore.getState().setLevelHeight(activeId, value)} />
            <p className="mt-2 text-[11px] text-[#5b5852]">Floor starts at {active.elevationM.toFixed(2)} m. Floors above follow this height.</p>
            {active.level.heightM !== undefined && <button type="button" className="mt-1 min-h-11 text-xs font-medium text-ppw-teal" onClick={() => usePropertyStore.getState().setLevelHeight(activeId, null)}>Use house wall height</button>}
          </> : <p className="text-xs text-[#5b5852]">Roof level · {active.elevationM.toFixed(2)} m above ground. Choose a floor to edit its wall height.</p>}
          <p className="mt-2 text-[11px] text-[#5b5852]">+ Floor copies rooms, windows and free walls from the selected floor.</p>
        </fieldset>}

        {inspector === 'roof' && <fieldset className="min-w-0">
          <legend className="mb-3 text-[13px] font-semibold">Roof design</legend>
          <button type="button" className={`${BUTTON} mb-3 w-full ${hasRoof && showRoof ? ACTIVE : ''}`} aria-pressed={hasRoof && showRoof} onClick={toggleRoof}><BuildIcon name="roof" />{hasRoof ? showRoof ? 'Hide roof' : 'Show roof' : 'Add roof'}</button>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-[#5b5852]">Shape
              <select className={FIELD} aria-label="Roof shape" value={roof.style} data-testid="building-roof-style" onChange={(event) => changeRoof({ style: event.target.value as RoofConfig['style'] })}>
                <option value="flat">Flat</option><option value="gable">Gable</option><option value="shed">Single slope</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-[#5b5852]">Finish
              <select className={FIELD} aria-label="Roof finish" value={roof.material} data-testid="building-roof-material" onChange={(event) => changeRoof({ material: event.target.value as RoofConfig['material'] })}>
                <option value="felt">Felt</option><option value="tile">Tile</option><option value="metal">Metal</option>
              </select>
            </label>
            {roof.style !== 'flat' && <BuildingNumber label="Pitch" value={roof.pitchDeg} min={5} max={60} step={1} unit="°" testId="building-roof-pitch" onCommit={(pitchDeg) => changeRoof({ pitchDeg })} />}
            <BuildingNumber label="Overhang" value={roof.overhangM} min={0} max={1.5} step={0.05} testId="building-roof-overhang" onCommit={(overhangM) => changeRoof({ overhangM })} />
          </div>
          {!hasRoof && <p className="mt-2 text-[11px] text-[#5b5852]">Add a roof or choose a finish to create it.</p>}
        </fieldset>}

        {inspector === 'stairs' && <fieldset className="min-w-0">
          <legend className="mb-3 text-[13px] font-semibold">Stair placement</legend>
          {canPlaceStairs && <div className="mb-3 grid grid-cols-2 gap-2"><button type="button" className={`${BUTTON} px-2`} onClick={fitStairs}>Fit in room</button><button type="button" className={`${BUTTON} px-2`} onClick={() => { chooseTool('stair'); setDetailsOpen(false); }}>Tap to place</button></div>}
          {stair ? <>
            <select className={`${FIELD} mb-2 w-full`} aria-label="Stair to edit" data-testid="building-stair-select" value={stair.id} onChange={(event) => {
              setSelectedStairId(event.target.value);
              const selected = stairs.find((entry) => entry.id === event.target.value);
              if (selected) usePropertyStore.getState().setActiveLevel(selected.fromLevelId);
              onToolChange('select');
            }}>
              {stairs.map((entry, index) => <option key={entry.id} value={entry.id}>Stair {index + 1} · {floorName(entry.fromLevelId)} → {floorName(entry.toLevelId)}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2" key={stair.id}>
              <BuildingNumber label="Width" value={stair.widthM} min={0.6} max={5} testId="building-stair-width" onCommit={(widthM) => updateStair({ widthM })} invalidMessage="Width unchanged. Check the placement guidance below." />
              <BuildingNumber label="Run" value={stair.runM} min={1} max={30} testId="building-stair-run" onCommit={(runM) => updateStair({ runM })} invalidMessage="Run unchanged. Check the placement guidance below." />
              <BuildingNumber label="Position X" value={stair.x} testId="building-stair-x" onCommit={(x) => updateStair({ x })} invalidMessage="Position unchanged. Check the placement guidance below." />
              <BuildingNumber label="Position Y" value={stair.y} testId="building-stair-y" onCommit={(y) => updateStair({ y })} invalidMessage="Position unchanged. Check the placement guidance below." />
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" className={BUTTON} data-testid="building-stair-rotate" onClick={() => updateStair({ rotation: (stair.rotation + 90) % 360 })}>Rotate 90°</button>
              <button type="button" className={`${BUTTON} border-ppw-clay`} data-testid="building-stair-delete" onClick={() => { usePropertyStore.getState().removeStair(stair.id); setSelectedStairId(null); }}>Delete stair</button>
            </div>
            <p className="mt-2 text-[11px] text-[#5b5852]">Rise {stairRiseM(property, stair).toFixed(2)} m · rotation {stair.rotation}°</p>
          </> : <p className="text-xs text-[#5b5852]">{canPlaceStairs ? 'Choose Stairs in the tool selector, then tap this floor.' : 'Add a second floor, select either connected floor, then choose Stairs.'}</p>}
          {stairError && <p className="mt-2 text-xs text-ppw-coral" role="alert">{stairError}</p>}
          <p className="mt-2 text-[11px] text-[#5b5852]" title="These dimensions describe a concept model. Stair structure, headroom and compliance need a qualified building professional.">Stair dimensions are for layout planning.</p>
        </fieldset>}
      </div>
    </div>}
  </section>;
}
