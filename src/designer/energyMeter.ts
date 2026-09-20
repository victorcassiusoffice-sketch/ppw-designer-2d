/**
 * energyMeter — turning the energy balance into a reading a customer
 * understands (2026-09-09).
 *
 * Vic: "the solar as much as possible should be able to cater to it, if not
 * it informs the client with a clear user-friendly simple meter reading".
 *
 * The balance itself lives in `energy.ts`; this module owns only the
 * PRESENTATION of it — how full the bar is, and the words next to it. It is
 * pure so the wording can be tested without a browser, because the wording
 * is the part that can quietly become wrong or rude.
 *
 * Three rules the sentences obey:
 *
 *  1. **No unit in the headline.** "Your panels cover about half of it" beats
 *     "−2.4 kWh/day". The figures stay available underneath for whoever wants
 *     them; they are never the first thing read.
 *  2. **The gap is never the customer's fault.** It is a fact about the plan.
 *     No "you have too much", no "warning", no exclamation.
 *  3. **An action names something buyable and where it goes** — "3 more
 *     475 W panels on the roof" — never an abstract deficit.
 */

import type { EnergyReport } from './energy';

/** How full the bar is drawn: 0-100. Surplus is a WORD, not a longer bar. */
export function meterFillPct(r: Pick<EnergyReport, 'coveragePct' | 'status'>): number {
  if (r.status === 'none') return 0;
  return Math.max(0, Math.min(100, Math.round(r.coveragePct)));
}

/**
 * A plain-English gloss for a coverage percentage. People read "about half"
 * faster than "48 %", and it is honest about the precision we actually have:
 * the underlying figures are typical draws and average sun, not measurements.
 */
export function coverageInWords(pct: number): string {
  if (pct <= 0) return 'none of it';
  if (pct < 15) return 'a small part of it';
  if (pct < 30) return 'about a quarter of it';
  if (pct < 45) return 'about a third of it';
  if (pct < 58) return 'about half of it';
  if (pct < 72) return 'about two thirds of it';
  if (pct < 88) return 'most of it';
  if (pct < 100) return 'nearly all of it';
  return 'all of it';
}

export interface MeterReading {
  /** The one line that answers "am I covered?". */
  headline: string;
  /** One sentence of plain explanation. Empty when the headline says it all. */
  detail: string;
  /** What to do about a gap, or null when there is nothing to do. */
  action: string | null;
  /** How full to draw the bar, 0-100. */
  fillPct: number;
  /** True when generation exceeds use — the bar is full AND there is spare. */
  surplus: boolean;
}

function panelWord(n: number): string {
  return n === 1 ? 'panel' : 'panels';
}

/**
 * The whole reading. Order of cases matters: the emptiest states first, so a
 * plan with nothing on it never reaches the arithmetic branches.
 */
export function meterReading(r: EnergyReport): MeterReading {
  const fillPct = meterFillPct(r);
  const surplus = r.status === 'covered' && r.netWhDay > 0;

  // Nothing electrical and no panels: the readout should not even be visible,
  // but if it is, say so without inventing a problem.
  if (r.status === 'none') {
    return {
      headline: 'Nothing using power yet',
      detail: 'Add a treadmill, a light or anything electrical and this will show what it needs.',
      action: null,
      fillPct: 0,
      surplus: false,
    };
  }

  // Panels, but nothing to power. Generation with no load is not a failure.
  if (r.loadWhDay <= 0) {
    return {
      headline: 'Ready for what you add',
      detail: `${r.panelCount} ${panelWord(r.panelCount)} up there, and nothing drawing power yet.`,
      action: null,
      fillPct: 100,
      surplus: false,
    };
  }

  // Load, but no panels at all. This is the commonest state and the best
  // moment to say what solar would do, so it names the whole system, not a gap.
  if (r.panelCount === 0) {
    const n = r.panelsToCover;
    return {
      headline: 'No panels yet',
      detail: 'Everything here runs off the grid at the moment.',
      action:
        n > 0
          ? r.panelsToCoverFitOnRoof
            ? `${n} × ${r.coverPanelWp} W ${panelWord(n)} on the roof would cover it — they are in the Eco tab.`
            : `The roof fits about ${r.panelsRoofCanStillHold} ${panelWord(r.panelsRoofCanStillHold)}, which covers part of it. Panels are in the Eco tab.`
          : null,
      fillPct: 0,
      surplus: false,
    };
  }

  if (r.status === 'covered') {
    return {
      headline: surplus ? 'Covered, with power to spare' : 'Covered',
      detail: surplus
        ? 'Your panels make more than everything here uses over a day.'
        : 'Your panels make about what everything here uses over a day.',
      action: null,
      fillPct: 100,
      surplus,
    };
  }

  // The gap. This is the case Vic singled out, so it carries the most care.
  const n = r.panelsToCover;
  const detail = `Your panels cover ${coverageInWords(r.coveragePct)} over a day.`;
  if (n <= 0) {
    return { headline: `${r.coveragePct}% covered`, detail, action: null, fillPct, surplus: false };
  }
  const action = r.panelsToCoverFitOnRoof
    ? `Add ${n} more ${r.coverPanelWp} W ${panelWord(n)} on the roof to cover the rest.`
    : Number.isFinite(r.panelsRoofCanStillHold) && r.panelsRoofCanStillHold > 0
      ? `Closing the gap needs ${n} more ${panelWord(n)}, and the roof has room for about ${r.panelsRoofCanStillHold}. A bigger roof, or fewer machines running, would close it.`
      : `Closing the gap needs ${n} more ${panelWord(n)}, and the roof is full. A bigger roof, or fewer machines running, would close it.`;

  return { headline: `${r.coveragePct}% covered`, detail, action, fillPct, surplus: false };
}
