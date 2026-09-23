import { useEffect, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { activeLevelIdOf, isRoofLevel } from '../designer/levels';
import { fitStairInRoom, validateStairPlacement } from '../designer/stairPlacement';
import {
  buildingLevels, levelHeightM, MAX_LEVEL_HEIGHT_M, MIN_LEVEL_HEIGHT_M,
  roofConfigOf, stairRiseM, type BuildingStair, type RoofConfig,
} from '../designer/building';

export interface BuildingControlsProps {
  view: 'building' | 'floor';
  onViewChange: (view: 'building' | 'floor') => void;
  showRoof: boolean;
  onShowRoofChange: (show: boolean) => void;
  tool: 'select' | 'stair' | 'window' | 'door';
  onToolChange: (tool: 'select' | 'stair' | 'window' | 'door') => void;
  onGardenToggle: () => void;
  gardenOpen: boolean;
}

const BUTTON = 'inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-ppw-rim bg-ppw-chrome px-3 text-xs font-medium text-[#37362f] hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal disabled:opacity-40';
const ACTIVE = 'border-ppw-teal bg-ppw-mist text-ppw-teal';
const FIELD = 'h-11 min-w-0 rounded-lg border border-ppw-rim bg-white px-2 text-base tabular-nums text-[#37362f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal md:text-sm';

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

/** One phone-sized build row. Details expand only while editing dimensions. */
export function BuildingControls({
  view, onViewChange, showRoof, onShowRoofChange, tool, onToolChange, onGardenToggle, gardenOpen,
}: BuildingControlsProps): JSX.Element {
  const property = usePropertyStore((state) => state.property);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedStairId, setSelectedStairId] = useState<string | null>(null);
  const [stairError, setStairError] = useState<string | null>(null);
  const levels = buildingLevels(property);
  const activeId = activeLevelIdOf(property);
  const active = levels.find((entry) => entry.level.id === activeId) ?? levels[0];
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

  function addFloor() {
    const source = onRoofLevel ? storeys[storeys.length - 1]?.level.id : activeId;
    usePropertyStore.getState().addLevel(undefined, source);
    onToolChange('select');
    onViewChange('building');
    onShowRoofChange(false);
  }

  function toggleRoof() {
    const nextShow = !hasRoof || !showRoof;
    if (nextShow && (!hasRoof || !property.roof)) {
      usePropertyStore.getState().setRoofConfig(roof);
    }
    onShowRoofChange(nextShow);
    if (nextShow) onViewChange('building');
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

  const toolHelp = tool === 'stair'
    ? canPlaceStairs
      ? `Tap the floor to place stairs from ${lowerStairLevel.level.name} to ${upperStairLevel.level.name}.`
      : 'Add a second floor, then select a floor to place stairs.'
    : tool === 'window' ? `Tap a wall on ${active.level.name} to add a window.`
      : tool === 'door' ? `Tap a wall on ${active.level.name} to add a door.` : null;

  return <section className="min-w-0 border-b border-ppw-rim bg-ppw-chrome text-[#37362f]" aria-label="Building controls" data-testid="building-controls">
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto p-1 sm:gap-2 sm:px-2">
      <select aria-label="Active floor" data-testid="building-floor-select" value={activeId}
        className={`${FIELD} w-[110px] shrink-0 text-[13px] sm:w-40`}
        onChange={(event) => { usePropertyStore.getState().setActiveLevel(event.target.value); onToolChange('select'); }}>
        {levels.map((entry) => <option key={entry.level.id} value={entry.level.id}>{entry.level.name}</option>)}
      </select>
      <button type="button" className={`${BUTTON} px-2`} onClick={addFloor} data-testid="building-add-floor"
        title={`Add a floor using the ${onRoofLevel ? 'top floor' : active.level.name} layout`}>+ Floor</button>
      <select aria-label="3D build tool" data-testid="building-tool-select" value={tool}
        className={`${FIELD} w-[105px] shrink-0 text-[13px] ${tool !== 'select' ? ACTIVE : ''}`}
        onChange={(event) => onToolChange(event.target.value as BuildingControlsProps['tool'])}>
        <option value="select">Select / move</option>
        <option value="stair" disabled={!canPlaceStairs}>Stairs</option>
        <option value="window" disabled={onRoofLevel}>Window</option>
        <option value="door" disabled={onRoofLevel}>Door</option>
      </select>
      <button type="button" className={`${BUTTON} px-2 ${detailsOpen ? ACTIVE : ''}`}
        data-testid="building-details-toggle" aria-expanded={detailsOpen} aria-controls="building-details"
        onClick={() => setDetailsOpen(!detailsOpen)}>Build {detailsOpen ? '−' : '+'}</button>
      <span className="hidden whitespace-nowrap text-[11px] text-[#5b5852] xl:block">{storeys.length} {storeys.length === 1 ? 'floor' : 'floors'} · {view === 'building' ? 'Whole building' : 'This floor'}</span>
    </div>

    {toolHelp && <div className="flex items-center justify-between gap-2 border-t border-ppw-rim px-2 text-[11px]" role="status">
      <span>{toolHelp}</span>
      <button type="button" className="min-h-11 shrink-0 px-2 font-semibold text-ppw-teal" onClick={() => onToolChange('select')}>Done</button>
    </div>}

    {detailsOpen && <div id="building-details" className="max-h-[38vh] overflow-y-auto border-t border-ppw-rim p-3" data-testid="building-details">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1" role="group" aria-label="Building view">
          <button type="button" className={`${BUTTON} ${view === 'building' ? ACTIVE : ''}`} aria-pressed={view === 'building'} data-testid="building-view-building" onClick={() => onViewChange('building')}>Whole building</button>
          <button type="button" className={`${BUTTON} ${view === 'floor' ? ACTIVE : ''}`} aria-pressed={view === 'floor'} data-testid="building-view-floor" onClick={() => onViewChange('floor')}>This floor</button>
        </div>
        <button type="button" className={`${BUTTON} ${hasRoof && showRoof ? ACTIVE : ''}`} aria-pressed={hasRoof && showRoof} data-testid="building-roof-toggle" onClick={toggleRoof}>{hasRoof ? showRoof ? 'Hide roof' : 'Show roof' : '+ Roof'}</button>
        <button type="button" className={`${BUTTON} ${gardenOpen ? ACTIVE : ''}`} aria-pressed={gardenOpen} data-testid="building-garden-toggle" onClick={() => { setDetailsOpen(false); onToolChange('select'); onGardenToggle(); }}>Garden</button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <fieldset className="min-w-0 rounded-lg border border-ppw-rim p-3">
          <legend className="px-1 text-xs font-semibold">{active.level.name}</legend>
          {!onRoofLevel ? <>
            <BuildingNumber key={`height-${activeId}`} label="Wall height" value={height} min={MIN_LEVEL_HEIGHT_M} max={MAX_LEVEL_HEIGHT_M} testId="building-floor-height"
              onCommit={(value) => usePropertyStore.getState().setLevelHeight(activeId, value)} />
            <p className="mt-2 text-[11px] text-[#5b5852]">Floor starts at {active.elevationM.toFixed(2)} m. Floors above follow this height.</p>
            {active.level.heightM !== undefined && <button type="button" className="mt-1 min-h-11 text-xs font-medium text-ppw-teal" onClick={() => usePropertyStore.getState().setLevelHeight(activeId, null)}>Use house wall height</button>}
          </> : <p className="text-xs text-[#5b5852]">Roof level · {active.elevationM.toFixed(2)} m above ground. Choose a floor to edit its wall height.</p>}
          <p className="mt-2 text-[11px] text-[#5b5852]">+ Floor copies rooms, windows and free walls from the selected floor.</p>
        </fieldset>

        <fieldset className="min-w-0 rounded-lg border border-ppw-rim p-3">
          <legend className="px-1 text-xs font-semibold">Roof</legend>
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
          {!hasRoof && <p className="mt-2 text-[11px] text-[#5b5852]">Choose + Roof or change a setting to add it.</p>}
        </fieldset>

        <fieldset className="min-w-0 rounded-lg border border-ppw-rim p-3">
          <legend className="px-1 text-xs font-semibold">Stairs</legend>
          {canPlaceStairs && <button type="button" className={`${BUTTON} mb-2 w-full`} onClick={fitStairs}>Fit stairs in room</button>}
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
        </fieldset>
      </div>
    </div>}
  </section>;
}
