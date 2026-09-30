import { useMemo, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { applyBlockPreset, applySheetPreset, estimateMaterials, normaliseMaterialsSettings } from '../designer/materials';
import { propertyMaterialsGeometry } from '../designer/propertyMaterials';
import { CONSTRUCTION_BLOCK_PRESETS, CONSTRUCTION_SHEET_PRESETS, CONSTRUCTION_SOURCES } from '../data/constructionMaterials';
import './materialsPanel.css';

const fmt = (n: number) => n > 0 && n < 0.001 ? '< 0.001' : n.toLocaleString('en-GB', { maximumFractionDigits: 3 });
function QuantityInput({ label, value, onChange, step = 0.01, min = 0 }: { label: string; value: number; onChange: (n: number) => number; step?: number; min?: number }) {
  const [notice, setNotice] = useState('');
  return <label className="materials-field"><span>{label}</span><input key={value} type="number" aria-label={label} defaultValue={value} min={min} step={step} onBlur={e => {
    const n = e.currentTarget.valueAsNumber;
    if (!Number.isFinite(n) || n < min) {
      e.currentTarget.value = String(value);
      setNotice(`Enter a number of at least ${min}. The previous value was kept.`);
    } else if (n !== value) {
      const saved = onChange(n);
      // A clamped value can equal the existing prop and cause no remount. Keep
      // the visible input identical to the persisted number and report either way.
      e.currentTarget.value = String(saved);
      setNotice(saved !== n ? `Adjusted to ${saved} within the supported range.` : '');
    } else setNotice('');
  }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />{notice && <small role="status">{notice}</small>}</label>;
}

/** A view onto the pure estimator; saved inputs belong to Property, not this panel. */
export function MaterialsPanel() {
  const property = usePropertyStore(s => s.property);
  const save = usePropertyStore(s => s.setMaterialsSettings);
  const settings = useMemo(() => normaliseMaterialsSettings(property.materials), [property.materials]);
  const geometry = useMemo(() => propertyMaterialsGeometry(property, settings.scope), [property, settings.scope]);
  const report = useMemo(() => estimateMaterials(geometry, settings), [geometry, settings]);
  const [tab, setTab] = useState<'walls' | 'concrete' | 'roof' | 'report'>('walls');
  function change(path: string, value: unknown) {
    const next = structuredClone(settings);
    const keys = path.split('.');
    let cursor = next as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>;
    cursor[keys[keys.length - 1]] = value;
    if (path.startsWith('wall.') && ['blockLengthM', 'blockHeightM', 'thicknessM', 'dimensionBasis'].includes(keys[1])) next.wall.presetId = 'custom';
    if (path === 'roof.sheet.effectiveCoverM') next.roof.sheet.presetId = 'custom';
    const normalized = normaliseMaterialsSettings(next);
    if (JSON.stringify(normalized) !== JSON.stringify(settings)) save(normalized);
    let accepted: unknown = normalized;
    for (const key of keys) accepted = (accepted as Record<string, unknown>)[key];
    return accepted;
  }
  function field(label: string, path: string, value: number, step?: number, min?: number) { return <QuantityInput key={path} label={label} value={value} onChange={n => { const saved = change(path, n); return typeof saved === 'number' ? saved : value; }} step={step} min={min} />; }
  function toggle(label: string, path: string, value: boolean) { return <label className="materials-check"><input type="checkbox" checked={value} onChange={e => change(path, e.target.checked)} />{label}</label>; }
  function mixFields(path: 'mortar' | 'plaster.mix' | 'concrete') {
    const mix = path === 'plaster.mix' ? settings.plaster.mix : settings[path];
    return <div className="materials-grid">{field('Cement parts', `${path}.cement`, mix.cement, 0.1)}{field('Sand parts', `${path}.sand`, mix.sand, 0.1)}{path === 'concrete' && field('Aggregate parts', `${path}.aggregate`, mix.aggregate, 0.1)}{field('Dry volume factor', `${path}.dryVolumeFactor`, mix.dryVolumeFactor)}{field('Cement bulk kg/m³', `${path}.cementBulkDensityKgM3`, mix.cementBulkDensityKgM3, 10)}{field('Bag weight kg', `${path}.bagKg`, mix.bagKg, 1)}{field('Mix allowance %', `${path}.wastePct`, mix.wastePct, 1)}</div>;
  }
  function exportReport() {
    const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), propertyId: property.id, propertyName: property.name, geometry, report, sources: CONSTRUCTION_SOURCES }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = 'materials-estimate.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="materials-panel" data-testid="materials-panel" aria-label="Materials estimate">
    <div className="materials-intro"><strong>From your drawing</strong><p>Quantities for planning and supplier quotes. Open the details only when you need them.</p></div>
    <label className="materials-field"><span>Walls measured</span><select aria-label="Materials scope" value={settings.scope} onChange={e => change('scope', e.target.value)}><option value="all">Whole building</option><option value="active">Selected floor</option></select></label>
    <div className="materials-metrics"><div><strong>{fmt(report.totals.wallNetAreaM2)}</strong><span>m² net wall</span></div><div><strong>{fmt(report.totals.blocks)}</strong><span>blocks incl. waste</span></div><div><strong>{fmt(report.totals.concreteOrderM3)}</strong><span>m³ concrete</span></div><div><strong>{fmt(report.totals.cementBags)}</strong><span>cement bags · all site mixes</span></div></div>
    <nav className="materials-tabs" aria-label="Materials sections">{(['walls', 'concrete', 'roof', 'report'] as const).map(id => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{id === 'report' ? 'Report' : id[0].toUpperCase() + id.slice(1)}</button>)}</nav>
    {tab === 'walls' && <div className="materials-fields">
      <label className="materials-field"><span>Wall construction</span><select value={settings.wall.kind} onChange={e => change('wall.kind', e.target.value)}><option value="block">Concrete block masonry</option><option value="concrete">Poured concrete wall</option></select></label>
      {settings.wall.kind === 'block' && <><label className="materials-field"><span>Supplier size preset</span><select aria-label="Block size preset" value={settings.wall.presetId} onChange={e => save(applyBlockPreset(settings, e.target.value))}><option value="custom">Custom dimensions</option>{CONSTRUCTION_BLOCK_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><p className="materials-note">Published size, adjustable below. Confirm whether your supplier’s dimensions include the joint.</p>
      <div className="materials-grid">{field('Block length m', 'wall.blockLengthM', settings.wall.blockLengthM)}{field('Block height m', 'wall.blockHeightM', settings.wall.blockHeightM)}{field('Joint mm', 'wall.jointMm', settings.wall.jointMm, 1)}{field('Bedding fraction', 'wall.beddingFraction', settings.wall.beddingFraction, 0.05)}</div>
      <label className="materials-field"><span>Dimension basis</span><select value={settings.wall.dimensionBasis} onChange={e => change('wall.dimensionBasis', e.target.value)}><option value="actual">Block size + joint</option><option value="nominal">Module already includes joint</option></select></label></>}
      <div className="materials-grid">{field('Wall thickness m', 'wall.thicknessM', settings.wall.thicknessM)}{field('Wall waste %', 'wall.wastePct', settings.wall.wastePct, 1)}</div>
      {settings.wall.kind === 'block' && <details><summary>Mortar · editable volume ratio</summary>{mixFields('mortar')}</details>}
      <details><summary>Plaster on wall faces</summary><label className="materials-field"><span>Faces to plaster</span><select value={settings.plaster.sides} onChange={e => change('plaster.sides', Number(e.target.value))}><option value="0">None</option><option value="1">One face</option><option value="2">Both faces</option></select></label>{field('Plaster thickness mm', 'plaster.thicknessMm', settings.plaster.thicknessMm, 1)}{mixFields('plaster.mix')}</details>
      <p className="materials-note">Shared walls count once. Door and window openings are deducted at their drawn heights. This estimates one selected construction throughout the measured scope; visual paint/brick finishes are independent.</p>
    </div>}
    {tab === 'concrete' && <div className="materials-fields">
      <label className="materials-field"><span>Concrete supply</span><select value={settings.concrete.supply} onChange={e => change('concrete.supply', e.target.value)}><option value="ready-mix">Ready-mix · order volume</option><option value="site-mix">Site mix · editable ingredients</option></select></label>
      {toggle('Include ground concrete base', 'base.enabled', settings.base.enabled)}
      {settings.base.enabled && <><p className="materials-note">Ground footprint: {fmt(geometry.baseAreaM2)} m². Depth is an estimating input, not a foundation design.</p><div className="materials-grid">{field('Base depth m', 'base.depthM', settings.base.depthM)}{field('Base area m²', 'base.areaOverrideM2', settings.base.areaOverrideM2 ?? geometry.baseAreaM2)}</div><button className="materials-link" onClick={() => change('base.areaOverrideM2', null)}>Use live drawn base area</button></>}
      <details><summary>Pillars · enter your schedule</summary><div className="materials-grid">{field('Pillar count', 'pillars.count', settings.pillars.count, 1)}{field('Pillar width m', 'pillars.widthM', settings.pillars.widthM)}{field('Pillar depth m', 'pillars.depthM', settings.pillars.depthM)}{field('Pillar clear height m', 'pillars.heightM', settings.pillars.heightM)}</div><p className="materials-note">Pillars are added separately. If embedded in masonry, subtract their displaced wall area in the drawing. Reinforcement, footings and beams need a separate design/schedule.</p></details>
      {settings.concrete.supply === 'ready-mix' && field('Concrete volume allowance %', 'concrete.wastePct', settings.concrete.wastePct, 1)}
      {settings.concrete.supply === 'site-mix' && <details open><summary>Concrete · editable dry volume ratio</summary>{mixFields('concrete')}<p className="materials-note">A volume ratio does not certify strength. Confirm the cement, rocksand, aggregate, water and trial-mix yield with your supplier or engineer.</p></details>}
    </div>}
    {tab === 'roof' && <div className="materials-fields">
      <label className="materials-field"><span>Roof estimate</span><select aria-label="Roof estimate type" value={settings.roof.kind} onChange={e => change('roof.kind', e.target.value)}><option value="none">Not included</option><option value="reinforced-concrete">Reinforced concrete</option><option value="sheet">Profiled metal sheets</option></select></label>
      <p className="materials-note">Top-storey footprint: {fmt(geometry.roofAreaM2)} m². Courtyard gaps are excluded; roof penetrations are not deducted.</p>
      {settings.roof.kind !== 'none' && <><div className="materials-grid">{settings.roof.kind === 'reinforced-concrete' && field('Roof area m²', 'roof.areaOverrideM2', settings.roof.areaOverrideM2 ?? geometry.roofAreaM2)}{field('Roof length m', 'roof.lengthOverrideM', settings.roof.lengthOverrideM ?? geometry.roofLengthM)}{field('Roof width m', 'roof.widthOverrideM', settings.roof.widthOverrideM ?? geometry.roofWidthM)}</div>
        <p className="materials-note">{settings.roof.kind === 'reinforced-concrete' ? 'Concrete uses the net area. Enter a checked area to deduct penetrations or add overhangs. Length and width are used only for the optional rectangular steel grid.' : 'Sheets use this length and width with the pitch and overhang below. Irregular roofs need a checked rectangle or a separate schedule per roof face.'}</p>
        <button className="materials-link" onClick={() => save({ ...settings, roof: { ...settings.roof, areaOverrideM2: null, lengthOverrideM: null, widthOverrideM: null } })}>Use live drawn roof dimensions</button></>}
      {settings.roof.kind === 'reinforced-concrete' && <>{field('Roof slab depth m', 'roof.depthM', settings.roof.depthM)}{toggle('Estimate an entered rebar grid', 'roof.rebar.enabled', settings.roof.rebar.enabled)}{settings.roof.rebar.enabled && <><p className="materials-note">Enter an engineer’s grid specification. This is a stock allowance, not a bending schedule or a design for cyclone loads.</p><div className="materials-grid">{field('Bar diameter mm', 'roof.rebar.diameterMm', settings.roof.rebar.diameterMm, 1)}{field('Bar spacing mm', 'roof.rebar.spacingMm', settings.roof.rebar.spacingMm, 10)}{field('Grid layers', 'roof.rebar.layers', settings.roof.rebar.layers, 1)}{field('Edge cover mm', 'roof.rebar.coverMm', settings.roof.rebar.coverMm, 1)}{field('Stock bar length m', 'roof.rebar.stockLengthM', settings.roof.rebar.stockLengthM, 0.5)}{field('Lap length m', 'roof.rebar.lapLengthM', settings.roof.rebar.lapLengthM, 0.05)}{field('Steel allowance %', 'roof.rebar.wastePct', settings.roof.rebar.wastePct, 1)}</div></>}</>}
      {settings.roof.kind === 'sheet' && <><label className="materials-field"><span>Sheet profile</span><select value={settings.roof.sheet.presetId} onChange={e => save(applySheetPreset(settings, e.target.value))}><option value="custom">Custom profile</option>{CONSTRUCTION_SHEET_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label className="materials-field"><span>Roof slopes</span><select value={settings.roof.sheet.slopes} onChange={e => change('roof.sheet.slopes', Number(e.target.value))}><option value="1">One slope</option><option value="2">Two slopes</option></select></label><div className="materials-grid">{field('Pitch degrees', 'roof.sheet.pitchDeg', settings.roof.sheet.pitchDeg, 1)}{field('Effective cover m', 'roof.sheet.effectiveCoverM', settings.roof.sheet.effectiveCoverM)}{field('Sheet length m', 'roof.sheet.sheetLengthM', settings.roof.sheet.sheetLengthM, 0.1)}{field('End lap m', 'roof.sheet.endLapM', settings.roof.sheet.endLapM)}{field('Overhang m', 'roof.sheet.overhangM', settings.roof.sheet.overhangM)}{field('Sheet waste %', 'roof.sheet.wastePct', settings.roof.sheet.wastePct, 1)}</div><details><summary>Fixings, purlins and trims</summary><div className="materials-grid">{field('Fixings per m²', 'roof.sheet.fastenersPerM2', settings.roof.sheet.fastenersPerM2, 1)}{field('Purlin spacing m (0 = omit)', 'roof.sheet.purlinSpacingM', settings.roof.sheet.purlinSpacingM, 0.1)}{field('Ridge length m', 'roof.sheet.ridgeLengthM', settings.roof.sheet.ridgeLengthM, 0.1)}{field('Flashing length m', 'roof.sheet.flashingLengthM', settings.roof.sheet.flashingLengthM, 0.1)}{field('Gutter length m', 'roof.sheet.gutterLengthM', settings.roof.sheet.gutterLengthM, 0.1)}{field('Trim stock length m', 'roof.sheet.trimStockLengthM', settings.roof.sheet.trimStockLengthM, 0.1)}{field('Trim lap m', 'roof.sheet.trimLapM', settings.roof.sheet.trimLapM)}</div></details></>}
    </div>}
    {tab === 'report' && <div className="materials-fields"><button className="materials-export" onClick={exportReport}>Download quantities & assumptions</button>
      {(['component', 'summary'] as const).map(role => <div key={role}>
        <strong>{role === 'component' ? 'Measured components' : 'Totals and purchasing conversions'}</strong>
        {role === 'summary' && <p className="materials-note">These summarize or convert the component quantities above. Do not add them again.</p>}
        {report.lines.filter(line => line.quantity > 0 && line.role === role).map(line => <details key={line.id} className="materials-result" data-quantity-id={line.id}><summary><span>{line.label}</span><strong>{fmt(line.quantity)} {line.unit}</strong></summary><p>{line.formula}</p><p>Net: {fmt(line.net)} {line.unit} · allowance: {line.wastePct}%</p></details>)}
      </div>)}
      <details><summary>Assumptions and exclusions</summary>{report.assumptions.map(text => <p key={text}>{text}</p>)}</details><details><summary>Verified supplier references</summary>{CONSTRUCTION_SOURCES.map(source => <article key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.supplier} · {source.title} ↗</a><p>{source.note}</p><small>Checked {source.checkedAt}</small></article>)}</details></div>}
    {report.warnings.length > 0 && <details className="materials-warnings"><summary>{report.warnings.length} estimate notes to review</summary>{report.warnings.map(warning => <p key={warning}>{warning}</p>)}</details>}
    <p className="materials-note">Saved with this design when you change an input. Estimates exclude structural approval, labour, delivery and unmodelled details. Supplier quotes confirm sizes, suitability and availability.</p>
  </section>;
}
