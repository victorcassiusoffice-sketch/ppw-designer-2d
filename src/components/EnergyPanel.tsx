/**
 * EnergyPanel — the sun-vs-use readout (eco / solar 2026-09-04).
 *
 * Vic: "show if the solar panel is sufficiently providing enough power for
 * the current electrical products that are on the canvas/room or even
 * outside the room, how much energy is surplus or lacking … user friendly
 * and not clutter the designer".
 *
 * So: ONE chip on the canvas (RoomCanvas `energy-readout`) that only appears
 * once something electrical or a panel is on the plan, and this panel behind
 * it — docked on the right at md+ exactly like the Floor / Wall paint panels
 * (same width, same top, same `--floor-panel-w` inset so it never covers the
 * room), a section of the phone sheet below md. It is a READOUT, not a
 * tool: no BuildTool, no HUD card, nothing to arm.
 *
 * `EnergySummary` is the body both hosts share; `EnergyPanel` is the md+
 * aside (portaled by TopBar, next to the other two).
 */
import { useEffect } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { energyDotColour, useEnergyReport } from '../designer/useEnergyReport';
import { energyStatusLabel } from '../designer/energy';
import { annualGenerationKwh, formatW, formatWh } from '../designer/solarCalc';
import { MAURITIUS_SOLAR } from '../data/mauritiusSolar';
import { roofAreaM2 } from '../designer/roof';
import { activeLevelIdOf, isOutdoorRoom, isRoofLevel, isRoofRoom, levelsOf } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import { CHROME_BG, CHROME_RIM, CHROME_TEXT, CHROME_TEXT_2 } from '../designer/blueprintTheme';

const CHIP =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';
const CHIP_REST = 'border-ppw-rim bg-ppw-chrome text-ppw-charcoal hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
const CHIP_ON = 'border-ppw-inkDeep bg-ppw-inkDeep font-semibold text-ppw-paper';
const TOGGLE =
  'inline-flex h-8 min-w-[44px] items-center justify-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors duration-[120ms] ease-out motion-reduce:transition-none';

export interface EnergySummaryProps {
  /** Phone sheet: tighter rows, no footer chip row. */
  compact?: boolean;
  /** Called after "Roof" switches level (the phone sheet closes itself). */
  onJumpToRoof?: () => void;
}

function signedWh(wh: number): string {
  return `${wh < 0 ? '−' : '+'}${formatWh(Math.abs(wh))}`;
}

