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
import { useEffect, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { energyDotColour, useEnergyReport } from '../designer/useEnergyReport';
import { meterReading } from '../designer/energyMeter';
import { EnergyMeterBar } from './EnergyMeterBar';
import { ToolPanelHeader } from './ToolPanelHeader';
import { annualGenerationKwh, formatW, formatWh } from '../designer/solarCalc';
import { MAURITIUS_SOLAR } from '../data/mauritiusSolar';
import { roofAreaM2 } from '../designer/roof';
import { activeLevelIdOf, isOutdoorRoom, isRoofLevel, isRoofRoom, levelsOf } from '../designer/levels';
import { isDrawnPolygon } from '../designer/roomLayout';
import { CHROME_BG, CHROME_RIM, CHROME_TEXT, CHROME_TEXT_2 } from '../designer/blueprintTheme';
import { getProductById } from '../data/products';
import type { Product } from '../data/products.schema';
import { SOLAR_PANEL_PRODUCT_ID } from '../data/solarPreview';

/** The tank the Energy panel arms on the ground (Duraco 1,000 L, priced at Mauritian retailers). */
const WATER_TANK_PRODUCT_ID = 'duraco-water-tank-1000';

const rs = (value: number) => `Rs ${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/**
 * The panel button names the catalogue record, never a hard-coded figure:
 * the brand and the peak watts of the product, and its price — so a catalogue
 * change (a new panel, a new price) changes the button with it.
 */
function panelButtonLabel(product: Product | undefined): string {
  if (!product) return 'Add solar panel';
  const name = product.pv_wp ? `${product.name.split(' ')[0]} ${product.pv_wp} W panel` : product.name;
  return product.price_on_request ? `Add ${name} · price on request` : `Add ${name} · ${rs(product.price.value)}`;
}

/** What the tank toast says about money — the catalogue's price, or that there is none yet. */
function tankPriceLine(product: Product | undefined): string {
  if (!product || product.price_on_request) return 'Supplier price is on request.';
  return `${rs(product.price.value)} list price at Mauritian retailers; delivery and installation not included.`;
}

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

const NUM_INPUT =
  'h-8 rounded-md border border-ppw-rim bg-white px-1.5 text-right text-[12px] font-semibold tabular-nums text-ppw-ink focus:border-ppw-ink focus:outline-none';

/**
 * The per-item watts field (electrics fix 2026-09-20, E-03). Commits on
 * Enter / blur rather than per keystroke: a committed figure re-sorts the
 * list (and moves a "self-powered" row into the counted list), and moving
 * the row mid-typing would take the caret with it. `value` null = no figure
 * yet (an unpowered row); an empty commit clears the override.
 */
function WattsInput({
  value,
  name,
  instanceId,
  onCommit,
}: {
  value: number | null;
  name: string;
  instanceId: string;
  onCommit: (watts: number | null) => void;
}): JSX.Element {
  const [text, setText] = useState(value === null ? '' : String(value));
  function commit(): void {
    const n = text.trim() === '' ? null : Number(text);
    onCommit(n === null || !Number.isFinite(n) ? null : n);
  }
  return (
    <label className="flex items-center gap-1 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={text}
        placeholder={value === null ? '—' : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        data-testid={`energy-watts-${instanceId}`}
        className={`${NUM_INPUT} w-16`}
        aria-label={`${name} watts`}
        title={value === null ? 'Type the watts this draws to count it' : 'Watts while on — type your own figure, clear to go back to the typical one'}
      />
      W
    </label>
  );
}

export function EnergySummary({ compact = false, onJumpToRoof }: EnergySummaryProps): JSX.Element {
  const r = useEnergyReport();
  const property = usePropertyStore((s) => s.property);
  const ensureRoofLevel = usePropertyStore((s) => s.ensureRoofLevel);
  const setItemPower = usePropertyStore((s) => s.setItemPower);
  const setItemHours = usePropertyStore((s) => s.setItemHours);
  const setItemPowerW = usePropertyStore((s) => s.setItemPowerW);
  const selectItemAcrossRooms = usePropertyStore((s) => s.selectItemAcrossRooms);
  const pushToast = useToastStore((s) => s.push);
  const sun = MAURITIUS_SOLAR.default;
  const roofM2 = roofAreaM2(property);
  const onRoof = isRoofLevel(levelsOf(property).find((l) => l.id === activeLevelIdOf(property)));
  const hasBuilding = property.rooms.some((x) => !isOutdoorRoom(x) && !isRoofRoom(x) && isDrawnPolygon(x.polygon));
  const dot = energyDotColour(r.status);
  const meter = meterReading(r);
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

  function addSolarPanel(): void {
    if (!hasBuilding) {
      pushToast('Draw a room first — panels need a roof.', 'warn');
      return;
    }
    const store = usePropertyStore.getState();
    store.ensureRoofLevel();
    store.syncRoof();
    useDesignerUIStore.getState().setTool('hand');
    useDesignerUIStore.getState().setEnergyPanelOpen(false);
    window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
    window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
    usePlacementIntentStore.getState().placeAtCenter(SOLAR_PANEL_PRODUCT_ID);
    onJumpToRoof?.();
  }

  function browseSolar(): void {
    useDesignerUIStore.getState().setEnergyPanelOpen(false);
    window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
    window.dispatchEvent(new CustomEvent('ppw:open-catalog', { detail: { category: 'eco' } }));
    onJumpToRoof?.();
  }

  function addWaterTank(): void {
    usePropertyStore.getState().setActiveLevel('ground');
    useDesignerUIStore.getState().setTool('hand');
    useDesignerUIStore.getState().setEnergyPanelOpen(false);
    window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
    window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
    usePlacementIntentStore.getState().setArmed(WATER_TANK_PRODUCT_ID);
    pushToast(`Tap the ground to place the Duraco tank. ${tankPriceLine(getProductById(WATER_TANK_PRODUCT_ID))}`, 'info');
    onJumpToRoof?.();
  }

  const rowText = compact ? 'text-[12px]' : 'text-[13px]';

  return (
    <div className="flex flex-col gap-1" data-testid="energy-summary" data-status={r.status}>
      <div className="mb-2 grid grid-cols-2 gap-1.5" aria-label="Solar and water products">
        <button type="button" className={`${CHIP} ${CHIP_ON} col-span-2`} onClick={addSolarPanel} data-testid="energy-add-panel">{panelButtonLabel(getProductById(SOLAR_PANEL_PRODUCT_ID))}</button>
        <button type="button" className={`${CHIP} ${CHIP_REST} px-2 text-xs`} onClick={browseSolar} data-testid="energy-browse-solar">Browse solar</button>
        <button type="button" className={`${CHIP} ${CHIP_REST} px-2 text-xs`} onClick={addWaterTank} data-testid="energy-add-tank">Duraco water tank</button>
      </div>
      {/* Headline — the one line that answers "am I covered?" */}
      <div className="flex items-center gap-2 px-1" data-testid="energy-status">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
        <span className="text-[13px] font-semibold text-[#37362f]">{meter.headline}</span>
        {r.loadWhDay > 0 && (
          <span className="ml-auto text-[12px] font-semibold tabular-nums" style={{ color: CHROME_TEXT_2 }} data-testid="energy-net">
            {signedWh(r.netWhDay)}/day
          </span>
        )}
      </div>

      {/* The meter. One bar, one sentence: the answer before any number. */}
      <div className="px-1 pt-0.5">
        <EnergyMeterBar fillPct={meter.fillPct} status={r.status} />
      </div>
      {meter.detail && (
        <p className={`px-1 pt-1 ${rowText}`} style={{ color: CHROME_TEXT_2 }} data-testid="energy-detail">
          {meter.detail}
        </p>
      )}

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

      {/* What to do about a gap — one sentence, in units the customer can buy.
          `meterReading` owns the wording, including the case where the roof
          cannot physically hold the panels the arithmetic asks for. */}
      {meter.action && (
        <p className={`px-1 ${rowText} font-medium`} data-testid="energy-hint">
          {meter.action}
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
          leave it out; set the watts it draws and the hours it runs. */}
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
                  {c.powerOverridden ? (
                    <span data-testid={`energy-figure-${c.instanceId}`}> · your figure</span>
                  ) : c.referenceKey ? (
                    <span
                      className="cursor-help underline decoration-dotted underline-offset-2"
                      title={c.referenceSource ?? `Typical figure (${c.referenceKey})`}
                      data-testid={`energy-figure-${c.instanceId}`}
                    >
                      {' '}· typical
                    </span>
                  ) : null}
                </span>
              </button>
              <WattsInput
                key={`${c.instanceId}:${c.powerW}`}
                value={c.powerW}
                name={c.name}
                instanceId={c.instanceId}
                onCommit={(w) => setItemPowerW(c.instanceId, w)}
              />
              <label className="flex items-center gap-1 text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={c.hoursPerDay}
                  onChange={(e) => setItemHours(c.instanceId, Number(e.target.value))}
                  data-testid={`energy-hours-${c.instanceId}`}
                  className={`${NUM_INPUT} w-14`}
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

      {/* Plug-in-looking items the table scored 0 W (a self-powered rower, a
          smith machine, a lamp nobody has a figure for): shown greyed so the
          customer can see they are NOT counted, with a field to type the
          watts — which moves the row into the counted list above. */}
      {r.unpowered.length > 0 && (
        <ul
          className={`${consumers.length > 0 ? 'mt-1' : 'mt-2 border-t border-ppw-rim pt-2'} flex flex-col gap-0.5`}
          data-testid="energy-unpowered"
          aria-label="Items with no power figure"
        >
          {r.unpowered.map((u) => (
            <li key={u.instanceId} className="flex items-center gap-2 px-1" data-testid={`energy-unpowered-${u.instanceId}`}>
              <button
                type="button"
                onClick={() => selectItemAcrossRooms(u.instanceId)}
                className={`flex min-w-0 flex-1 flex-col text-left leading-tight opacity-60 ${rowText}`}
                title="Select on the plan"
              >
                <span className="truncate font-medium">{u.name}</span>
                <span className="truncate text-[11px]" style={{ color: CHROME_TEXT_2 }}>
                  {u.roomName} · self-powered · set watts
                </span>
              </button>
              <WattsInput key={`${u.instanceId}:none`} value={null} name={u.name} instanceId={u.instanceId} onCommit={(w) => setItemPowerW(u.instanceId, w)} />
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
  useEffect(() => {
    const scene = (event: Event) => { onClose(); event.preventDefault(); };
    const away = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('#ppw-energy-panel, [role="dialog"], [data-testid="wallpaint-3d-canvas"]')) return;
      onClose();
    };
    window.addEventListener('ppw:house-scene-pointer', scene);
    document.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('ppw:house-scene-pointer', scene); document.removeEventListener('pointerdown', away, true); };
  }, [onClose]);
  // Esc puts the readout away, like Done; inputs keep their own Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
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
      className="hidden flex-col overflow-hidden border-l md:flex"
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
      <ToolPanelHeader title="Energy" detail="sun vs use · per day" onClose={onClose} testId="energy-close" />
      <div className="house-tool-panel-body flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">
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
