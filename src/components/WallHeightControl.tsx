/**
 * Raise / lower the active storey's walls, retaining the legacy house height
 * for single-storey properties without overrides.
 */
import { usePropertyStore } from '../store/propertyStore';
import { formatWallHeightM, wallHeightControlTarget } from '../designer/wallHeight';

const STEP_M = 0.1;

const BTN =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ppw-rim bg-ppw-chrome text-[18px] font-semibold leading-none text-[#37362f] shadow-sm transition-colors duration-[120ms] ease-out hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';

export function WallHeightControl({
  idPrefix,
  className = '',
  buttonClassName = '',
  readoutClassName = '',
}: {
  idPrefix: string;
  className?: string;
  buttonClassName?: string;
  readoutClassName?: string;
}) {
  const levels = usePropertyStore((s) => s.property.levels);
  const activeLevelId = usePropertyStore((s) => s.property.activeLevelId);
  const wallHeightM = usePropertyStore((s) => s.property.wallHeightM);
  const setWallHeight = usePropertyStore((s) => s.setWallHeight);
  const setLevelHeight = usePropertyStore((s) => s.setLevelHeight);
  const target = wallHeightControlTarget({ levels, activeLevelId, wallHeightM });
  if (!target) return null;
  const { heightM, minM, maxM } = target;
  const atMin = heightM <= minM + 0.001;
  const atMax = heightM >= maxM - 0.001;
  const adjust = (delta: number) => {
    const height = Math.round(Math.max(minM, Math.min(maxM, heightM + delta)) * 100) / 100;
    if (target.levelId) setLevelHeight(target.levelId, height);
    else setWallHeight(height);
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`} data-testid={`${idPrefix}-control`}>
      <button
        type="button"
        className={`${BTN} ${buttonClassName}`}
        disabled={atMin}
        onClick={() => adjust(-STEP_M)}
        aria-label="Lower wall height"
        title={`Lower ${target.label} by ${STEP_M} m (${minM}–${maxM} m)`}
        data-testid={`${idPrefix}-down`}
      >
        −
      </button>
      <span
        className={`min-w-[4.5rem] flex-1 text-center text-[14px] font-semibold tabular-nums text-[#37362f] ${readoutClassName}`}
        data-testid={`${idPrefix}-readout`}
        aria-live="polite"
        title={target.levelId ? target.label : 'Wall height'}
      >
        {formatWallHeightM(heightM)} m
      </span>
      <button
        type="button"
        className={`${BTN} ${buttonClassName}`}
        disabled={atMax}
        onClick={() => adjust(STEP_M)}
        aria-label="Raise wall height"
        title={`Raise ${target.label} by ${STEP_M} m (${minM}–${maxM} m)`}
        data-testid={`${idPrefix}-up`}
      >
        +
      </button>
    </div>
  );
}
