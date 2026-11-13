import { EcoVisual } from './EcoVisual';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Property } from '../store/propertyStore';
import { usePropertyStore } from '../store/propertyStore';
import { emptyEco } from '../designer/eco';
import type { WaterStudy } from '../designer/ecoContract';
import { useEnergyReport } from '../designer/useEnergyReport';
import ProgrammePanel from './ProgrammePanel';
import { annualPower } from './energy';
import { places } from './places';
import { balance, defaults, months, rain, rainReference } from './water';
import { ecoQuantities } from './quantities';
import './ecoSheet.css';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const assumption = 'Planning assumption · to be measured in the pilot.';
type Card = 'Water' | 'Energy' | 'Materials';
const SiteEntry = lazy(() => import('../site/SiteEntry'));
export default function EcoSheet(props: { property: Property; onClose: () => void }) {
  const [map, setMap] = useState(false);
  return map ? (
    <Suspense fallback={<p role="status">Opening site map…</p>}>
      <SiteEntry demo={false} onClose={() => setMap(false)} />
    </Suspense>
  ) : (
    <EcoView {...props} onMap={() => setMap(true)} />
  );
}
function EcoView({
  property,
  onClose,
  onMap,
}: {
  property: Property;
  onClose: () => void;
  onMap: () => void;
}) {
  const study = property.eco?.waterStudy ?? defaults;
  const [card, setCard] = useState<Card>('Water'),
    dialog = useRef<HTMLDialogElement>(null),
    body = useRef<HTMLDivElement>(null);
  const setEco = usePropertyStore((s) => s.setEco);
  const change = (delta: Partial<WaterStudy>) =>
    setEco({
      ...(usePropertyStore.getState().property.eco ?? emptyEco()),
      waterStudy: {
        ...(usePropertyStore.getState().property.eco?.waterStudy ?? defaults),
        ...delta,
      },
    });
  const q = useMemo(() => ecoQuantities(property, study), [property, study]),
    energy = useEnergyReport();
  const capacity = study.tankL ?? q.tankL,
    annual = annualPower(energy, study.place),
    climate = rainReference(study.region);
  const annualProof = 'PVGIS 5.3 · SARAH3 2005–2023 · ' + annual.name;

  const b = balance(study, q.roof, q.green, q.paving, capacity);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  function open(c: Card) {
    setCard(c);
    body.current?.scrollTo(0, 0);
  }
  function numeric(
    key:
      | 'people'
      | 'runoff'
      | 'homeLDay'
      | 'greyLDay'
      | 'gardenLDay'
      | 'infiltration'
      | 'recycledPct'
      | 'aggregateTM3',
    label: string,
    max: number,
    step: number,
  ) {
    return (
      <label>
        {label}
        <input
          type="number"
          min="0"
          max={max}
          step={step}
          value={study[key]}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            if (
              Number.isFinite(n) &&
              n >= 0 &&
              n <= max &&
              (key !== 'people' || Number.isInteger(n))
            )
              change({ [key]: n });
          }}
        />
      </label>
    );
  }
  function placement(kind: 'wind' | 'kinetic') {
    const key = kind === 'wind' ? 'windPoint' : 'kineticPoint',
      point = study[key] ?? { x: kind === 'wind' ? 2 : 0, y: 0 };
    return (
      <div className="eco-fields">
        {(['x', 'y'] as const).map((axis) => (
          <label key={axis}>
            {kind === 'wind' ? 'Small wind' : 'Kinetic paving'} · {axis.toUpperCase()} (m)
            <input
              type="number"
              step=".1"
              min="-10000"
              max="10000"
              value={point[axis]}
              onChange={(e) => {
                const value = e.currentTarget.valueAsNumber;
                if (Number.isFinite(value) && Math.abs(value) <= 10000)
                  change({ [key]: { ...point, [axis]: value } });
              }}
            />
          </label>
        ))}
      </div>
    );
  }
  const visual = (name: Card) => card === name ? (
    <EcoVisual card={name} property={property} quantities={q} energy={energy} rain={rain[study.region]} />
  ) : null;
  const stat = (label: string, value: string, note: string) => (
    <div className="eco-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
  const roomChoice = (key: 'mossRoom' | 'blockRoom', label: string) => (
    <label>
      {label}
      <select value={study[key] ?? ''} onChange={(e) => change({ [key]: e.target.value || null })}>
        <option value="">No room selected</option>
        {q.rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <dialog
      ref={dialog}
      className="eco-sheet"
      data-build-surface=""
      aria-labelledby="eco-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <img src="/brand/olb/olb-mark.svg" alt="" width="26" height="26" />
          <h1 id="eco-title">Eco sheet</h1>
        </div>
        <button onClick={() => window.print()}>Print A4</button>
        <button autoFocus aria-label="Close Eco sheet" onClick={onClose}>
          Close
        </button>
      </header>
      <nav aria-label="Eco cards">
        {(['Water', 'Energy', 'Materials'] as const).map((c) => (
          <button key={c} aria-pressed={card === c} onClick={() => open(c)}>
            {c}
          </button>
        ))}
      </nav>
      <div className="eco-body" ref={body}>
        <p className="eco-intro">{property.name} · Estimates only, not an approval.</p>
        <section hidden={card !== 'Water'}>
          <h2>Water</h2>
          {visual('Water')}
          <p>Catch rain from the roof. Compare the tank with non-potable demand.</p>
          <div className="eco-stats">
            {stat(
              'Rain caught / year',
              fmt(b.captured / 1000) + ' m³',
              'Roof area × rainfall × runoff',
            )}
            {stat(
              'Mains saved / year',
              fmt(b.saved / 1000) + ' m³',
              'Rain used + greywater reused',
            )}
            {stat(
              'House demand covered',
              b.homeCoverage == null ? 'No demand' : fmt(b.homeCoverage) + '%',
              'Non-potable demand only',
            )}
            {stat(
              'Greywater available / year',
              fmt(b.grey / 1000) + ' m³',
              'People × greywater allowance',
            )}
          </div>
          <p>
            {q.green === 0
              ? 'No garden or moss wall selected.'
              : b.gardenMains < 0.01
                ? 'The garden and moss wall need no mains water in this estimate.'
                : 'Garden and moss wall still need ' +
                  fmt(b.gardenMains / 1000) +
                  ' m³/year of mains water.'}
          </p>
          <div className="eco-fields">
            <label>
              Rain region
              <select
                value={study.region}
                onChange={(e) => change({ region: e.target.value as WaterStudy['region'] })}
              >
                {Object.keys(rain).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Climate reference place
              <select
                value={study.place ?? ''}
                onChange={(e) => {
                  const p = places.find((x) => x.name === e.target.value);
                  change(p ? { place: p.name, region: p.region } : { place: undefined });
                }}
              >
                <option value="">Use reference roof</option>
                {places.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
            {numeric('people', 'People', 10000, 1)}
            {numeric('runoff', 'Roof runoff fraction', 1, 0.05)}
            <label>
              Rain tank capacity
              <select
                value={study.tankL ?? 'plan'}
                onChange={(e) =>
                  change({ tankL: e.target.value === 'plan' ? null : Number(e.target.value) })
                }
              >
                <option value="plan">Placed tanks · {fmt(q.tankL)} L</option>
                {[0, 500, 1000, 2000, 5000, 10000].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString()} L scenario
                  </option>
                ))}
              </select>
            </label>
            {numeric('homeLDay', 'Non-potable use · L/person/day', 1000, 1)}
            {numeric('greyLDay', 'Recoverable greywater · L/person/day', 1000, 1)}
            {numeric('gardenLDay', 'Irrigation · L/m²/day', 100, 0.1)}
            {numeric('infiltration', 'Paving infiltration fraction', 1, 0.05)}
          </div>
          <p>
            <b>{fmt(q.roof)} m²</b> horizontal roof catchment from the measured plan. Tank:{' '}
            {fmt(capacity)} L. Paving infiltration: {fmt(b.infiltrated / 1000)} m³/year, kept
            separate from water in the tank.
          </p>
          <p className="eco-source">
            <a href={climate.url} target="_blank" rel="noreferrer">
              Monthly rainfall: {climate.label}
            </a>
            . All editable factors: {assumption} Tank starts empty. Rain falls evenly within each
            month; overflow is lost. Greywater serves irrigation only; no treatment performance is
            implied.
          </p>
          <table>
            <caption>Monthly water balance</caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Rain mm</th>
                <th>Catch m³</th>
                <th>Saved m³</th>
                <th>End tank L</th>
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i}>
                  <th>{months[i]}</th>
                  <td>{rain[study.region][i]}</td>
                  <td>{fmt(row.captured / 1000)}</td>
                  <td>{fmt(row.saved / 1000)}</td>
                  <td>{fmt(row.stored)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section hidden={card !== 'Energy'}>
          <h2>Energy</h2>
          {visual('Energy')}
          <p>Electrical items placed on this plan.</p>
          <div className="eco-stats">
            {stat('Installed solar', fmt(energy.totalWp) + ' Wp', 'Panel ratings on the plan')}
            {stat(
              'Annual solar generation',
              fmt(annual.generated) + ' kWh/year',
              'Installed kWp × local PVGIS specific yield',
            )}
            {stat(
              'Annual electricity use',
              fmt(annual.used) + ' kWh/year',
              'Item watts × active hours × 365 days',
            )}
            {stat(
              'Battery storage',
              fmt(annual.storage) + ' kWh',
              'Rated capacity of placed batteries',
            )}
            {stat(
              'Annual demand covered',
              annual.covered === null ? 'No measured demand' : fmt(annual.covered) + '%',
              'Annual energy comparison; not hourly autonomy',
            )}
          </div>
          <p>
            <a href={annual.source} target="_blank" rel="noreferrer">
              {annualProof}
            </a>{' '}
            · {fmt(annual.specific)} kWh/kWp/year. Unknown loads are excluded (
            {energy.unpowered.length} items). No output is assumed for wind or kinetic paving.
          </p>
          <fieldset>
            <legend>Demonstrations</legend>
            <label>
              <input
                type="checkbox"
                checked={Boolean(study.kinetic)}
                onChange={(e) => change({ kinetic: e.target.checked })}
              />{' '}
              Kinetic paving
            </label>{' '}
            <label>
              <input
                type="checkbox"
                checked={Boolean(study.wind)}
                onChange={(e) => change({ wind: e.target.checked })}
              />{' '}
              Small wind
            </label>
          </fieldset>
          {study.kinetic && (
            <>
              <p>Kinetic paving · demonstration. Output unmeasured; excluded from totals.</p>
              {placement('kinetic')}
            </>
          )}
          {study.wind && (
            <>
              <p>Small wind · demonstration. Output unmeasured; excluded from totals.</p>
              {placement('wind')}
            </>
          )}
        </section>
        <section hidden={card !== 'Materials'}>
          <h2>Materials</h2>
          {visual('Materials')}
          <p>
            Choose a measured part of the plan to see how its finish changes the study. Each choice
            is a pilot.
          </p>
          <div className="eco-fields">
            {roomChoice('mossRoom', 'Moss render (pilot) · room walls')}
            {roomChoice('blockRoom', 'Bagasse ash block (pilot) · room walls')}
            <label>
              Permeable paving (pilot)
              <select
                value={study.pavingId ?? ''}
                onChange={(e) => change({ pavingId: e.target.value || null })}
              >
                <option value="">No outdoor surface</option>
                {q.paths.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    Outdoor {p.kind} {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Roof finish
              <select
                value={study.coolRoof ? 'cool' : 'existing'}
                onChange={(e) => change({ coolRoof: e.target.value === 'cool' })}
              >
                <option value="existing">Existing finish</option>
                <option value="cool">Cool roof coating (pilot)</option>
              </select>
            </label>
            {numeric('recycledPct', 'Recycled aggregate (pilot) · %', 100, 1)}
            {numeric('aggregateTM3', 'Aggregate bulk density · t/m³', 5, 0.1)}
          </div>
          <div className="eco-stats">
            {stat(
              'Moss render (pilot)',
              fmt(q.moss) + ' m²',
              'One face of room walls, openings deducted',
            )}
            {stat(
              'Bagasse ash block (pilot)',
              fmt(q.block) + ' m²',
              'Masonry area, excludes concrete and glass',
            )}
            {stat(
              'New stone displaced',
              fmt(q.stone) + ' t',
              'Concrete aggregate × density × recycled share',
            )}
            {stat(
              'Permeable paving',
              fmt(q.paving) + ' m²',
              'Measured outdoor surface; feeds infiltration',
            )}
            {stat('Cool roof coating', fmt(q.coating) + ' m²', 'Roof footprint adjusted for pitch')}
            {stat('Rain tank', fmt(capacity) + ' L', 'Placed tank capacity or chosen scenario')}
          </div>
          <p className="eco-source">
            {assumption} Effects on strength, growth, heat and infiltration require field
            measurements.
          </p>
          <ProgrammePanel key={property.id} planId={property.id} />
          <button onClick={onMap}>Open Site from the map</button>
        </section>
      </div>
      <style media="print">{'@page { size: A4 portrait; margin: 14mm }'}</style>
      <article className="eco-print">
        <h1>Eco sheet · {property.name}</h1>
        <p>Estimates only, not an approval.</p>
        <h2>Water · {study.region}</h2>
        <p>
          {fmt(q.roof)} m² roof · runoff {study.runoff} · {fmt(capacity)} L tank · {study.people}{' '}
          people. Catch {fmt(b.captured / 1000)} m³/year. Mains saved {fmt(b.saved / 1000)} m³/year.
          Household demand covered {b.homeCoverage === null ? '—' : fmt(b.homeCoverage) + '%'}.
        </p>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Rain mm</th>
              <th>Catch m³</th>
              <th>Saved m³</th>
              <th>End tank L</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((row, i) => (
              <tr key={i}>
                <th>{months[i]}</th>
                <td>{rain[study.region][i]}</td>
                <td>{fmt(row.captured / 1000)}</td>
                <td>{fmt(row.saved / 1000)}</td>
                <td>{fmt(row.stored)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Non-potable demand {study.homeLDay} L/person/day; recoverable greywater {study.greyLDay}{' '}
          L/person/day; irrigation {study.gardenLDay} L/m²/day. Garden and green-wall mains
          requirement: {fmt(b.gardenMains / 1000)} m³/year. Paving infiltration{' '}
          {fmt(b.infiltrated / 1000)} m³/year at fraction {study.infiltration}.
        </p>
        <h2>Energy</h2>
        <p>
          Solar {fmt(annual.generated)} kWh/year · demand {fmt(annual.used)} kWh/year · storage{' '}
          {fmt(annual.storage)} kWh · annual share{' '}
          {annual.covered === null ? '—' : fmt(annual.covered) + '%'}; no demonstration output
          included. <a href={annual.source}>{annualProof}</a>. Demand uses item watts × hours; no
          hourly matching.
        </p>
        <h2>Materials · pilot estimates</h2>
        <p>
          Moss render {fmt(q.moss)} m² · Bagasse ash block {fmt(q.block)} m² · Paving{' '}
          {fmt(q.paving)} m² · Cool roof {fmt(q.coating)} m² · New stone displaced {fmt(q.stone)} t
          ({study.recycledPct}% at {study.aggregateTM3} t/m³).
        </p>
        <p>
          <a href={climate.url}>Source: {climate.label}.</a> Dimensions from the plan. Demand,
          runoff, reuse, density and infiltration are planning assumptions to be measured in the
          pilot. The tank starts empty; daily rain is evenly distributed within each month.
        </p>
      </article>
    </dialog>
  );
}
