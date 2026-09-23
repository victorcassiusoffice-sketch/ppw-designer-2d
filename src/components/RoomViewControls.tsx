import type { WallView } from '../store/designerUIStore';
import { WallHeightControl } from './WallHeightControl';

export type CameraView = 'dollhouse' | 'above' | 'front';

interface Props {
  workspace: boolean;
  pan: boolean;
  onPan: () => void;
  onRotate: (radians: number) => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onView: (view: CameraView) => void;
  wallView: WallView;
  onWallView: (view: WallView) => void;
  hasWalls: boolean;
  sunAvailable: boolean;
  sunHour: number | null;
  onSunHour: (hour: number | null) => void;
  onClose?: () => void;
  onExpand?: () => void;
}

const BUTTON = 'inline-flex h-11 min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-[#37362f] transition-colors hover:bg-[#e9eee9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-teal md:h-9 md:min-w-9';
const POD = 'rounded-xl border border-white/80 bg-[#fafaf7]/95 p-1 shadow-[0_3px_18px_rgba(35,44,40,0.12)]';
const ACTIVE = '!bg-[#294e47] !text-white';

/** View-only controls: they never modify the building or a product. */
export function RoomViewControls({ workspace, pan, onPan, onRotate, onZoom, onFit, onView, wallView, onWallView, hasWalls, sunAvailable, sunHour, onSunHour, onClose, onExpand }: Props) {
  return <>
    <div className={`absolute bottom-8 left-1/2 flex w-max max-w-[calc(100%-16px)] -translate-x-1/2 flex-col items-center gap-1 md:flex-row md:flex-wrap md:justify-center ${workspace ? '' : 'bottom-2'}`}>
      <div className={`flex max-w-full items-center ${POD}`} role="group" aria-label="Camera navigation">
        {workspace && <button type="button" className={`${BUTTON} ${pan ? ACTIVE : ''}`} aria-pressed={pan} onClick={onPan} data-testid="view3d-pan" title="Move the view without picking up furniture"><span aria-hidden="true">✥</span> Move view</button>}
        <button type="button" className={BUTTON} onClick={() => onRotate(Math.PI / 4)} title="Rotate left" aria-label="Rotate left" data-testid="wallpaint-3d-rotate-left">↺</button>
        <button type="button" className={BUTTON} onClick={() => onRotate(-Math.PI / 4)} title="Rotate right" aria-label="Rotate right" data-testid="wallpaint-3d-rotate-right">↻</button>
        <button type="button" className={BUTTON} onClick={onFit} title="Fit the whole plan" aria-label="Fit" data-testid="wallpaint-3d-fit">Fit</button>
        {workspace && <select className={`${BUTTON} w-[94px] min-w-0 bg-transparent pl-1`} aria-label="Camera view" data-testid="view3d-camera-view" value="" onChange={(event) => onView(event.target.value as CameraView)}>
          <option value="" disabled>View</option><option value="dollhouse">Dollhouse</option><option value="above">Above</option><option value="front">Front</option>
        </select>}
        {!workspace && onExpand && <button type="button" className={BUTTON} onClick={onExpand} title="Open the big room view" aria-label="Expand the room view" data-testid="wallpaint-3d-expand">⤢</button>}
      </div>
      {workspace && <div className={`flex items-center ${POD}`} role="group" aria-label="Wall view" data-testid="view3d-wall-view">
        {([
          ['up', 'Walls up'], ['cutaway', 'Cutaway'], ['down', 'Walls down'],
        ] as const).map(([id, label]) => <button key={id} type="button" className={`${BUTTON} ${wallView === id ? ACTIVE : ''}`} onClick={() => onWallView(id)} aria-label={label} aria-pressed={wallView === id} data-testid={`view3d-walls-${id}`}>{label}</button>)}
        {onClose && <button type="button" className={`${BUTTON} border-l border-ppw-rim !rounded-l-none`} onClick={onClose} title="Back to the plan (Esc)" aria-label="Back to the plan" data-testid="wallpaint-3d-close">2D Plan</button>}
      </div>}
    </div>

    {workspace && <div className={`absolute left-2 top-1/2 flex -translate-y-1/2 flex-col ${POD}`} role="group" aria-label="Zoom">
      <button type="button" className={`${BUTTON} text-lg`} onClick={() => onZoom(0.82)} aria-label="Zoom in">+</button>
      <button type="button" className={`${BUTTON} text-lg`} onClick={() => onZoom(1.22)} aria-label="Zoom out">−</button>
    </div>}

    {workspace && hasWalls && <div className={`absolute right-2 top-1/2 -translate-y-1/2 ${POD}`} data-testid="view3d-wall-height">
      <span className="block text-center text-[10px] font-semibold uppercase tracking-wide text-[#676c63]">Height</span>
      <WallHeightControl idPrefix="view3d-wall-height" className="flex-col gap-0" buttonClassName="!h-9 !w-9 !border-0 !bg-transparent !shadow-none" readoutClassName="!min-w-0 !px-1 !text-[11px]" />
    </div>}

    {workspace && sunAvailable && <div className={`absolute right-2 top-2 flex flex-col items-end ${POD}`} role="group" aria-label="Sun" data-testid="view3d-sun">
      <button type="button" className={`${BUTTON} ${sunHour !== null ? ACTIVE : ''}`} onClick={() => onSunHour(sunHour === null ? 15.5 : null)} title="Preview daylight by time of day" aria-pressed={sunHour !== null} data-testid="view3d-sun-toggle"><span aria-hidden="true">☀</span> Daylight</button>
      {sunHour !== null && <label className="flex items-center gap-2 px-2 py-1 text-xs text-[#37362f]">
        <input type="range" min={6} max={20} step={0.5} value={sunHour} onChange={(event) => onSunHour(Number(event.target.value))} className="h-9 w-24 accent-[#294e47]" aria-label="Time of day" data-testid="view3d-sun-hour" />
        <span className="tabular-nums" data-testid="view3d-sun-label">{`${String(Math.floor(sunHour)).padStart(2, '0')}:${sunHour % 1 ? '30' : '00'}`}</span>
      </label>}
    </div>}
  </>;
}
