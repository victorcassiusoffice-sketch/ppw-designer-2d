import { useEffect, useRef, useState } from 'react';
import type { WallView } from '../store/designerUIStore';
import { WallHeightControl } from './WallHeightControl';

export type CameraView = 'dollhouse' | 'above' | 'front';
interface Props {
  workspace: boolean; pan: boolean; onPan: () => void;
  onRotate: (radians: number) => void; onZoom: (factor: number) => void; onFit: () => void;
  onView: (view: CameraView) => void; wallView: WallView; onWallView: (view: WallView) => void;
  hasWalls: boolean; sunAvailable: boolean; sunHour: number | null;
  onSunHour: (hour: number | null) => void; onClose?: () => void; onExpand?: () => void;
}

/** The workspace reserves a row for navigation. No camera control floats over the house. */
export function RoomViewControls({ workspace, pan, onPan, onRotate, onZoom, onFit, onView, wallView, onWallView, hasWalls, sunAvailable, sunHour, onSunHour, onExpand }: Props) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const away = (event: PointerEvent) => {
      if (event.target instanceof HTMLElement && !event.target.closest('[data-testid="wallpaint-3d-canvas"]') && !root.current?.contains(event.target)) setExpanded(false);
    };
    const close = () => setExpanded(false);
    const scene = (event: Event) => { setExpanded(false); event.preventDefault(); };
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('ppw:close-view-settings', close);
    window.addEventListener('ppw:house-scene-pointer', scene);
    return () => { document.removeEventListener('pointerdown', away, true); window.removeEventListener('ppw:close-view-settings', close); window.removeEventListener('ppw:house-scene-pointer', scene); };
  }, [expanded]);
  if (!workspace) return <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg border border-white bg-[#fafaf7]/95 p-1 text-xs text-[#37362f] shadow">
    <button className="h-9 min-w-9" onClick={() => onRotate(Math.PI / 4)} aria-label="Rotate left" data-testid="wallpaint-3d-rotate-left">↺</button>
    <button className="h-9 min-w-9" onClick={() => onRotate(-Math.PI / 4)} aria-label="Rotate right" data-testid="wallpaint-3d-rotate-right">↻</button>
    <button className="h-9 min-w-9" onClick={onFit} aria-label="Fit" data-testid="wallpaint-3d-fit">Fit</button>
    {onExpand && <button className="h-9 min-w-9" onClick={onExpand} aria-label="Expand the room view" data-testid="wallpaint-3d-expand">⤢</button>}
  </div>;
  return <div className="house-view-dock" ref={root} data-testid="house-view-dock" data-expanded={expanded}>
    {expanded && <div className="house-view-options" data-testid="house-view-options">
      <div className="house-view-options-heading"><strong>View & dimensions</strong><button type="button" onClick={() => setExpanded(false)} aria-label="Close view settings">Close ×</button></div>
      <div className="house-view-options-body">
        <label>Camera<select aria-label="Camera view" data-testid="view3d-camera-view" value="" onChange={e => onView(e.target.value as CameraView)}><option value="" disabled>Choose view</option><option value="dollhouse">Dollhouse</option><option value="above">Above</option><option value="front">Front</option></select></label>
        <div role="group" aria-label="Wall view" data-testid="view3d-wall-view" className="house-wall-visibility">
          {([['up', 'Walls up'], ['cutaway', 'Cutaway'], ['down', 'Walls down']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => onWallView(id)} aria-label={label} aria-pressed={wallView === id} data-testid={`view3d-walls-${id}`}>{label}</button>)}
        </div>
        {hasWalls && <div className="house-view-height" data-testid="view3d-wall-height"><span>Wall height</span><WallHeightControl idPrefix="view3d-wall-height" buttonClassName="!h-8 !w-8 !border-0 !shadow-none" readoutClassName="!min-w-0 !px-1 !text-xs" /></div>}
        {sunAvailable && <div role="group" aria-label="Sun" data-testid="view3d-sun" className="house-view-daylight"><button type="button" aria-pressed={sunHour !== null} onClick={() => onSunHour(sunHour === null ? 15.5 : null)} data-testid="view3d-sun-toggle">☀ Daylight</button>{sunHour !== null && <label><input type="range" min={6} max={20} step={0.5} value={sunHour} onChange={event => onSunHour(Number(event.target.value))} aria-label="Time of day" data-testid="view3d-sun-hour" /><span data-testid="view3d-sun-label">{`${String(Math.floor(sunHour)).padStart(2, '0')}:${sunHour % 1 ? '30' : '00'}`}</span></label>}</div>}
      </div>
    </div>}
    <div className="house-camera-row" role="group" aria-label="Camera navigation">
      <button type="button" aria-pressed={pan} onClick={onPan} data-testid="view3d-pan" title="Move the view without picking up furniture"><span aria-hidden="true">✥</span><span>Move view</span></button>
      <button type="button" onClick={() => onRotate(Math.PI / 4)} aria-label="Rotate left" title="Rotate left" data-testid="wallpaint-3d-rotate-left">↺</button>
      <button type="button" onClick={() => onRotate(-Math.PI / 4)} aria-label="Rotate right" title="Rotate right" data-testid="wallpaint-3d-rotate-right">↻</button>
      <span className="house-control-divider" />
      <button type="button" onClick={() => onZoom(0.82)} aria-label="Zoom in" title="Zoom in">+</button>
      <button type="button" onClick={() => onZoom(1.22)} aria-label="Zoom out" title="Zoom out">−</button>
      <button type="button" onClick={onFit} aria-label="Fit" title="Fit the whole plan" data-testid="wallpaint-3d-fit">Fit</button>
      <button type="button" className="house-view-options-trigger" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); window.dispatchEvent(new CustomEvent('ppw:close-house-details')); window.dispatchEvent(new CustomEvent('ppw:close-catalog')); }} data-testid="house-view-settings">View <span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span></button>
    </div>
  </div>;
}
