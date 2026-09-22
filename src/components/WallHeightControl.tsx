/**
 * Raise / lower the one house wall height (Sims-style, after the walls exist).
 *
 * One property value — `propertyStore.setWallHeight` — already drives the 3D
 * extrusion and the paint / cladding area maths. This is the chrome for it,
 * so the customer does not have to open the wall-paint panel to find the
 * number. The paint panel keeps its own input on the same store field.
 */
import { MAX_WALL_HEIGHT_M, MIN_WALL_HEIGHT_M, DEFAULT_WALL_HEIGHT_M } from '../data/wallPaints';
import { usePropertyStore } from '../store/propertyStore';

const STEP_M = 0.1;

const BTN =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ppw-rim bg-ppw-chrome text-[18px] font-semibold leading-none text-[#37362f] shadow-sm transition-colors duration-[120ms] ease-out hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none';

/** "2.70" → "2.7", "2.75" stays, so the readout matches the paint-panel number. */
export function formatWallHeightM(heightM: number): string {
  return String(Number(heightM.toFixed(2)));
}

export function WallHeightControl({ idPrefix }: { idPrefix: string }) {
  const heightM = usePropertyStore((s) => s.property.wallHeightM ?? DEFAULT_WALL_HEIGHT_M);
  const setWallHeight = usePropertyStore((s) => s.setWallHeight);
  const atMin = heightM <= MIN_WALL_HEIGHT_M + 0.001;
  const atMax = heightM >= MAX_WALL_HEIGHT_M - 0.001;

  return (
    <div className="flex items-center gap-1.5" data-testid={`${idPrefix}-control`}>
      <button
        type="button"
        className={BTN}
        disabled={atMin}
        onClick={() => setWallHeight(heightM - STEP_M)}
        aria-label="Lower wall height"
        title={`Lower every wall by ${STEP_M} m (${MIN_WALL_HEIGHT_M}–${MAX_WALL_HEIGHT_M} m)`}
        data-testid={`${idPrefix}-down`}
      >
        −
      </button>
      <span
        className="min-w-[4.5rem] flex-1 text-center text-[14px] font-semibold tabular-nums text-[#37362f]"
        data-testid={`${idPrefix}-readout`}
        aria-live="polite"
      >
        {formatWallHeightM(heightM)} m
      </span>
      <button
        type="button"
        className={BTN}
        disabled={atMax}
        onClick={() => setWallHeight(heightM + STEP_M)}
        aria-label="Raise wall height"
        title={`Raise every wall by ${STEP_M} m (${MIN_WALL_HEIGHT_M}–${MAX_WALL_HEIGHT_M} m)`}
        data-testid={`${idPrefix}-up`}
      >
        +
      </button>
    </div>
  );
}
