/**
 * EnergyMeterBar — the one bar behind the energy reading (2026-09-09 WIP,
 * landed 2026-09-20 with the electrics fix).
 *
 * Vic: "if not it informs the client with a clear user-friendly simple meter
 * reading". `energyMeter.ts` decides how full the bar is and what the words
 * say; this component only DRAWS the bar. Two sizes: the chip on the canvas
 * (a hairline, no animation — it sits inside a button that re-renders on
 * every plan change) and the panel (a little taller, its width eases so a
 * switched-off treadmill visibly moves the needle).
 *
 * A `role="meter"` so a screen reader gets the same answer as the eye:
 * "62% of a day's use covered".
 */
import type { EnergyReport } from '../designer/energy';
import { energyDotColour } from '../designer/useEnergyReport';

export interface EnergyMeterBarProps {
  /** How full to draw the bar, 0-100 (see `meterFillPct`). */
  fillPct: number;
  status: EnergyReport['status'];
  /** 'chip' = hairline on the canvas chip; 'panel' (default) = the readout. */
  size?: 'chip' | 'panel';
  /** Accessible name; defaults to "<n>% of a day's use covered". */
  label?: string;
}

const TRACK_BG = 'rgba(42,41,38,0.12)';

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function EnergyMeterBar({ fillPct, status, size = 'panel', label }: EnergyMeterBarProps): JSX.Element {
  const pct = clampPct(fillPct);
  const chip = size === 'chip';
  return (
    <div
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${pct}% of a day's use covered`}
      data-testid={chip ? 'energy-meter-chip' : 'energy-meter'}
      data-status={status}
      className={`${chip ? 'h-1.5 w-12' : 'h-2.5 w-full'} shrink-0 overflow-hidden rounded-full`}
      style={{ background: TRACK_BG }}
    >
      <div
        className={`h-full rounded-full ${chip ? '' : 'transition-[width] duration-[240ms] ease-out motion-reduce:transition-none'}`}
        style={{ width: `${pct}%`, background: energyDotColour(status) }}
        data-testid={chip ? 'energy-meter-chip-fill' : 'energy-meter-fill'}
      />
    </div>
  );
}
