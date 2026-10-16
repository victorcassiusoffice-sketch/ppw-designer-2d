import { useState, type FormEvent } from 'react';
import {
  screenHygrothermal,
  calculateComponentCarbon,
  summarizeComponentCarbon,
  matchMaterialSources,
  rankSurfaceTechnologies,
  type SurfaceTechnologyInput,
  type CarbonUnit,
} from '../designer/sustainability';
import {
  MAURITIUS_MATERIAL_CANDIDATES,
  SUSTAINABILITY_SOURCES,
} from '../designer/sustainabilityEvidence';
import {
  SharedSpecAnalysisSchema,
  type SharedSpecComponent,
  type SharedSpecPatch,
} from '../designer/sharedSpecsContract';

const number = (value: number | null | undefined, digits = 2) =>
  value == null
    ? 'Needs evidence'
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
function componentCarbon(component: SharedSpecComponent) {
  return calculateComponentCarbon({
    id: component.id,
    quantity: component.quantity,
    unit: (component.unit === 'each' ? 'item' : component.unit) as CarbonUnit,
    ...(component.carbon
      ? {
          declaration: {
            kgCo2ePerUnit: component.carbon.factor,
            unit: (component.unit === 'each' ? 'item' : component.unit) as CarbonUnit,
            boundary: component.carbon.boundary,
            source: component.carbon.evidenceUrl ?? '',
          },
        }
      : {}),
  });
}
export function SharedCarbonSummary({ components }: { components: SharedSpecComponent[] }) {
  const active = components.filter((c) => !c.sourceRemoved),
    summary = summarizeComponentCarbon(active.map(componentCarbon));
  return (
    <section className="shared-card">
      <h2>Carbon evidence</h2>
      <p>
        <b>
          {summary.coveredComponentCount} / {summary.componentCount}
        </b>{' '}
        current component records have usable declarations. Missing data is not zero carbon.
      </p>
      {Object.entries(summary.totalsByBoundary).map(([scope, total]) => (
        <p key={scope}>
          {scope}: <b>{number(total)} kgCO₂e</b> · covered subtotal
        </p>
      ))}
      <p className="shared-muted">
        Keep lifecycle boundaries separate. Record coverage is not mass or area coverage. This does
        not establish Eco-Sud endorsement or environmental approval.
      </p>
    </section>
  );
}
export function SharedSustainabilityPanel({
  components,
  selected,
  choose,
  canAnalyse,
  canSpecify,
  save,
  busy,
}: {
  components: SharedSpecComponent[];
  selected?: SharedSpecComponent;
  choose: (id: string) => void;
  canAnalyse: boolean;
  canSpecify: boolean;
  save: (id: string, patch: SharedSpecPatch) => Promise<void>;
  busy: boolean;
}) {
  const [section, setSection] = useState<'moisture' | 'sources' | 'surfaces'>('moisture');
  return (
    <div>
      <SharedCarbonSummary components={components} />
      <div className="shared-inline shared-section-tabs">
        {(['moisture', 'sources', 'surfaces'] as const).map((s) => (
          <button key={s} aria-pressed={section === s} onClick={() => setSection(s)}>
            {s === 'moisture'
              ? 'Moisture & drying'
              : s === 'sources'
                ? 'Local / import evidence'
                : 'Surface technologies'}
          </button>
        ))}
      </div>
      <label className="shared-component-select">
        Review component
        <select value={selected?.id ?? ''} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose a component</option>
          {components
            .filter((c) => !c.sourceRemoved)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      {selected ? (
        section === 'moisture' ? (
          <MoistureForm
            key={`${selected.id}:${JSON.stringify(selected.analysis)}`}
            component={selected}
            save={(patch) => save(selected.id, patch)}
            editable={canAnalyse}
            busy={busy}
          />
        ) : section === 'sources' ? (
          <Sourcing
            component={selected}
            apply={(patch) => save(selected.id, patch)}
            editable={canSpecify}
            busy={busy}
          />
        ) : (
          <SurfaceForm
            key={`${selected.id}:${JSON.stringify(selected.analysis)}`}
            component={selected}
            components={components}
            save={(patch) => save(selected.id, patch)}
            editable={canAnalyse}
            busy={busy}
          />
        )
      ) : (
        <p className="shared-notice">
          Choose a measured component above. Add geometry in the Designer if the register is empty.
        </p>
      )}
      <details className="shared-card">
        <summary>Methods and primary sources</summary>
        {SUSTAINABILITY_SOURCES.map((source) => (
          <p key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <br />
            <small>{source.note}</small>
          </p>
        ))}
      </details>
    </div>
  );
}
const climateFields = [
  ['airTempC', 'Air temperature °C'],
  ['relativeHumidityPct', 'Air relative humidity %'],
  ['surfaceTempC', 'Surface temperature °C'],
  ['mouldThresholdPct', 'Material threshold: surface RH %'],
  ['mouldMinimumExposureHours', 'Threshold exposure duration · hours'],
  ['exposureHours', 'Observed exposure · hours'],
  ['initialMoisturePct', 'Initial moisture content %'],
  ['targetMoisturePct', 'Target moisture content %'],
  ['dryingRatePctPerDay', 'Measured drying · percentage points/day'],
] as const;
function MoistureForm({
  component,
  save,
  editable,
  busy,
}: {
  component: SharedSpecComponent;
  save: (p: SharedSpecPatch) => Promise<void>;
  editable: boolean;
  busy: boolean;
}) {
  const a = component.analysis ?? {},
    [error, setError] = useState('');
  const result = screenHygrothermal({
    airTemperatureC: a.airTempC,
    relativeHumidityPct: a.relativeHumidityPct,
    surfaceTemperatureC: a.surfaceTempC,
    materialName: component.material,
    exposureHours: a.exposureHours,
    ...(a.mouldThresholdPct != null && a.mouldMinimumExposureHours != null
      ? {
          mouldThreshold: {
            surfaceRhPct: a.mouldThresholdPct,
            minimumExposureHours: a.mouldMinimumExposureHours,
            source: a.thresholdEvidenceUrl ?? '',
          },
        }
      : {}),
    ...(a.initialMoisturePct != null && a.targetMoisturePct != null && a.dryingRatePctPerDay != null
      ? {
          drying: {
            initialMoisturePct: a.initialMoisturePct,
            targetMoisturePct: a.targetMoisturePct,
            percentagePointsPerDay: a.dryingRatePctPerDay,
            source: a.rateEvidenceUrl ?? '',
            conditionsMatch: a.dryingConditionsMatch ?? false,
          },
        }
      : {}),
  });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || busy) return;
    const data = new FormData(e.currentTarget),
      analysis: Record<string, unknown> = { ...a };
    for (const [field] of climateFields) {
      const value = data.get(field);
      if (value === '') delete analysis[field];
      else analysis[field] = Number(value);
    }
    for (const key of ['rateEvidenceUrl', 'thresholdEvidenceUrl']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) analysis[key] = value;
      else delete analysis[key];
    }
    analysis.dryingConditionsMatch = data.has('conditions');
    const parsed = SharedSpecAnalysisSchema.safeParse(analysis);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
      return;
    }
    try {
      await save({ analysis: parsed.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="shared-card">
      <h2>Tropical moisture review</h2>
      <p>
        Enter measured site conditions and material test evidence. No island-wide humidity or
        universal safe material threshold is assumed.
      </p>
      <div className="shared-metrics">
        <div>
          <small>Dew point</small>
          <strong>{number(result.dewPointC)} °C</strong>
        </div>
        <div>
          <small>Surface RH</small>
          <strong>{number(result.surfaceRhPct)} %</strong>
        </div>
        <div>
          <small>Drying projection</small>
          <strong>{number(result.dryingDays)} days</strong>
        </div>
      </div>
      <p>
        Condensation: <b>{result.condensation.replace(/-/g, ' ')}</b>. Material threshold:{' '}
        <b>{result.mouldReview.replace(/-/g, ' ')}</b>.
      </p>
      <fieldset disabled={!editable || busy}>
        <legend>Engineer-entered inputs</legend>
        <div className="shared-fields">
          {climateFields.map(([field, label]) => (
            <label key={field}>
              {label}
              <input name={field} type="number" step="any" defaultValue={a[field] ?? ''} />
            </label>
          ))}
          <label>
            Material threshold evidence URL
            <input name="thresholdEvidenceUrl" type="url" defaultValue={a.thresholdEvidenceUrl} />
          </label>
          <label>
            Drying-rate test evidence URL
            <input name="rateEvidenceUrl" type="url" defaultValue={a.rateEvidenceUrl} />
          </label>
        </div>
        <label className="shared-check">
          <input type="checkbox" name="conditions" defaultChecked={a.dryingConditionsMatch} /> Test
          rate matches this material, thickness, moisture basis and site conditions
        </label>
        <button className="shared-primary">Save inputs and calculate</button>
      </fieldset>
      {!editable && <p>Engineer or owner membership is required to change these inputs.</p>}
      {error && <p role="alert">{error}</p>}
      <ul>
        {result.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </form>
  );
}
function Sourcing({
  component,
  apply,
  editable,
  busy,
}: {
  component: SharedSpecComponent;
  apply: (p: SharedSpecPatch) => Promise<void>;
  editable: boolean;
  busy: boolean;
}) {
  const families = [...new Set(MAURITIUS_MATERIAL_CANDIDATES.flatMap((c) => c.materialFamilies))];
  const [family, setFamily] = useState(families[0] ?? ''),
    [message, setMessage] = useState('');
  const matches = matchMaterialSources(
    { materialFamily: family, intendedUse: component.category, neededBy: component.deliveryDate },
    MAURITIUS_MATERIAL_CANDIDATES,
  );
  async function propose(m: (typeof matches)[number]) {
    if (!editable || busy) return;
    const changed = m.name !== component.material.trim();
    const sources = [
      ...new Set([
        ...(m.evidenceUrl ? [m.evidenceUrl] : []),
        ...(changed ? [] : component.sources),
      ]),
    ];
    if (sources.length > 12) {
      setMessage(
        'This component already has 12 source URLs. Review its references before adding another; none were discarded.',
      );
      return;
    }
    try {
      await apply({
        material: m.name,
        origin:
          m.origin === 'mauritius-made'
            ? 'mauritius'
            : m.origin === 'import-candidate'
              ? 'imported'
              : 'unknown',
        sources,
        ...(changed ? { carbon: null, cost: null } : {}),
      });
      setMessage(
        changed
          ? 'Replacement proposed. Previous carbon, quote and environmental analysis need new evidence. Confirm suitability, availability and delivery with the supplier.'
          : 'Reference retained. Confirm specification, availability and delivery with the supplier.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The reference could not be saved.');
    }
  }
  return (
    <section className="shared-card">
      <h2>Local versus imported</h2>
      <p>
        Compare evidence and delivery suitability. Growing potential is separate from a purchasable,
        tested building product. Proposing a different material replaces its current product
        references and clears earlier carbon, quote and environmental analysis; history retains the
        previous version.
      </p>
      <label>
        Material family
        <select value={family} onChange={(e) => setFamily(e.target.value)}>
          {families.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <div className="shared-source-grid">
        {matches.map((m) => (
          <article key={m.id}>
            <span className="shared-badge">{m.origin.replace(/-/g, ' ')}</span>
            <h3>{m.name}</h3>
            <p>{m.evidenceNote}</p>
            <p>
              Availability: {m.availability} · Delivery: {m.timing} · Use: {m.useMatch}
            </p>
            {m.evidenceUrl && (
              <a href={m.evidenceUrl} target="_blank" rel="noreferrer">
                Read source ↗
              </a>
            )}
            <button disabled={!editable || busy} onClick={() => void propose(m)}>
              Use as proposed reference
            </button>
          </article>
        ))}
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
const surfaceNumbers = [
  ['areaM2', 'Installed area m²'],
  ['annualActivations', 'Measured steps / vehicle passes per year'],
  ['joulesPerActivation', 'Delivered joules per step / pass'],
  ['annualAuxiliaryKwh', 'Auxiliary electricity kWh/year'],
  ['embodiedCarbonKgCo2e', 'Embodied carbon kgCO₂e'],
  ['gridKgCo2ePerKwh', 'Grid factor kgCO₂e/kWh'],
  ['annualOtherOperatingKgCo2e', 'Other operating emissions kgCO₂e/year'],
  ['annualVehiclePenaltyKgCo2e', 'Additional vehicle emissions kgCO₂e/year'],
  ['serviceLifeYears', 'Service life · years'],
] as const;
const surfaceSources = [
  ['trafficSource', 'Traffic evidence URL'],
  ['yieldSource', 'Measured output evidence URL'],
  ['auxiliarySource', 'Auxiliary energy evidence URL'],
  ['carbonSource', 'Carbon declaration URL'],
  ['gridSource', 'Grid factor evidence URL'],
  ['operatingCarbonSource', 'Operating emissions evidence URL'],
  ['vehiclePenaltySource', 'Vehicle penalty evidence URL'],
  ['lifetimeSource', 'Service life evidence URL'],
] as const;
function SurfaceForm({
  component,
  components,
  save,
  editable,
  busy,
}: {
  component: SharedSpecComponent;
  components: SharedSpecComponent[];
  save: (p: SharedSpecPatch) => Promise<void>;
  editable: boolean;
  busy: boolean;
}) {
  const a = component.analysis ?? {},
    scenario = a.surface,
    [error, setError] = useState('');
  const results = rankSurfaceTechnologies(
    components
      .filter((c) => !c.sourceRemoved && c.analysis?.surface)
      .map((c) => c.analysis!.surface as SurfaceTechnologyInput),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editable || busy) return;
    const data = new FormData(e.currentTarget),
      surface: Record<string, unknown> = {
        id: component.id,
        name: component.name,
        kind: data.get('kind'),
        exposure: data.get('exposure'),
      };
    for (const [key] of surfaceNumbers)
      if (data.get(key) !== '') surface[key] = Number(data.get(key));
    for (const [key] of surfaceSources)
      if (data.get(key)) surface[key] = String(data.get(key)).trim();
    if (data.get('carbonBoundary')) surface.carbonBoundary = data.get('carbonBoundary');
    const parsed = SharedSpecAnalysisSchema.safeParse({ ...a, surface });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(' · '));
      return;
    }
    try {
      await save({ analysis: parsed.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }
  return (
    <form className="shared-card" onSubmit={(e) => void submit(e)}>
      <h2>Surface technology review</h2>
      <p>
        Compare measured energy and embodied carbon per installed m². Moss is not an electricity
        generator. Roadside harvesting requires vehicle-drag and net-energy evidence.
      </p>
      <div className="shared-source-grid">
        {results.map((r) => (
          <article key={r.id}>
            <h3>{r.name}</h3>
            <p>Net energy: {number(r.energyKwhPerM2Year)} kWh/m²/year</p>
            <p>Embodied: {number(r.embodiedKgCo2ePerM2)} kgCO₂e/m²</p>
            <p>Carbon payback: {number(r.carbonPaybackYears)} years</p>
            <p>Energy rank: {r.energyRank ?? 'Not comparable'}</p>
            <details>
              <summary>Assumptions and missing evidence</summary>
              <ul>
                {r.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      <fieldset disabled={!editable || busy}>
        <legend>Scenario for {component.name}</legend>
        <div className="shared-fields">
          <label>
            Technology
            <select name="kind" defaultValue={scenario?.kind ?? 'moss'}>
              <option value="moss">Moss / living surface</option>
              <option value="piezo">Footfall energy surface</option>
              <option value="traffic-turbine">Roadside turbine</option>
            </select>
          </label>
          <label>
            Exposure
            <select name="exposure" defaultValue={scenario?.exposure ?? 'unknown'}>
              {['unknown', 'windward', 'leeward', 'sheltered'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {surfaceNumbers.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                min="0"
                step="any"
                defaultValue={scenario?.[key] ?? ''}
              />
            </label>
          ))}
          {surfaceSources.map(([key, label]) => (
            <label key={key}>
              {label}
              <input name={key} type="url" defaultValue={scenario?.[key] ?? ''} />
            </label>
          ))}
          <label>
            Lifecycle boundary
            <input name="carbonBoundary" defaultValue={scenario?.carbonBoundary ?? ''} />
          </label>
        </div>
        <button className="shared-primary">Save scenario and compare</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