export function EnergySummary({ compact = false, onJumpToRoof }: EnergySummaryProps): JSX.Element {
  const r = useEnergyReport();
  const property = usePropertyStore((s) => s.property);
  const ensureRoofLevel = usePropertyStore((s) => s.ensureRoofLevel);
  const setItemPower = usePropertyStore((s) => s.setItemPower);
  const setItemHours = usePropertyStore((s) => s.setItemHours);
  const selectItemAcrossRooms = usePropertyStore((s) => s.selectItemAcrossRooms);
  const pushToast = useToastStore((s) => s.push);
  const sun = MAURITIUS_SOLAR.default;
  const roofM2 = roofAreaM2(property);
  const onRoof = isRoofLevel(levelsOf(property).find((l) => l.id === activeLevelIdOf(property)));
  const hasBuilding = property.rooms.some((x) => !isOutdoorRoom(x) && !isRoofRoom(x) && isDrawnPolygon(x.polygon));
  const dot = energyDotColour(r.status);
  const annualKwh = r.totalWp > 0 ? annualGenerationKwh(r.totalWp, sun.poaKwhM2DayMonthly, sun.performanceRatio) : 0;
  const itemsOn = r.consumers.filter((c) => c.on).length;
  const consumers = [...r.consumers].sort((a, b) => Number(b.on) - Number(a.on) || b.whDay - a.whDay);

  function jumpToRoof(): void {
    if (!hasBuilding) {
      pushToast('Draw a room on a storey first — the roof follows the building.', 'warn');
      return;
    }
    if (!onRoof) ensureRoofLevel();
    onJumpToRoof?.();
  }

  const rowText = compact ? 'text-[12px]' : 'text-[13px]';

  return (
    <div className="flex flex-col gap-1" data-testid="energy-summary" data-status={r.status}>
      {/* Headline — the one line that answers "am I covered?" */}
      <div className="flex items-center gap-2 px-1" data-testid="energy-status">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
        <span className="text-[13px] font-semibold text-[#37362f]">{energyStatusLabel(r)}</span>
        {r.loadWhDay > 0 && (
          <span className="ml-auto text-[12px] font-semibold tabular-nums" style={{ color: CHROME_TEXT_2 }} data-testid="energy-net">
            {signedWh(r.netWhDay)}/day
          </span>
        )}
      </div>

      <div className={`grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 px-1 ${rowText} tabular-nums`}>
        <span aria-hidden="true">☀</span>
        <span data-testid="energy-generation">
          <span className="font-semibold">{formatWh(r.generationWhDay)}</span>/day
          {r.panelCount > 0 ? (
            <span style={{ color: CHROME_TEXT_2 }}>
              {' '}· {r.panelCount} panel{r.panelCount === 1 ? '' : 's'} · {(r.totalWp / 1000).toFixed(2)} kWp
            </span>
          ) : (
            <span style={{ color: CHROME_TEXT_2 }}> · no panels yet</span>
          )}
        </span>
        <span aria-hidden="true">⚡</span>
        <span data-testid="energy-load">
          <span className="font-semibold">{formatWh(r.loadWhDay)}</span>/day
          <span style={{ color: CHROME_TEXT_2 }}>
            {' '}· {itemsOn} item{itemsOn === 1 ? '' : 's'} on · peak {formatW(r.peakLoadW)}
          </span>
        </span>
      </div>

      {/* What to do about a gap — one sentence, one button. */}
      {r.netWhDay < 0 && r.panelsToCover > 0 && (
        <p className={`px-1 ${rowText} font-medium`} data-testid="energy-hint">
          Add {r.panelsToCover} × {r.coverPanelWp} Wp panel{r.panelsToCover === 1 ? '' : 's'} on the roof to cover it
          {r.panelCount === 0 ? ' — they are in the Eco tab' : ''}.
        </p>
      )}
      {r.panelsOffRoof > 0 && (
        <p className={`px-1 ${rowText} font-medium text-ppw-clay`} data-testid="energy-off-roof">
          {r.panelsOffRoof} panel{r.panelsOffRoof === 1 ? '' : 's'} not on the roof — move {r.panelsOffRoof === 1 ? 'it' : 'them'} up there.
        </p>
      )}
      {(r.batteryKwh > 0 || r.inverterKw > 0) && (
        <p className={`px-1 ${rowText} tabular-nums`} style={{ color: CHROME_TEXT_2 }} data-testid="energy-storage">
          {r.batteryKwh > 0 && (
            <>
              Battery {r.batteryKwh} kWh{r.loadWhDay > 0 ? ` · ~${Math.round(r.batteryAutonomyHours)} h at this use` : ''}
            </>
          )}
          {r.batteryKwh > 0 && r.inverterKw > 0 && ' · '}
          {r.inverterKw > 0 && (
            <>
              Inverter {r.inverterKw} kW {r.inverterOk ? '✓' : `— peak ${formatW(r.peakLoadW)} exceeds it`}
            </>
          )}
        </p>
      )}

      <div className="mt-1 flex gap-2 px-1">
        <button
          type="button"
          onClick={jumpToRoof}
          data-testid="energy-roof"
          className={`${CHIP} flex-1 ${onRoof ? CHIP_ON : CHIP_REST}`}
          title={onRoof ? 'You are on the roof' : 'Go to the roof to lay panels'}
          aria-pressed={onRoof}
        >
          Roof{roofM2 > 0 ? ` · ${roofM2.toFixed(0)} m²` : ''}
        </button>
      </div>

      {/* Every electrical item on the plan, biggest first. Switch one off to
          leave it out; set the hours it runs. */}
      {consumers.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 border-t border-ppw-rim pt-2" data-testid="energy-items" aria-label="Electrical items">
          {consumers.map((c) => (
            <li key={c.instanceId} className="flex items-center gap-2 px-1" data-testid={`energy-item-${c.instanceId}`}>
              <button
                type="button"
                onClick={() => selectItemAcrossRooms(c.instanceId)}
                className={`flex min-w-0 flex-1 flex-col text-left leading-tight ${rowText} ${c.on ? '' : 'opacity-60'}`}
                title="Select on the plan"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="truncate text-[11px] tabular-nums" style={{ color: CHROME_TEXT_2 }}>
                  {c.roomName} · {formatW(c.powerW)}
                  {c.referenceKey ? ' · typical' : ''}
                </span>
              </button>
              <label className="flex items-center gap-1 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={c.hoursPerDay}
                  onChange={(e) => setItemHours(c.instanceId, Number(e.target.value))}
                  data-testid={`energy-hours-${c.instanceId}`}
                  className="h-8 w-14 rounded-md border border-ppw-rim bg-white px-1.5 text-right text-[12px] font-semibold tabular-nums text-ppw-ink focus:border-ppw-ink focus:outline-none"
                  aria-label={`${c.name} hours per day`}
                />
                h
              </label>
              <button
                type="button"
                onClick={() => setItemPower(c.instanceId, !c.on)}
                data-testid={`energy-power-${c.instanceId}`}
                aria-pressed={c.on}
                className={`${TOGGLE} ${c.on ? CHIP_ON : CHIP_REST}`}
                title={c.on ? 'Counted — tap to leave out' : 'Left out — tap to count'}
              >
                {c.on ? 'on' : 'off'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Where the sun figure comes from — one honest line. */}
      <p className="mt-2 px-1 text-[11px] leading-snug" style={{ color: CHROME_TEXT_2 }} data-testid="energy-assumptions">
        Sun: {sun.poaKwhM2DayAnnual} kWh/m²/day on a {sun.label} roof, {MAURITIUS_SOLAR.location.split(' (')[0]} (PVGIS SARAH3 2005–23) ·{' '}
        {Math.round(sun.performanceRatio * 100)} % performance ratio ≈ {Math.round(sun.yieldKwhPerKwpYear)} kWh/yr per kWp
        {annualKwh > 0 ? ` · your panels ≈ ${Math.round(annualKwh).toLocaleString('en-GB')} kWh/yr` : ''}.
      </p>
    </div>
  );
}

export interface EnergyPanelProps {
  top: number;
  width: number;
  onClose: () => void;
}

/** md+ docked aside — TopBar portals it beside the Floor / Wall paint panels. */
export function EnergyPanel({ top, width, onClose }: EnergyPanelProps): JSX.Element {
  // Esc puts the readout away, like Done; inputs keep their own Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      id="ppw-energy-panel"
      role="complementary"
      aria-label="Energy"
      data-testid="energy-panel"
      data-ppw-popover=""
      className="hidden flex-col overflow-y-auto border-l md:flex"
      style={{
        position: 'fixed',
        top,
        right: 0,
        bottom: 'var(--sims-dock-h, 0px)',
        width,
        zIndex: 30,
        background: CHROME_BG,
        color: CHROME_TEXT,
        borderColor: CHROME_RIM,
        boxShadow: '-4px 0 16px rgba(42,41,38,0.08)',
      }}
    >
      <div className="flex flex-col gap-0.5 p-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
          <span className="text-[14px] font-semibold text-[#37362f]">Energy</span>
          <span className="text-[12px] font-medium" style={{ color: CHROME_TEXT_2 }}>
            sun vs use · per day
          </span>
        </div>
        <EnergySummary />
        <button
          type="button"
          onClick={onClose}
          data-testid="energy-done"
          className={`${CHIP} ${CHIP_ON} mt-3 w-full`}
          title="Done — close the energy readout (Esc)"
        >
          Done
        </button>
      </div>
    </aside>
  );
}
