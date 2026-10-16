import { useEffect, useState } from 'react';
import type { GardenPool, GardenSurface } from '../designer/garden';
import { outdoorSurfaceTakeoff, poolTakeoff } from '../designer/outdoorTakeoff';
import { findPoolReference, MAURITIUS_POOL_REFERENCES, OUTDOOR_SUPPLIER_REFERENCES } from '../data/mauritiusPools';
import { usePropertyStore } from '../store/propertyStore';

function Dimension({ label, value, min, max, onChange }: { label: string; value?: number; min: number; max: number; onChange: (v: number | undefined) => boolean }) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  useEffect(() => setDraft(value === undefined ? '' : String(value)), [value]);
  return <label className="garden-muted flex min-w-0 flex-col gap-1 text-[11px]">{label} (m)
    <input className="garden-field h-11 min-w-0 rounded-lg border border-ppw-rim px-2 text-[16px]" aria-label={`${label} in metres`}
      type="number" step="0.01" inputMode="decimal" min={min} max={max} value={draft} placeholder="Set depth"
      onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      onBlur={() => { const n = draft.trim() ? Number(draft) : undefined;
        if ((n !== undefined && (!Number.isFinite(n) || n < min || n > max)) || !onChange(n)) setDraft(value === undefined ? '' : String(value)); }} />
  </label>;
}

export function OutdoorBuildDetails({ surface }: { surface: GardenSurface }) {
  const update = (patch: Partial<GardenSurface>) => usePropertyStore.getState().updateGardenSurface(surface.id, patch);
  const q = outdoorSurfaceTakeoff(surface), pool = poolTakeoff(surface);
  const settings = surface.pool;
  const setPool = (patch: Partial<GardenPool>) => settings ? update({ pool: { ...settings, ...patch } }) : false;
  const reference = findPoolReference(settings?.productReferenceId);
  return <div className="garden-product-card col-span-2 rounded-lg border border-ppw-rim p-2.5" data-testid="outdoor-build-details">
    {q && <>
      <h3 className="text-[12px] font-semibold">Outdoor floor layers</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Dimension label="Material thickness" value={surface.thicknessM} min={0.001} max={5} onChange={thicknessM => update({ thicknessM })} />
        <Dimension label="Sub-base depth" value={surface.subBaseDepthM} min={0} max={10} onChange={subBaseDepthM => update({ subBaseDepthM })} />
      </div>
      <p className="mt-2 text-[12px] tabular-nums" data-testid="outdoor-layer-quantities">{q.areaM2.toFixed(2)} m² · {q.perimeterM.toFixed(2)} m perimeter<br />
        Material {q.materialVolumeM3 === null ? '— set thickness' : `${q.materialVolumeM3.toFixed(3)} m³`}<br />Sub-base {q.subBaseVolumeM3 === null ? '— set depth' : `${q.subBaseVolumeM3.toFixed(3)} m³`}</p>
      <p className="garden-muted mt-1 text-[11px]">Uniform finished depths. Tonnes need a supplier density; no compaction or wastage assumed. A sourced slab supplies its listed thickness unless overridden.</p>
    </>}
    {pool && settings && <>
      <h3 className="text-[12px] font-semibold">Pool build · inner dimensions</h3>
      <label className="mt-2 flex flex-col gap-1 text-[11px]">Construction view<select aria-label="Pool construction stage" className="garden-field h-11 rounded-lg border border-ppw-rim px-2" value={settings.stage} onChange={e => setPool({ stage: e.target.value as GardenPool['stage'] })}>
        <option value="excavation">Excavation · see depth</option><option value="shell">Empty basin</option><option value="filled">Filled with water</option>
      </select></label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Dimension label="Basin depth" value={settings.shellDepthM} min={0.2} max={10} onChange={n => n !== undefined && setPool({ shellDepthM: n, waterDepthM: Math.min(settings.waterDepthM, n) })} />
        <Dimension label="Water depth" value={settings.waterDepthM} min={0} max={settings.shellDepthM} onChange={n => n !== undefined && setPool({ waterDepthM: n })} />
        <Dimension label="Wall thickness" value={settings.wallThicknessM} min={0.01} max={2} onChange={n => n !== undefined && setPool({ wallThicknessM: n })} />
        <Dimension label="Base thickness" value={settings.baseThicknessM} min={0.01} max={2} onChange={n => n !== undefined && setPool({ baseThicknessM: n })} />
        <Dimension label="Excavation clearance" value={settings.excavationMarginM} min={0} max={5} onChange={n => n !== undefined && setPool({ excavationMarginM: n })} />
      </div>
      <p className="mt-2 text-[12px] tabular-nums" data-testid="pool-quantities">Excavation {pool.excavationVolumeM3.toFixed(2)} m³ · {pool.excavationDepthM.toFixed(2)} m deep<br />
        Water {pool.waterVolumeM3.toFixed(2)} m³ / {pool.waterLitres.toLocaleString(undefined, { maximumFractionDigits: 0 })} L<br />
        Shell material {pool.shellVolumeM3.toFixed(2)} m³ · lining {pool.liningAreaM2.toFixed(2)} m²<br />
        Coping perimeter {pool.perimeterM.toFixed(2)} m · freeboard {pool.freeboardM.toFixed(2)} m</p>
      <p className="garden-muted mt-1 text-[11px]">Flat-bottom rectangular planning basin; defaults are editable examples. Lining includes floor and walls to the rim, without seams or waste. No stairs, slopes or benches included. Structural shell, ground support, groundwater, barriers, drainage and electrical protection need qualified design. Quantities stay the same in every construction view.</p>
      <label className="mt-2 flex flex-col gap-1 text-[11px]">Mauritius pool reference<select aria-label="Mauritius pool reference" className="garden-field h-11 min-w-0 rounded-lg border border-ppw-rim px-2" value={settings.productReferenceId ?? ''} onChange={e => setPool({ productReferenceId: e.target.value || undefined })}>
        <option value="">Custom pool · request a quote</option>{settings.productReferenceId && !reference && <option value={settings.productReferenceId}>Saved pool reference · details unavailable</option>}{MAURITIUS_POOL_REFERENCES.map(p => <option key={p.id} value={p.id}>{p.supplier} · {p.name}</option>)}
      </select></label>
      {reference && <p className="garden-muted mt-2 text-[11px]" data-testid="pool-supplier-reference"><a className="garden-source-link underline" href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.supplier} · {reference.name} ↗</a><br />
        Published envelope {reference.lengthM} × {reference.widthM} m; depth {reference.minimumDepthM}–{reference.maximumDepthM} m; supplier volume {reference.declaredVolumeM3} m³. {reference.detail} Reference checked {reference.checkedAt}; price and availability by enquiry.</p>}
    </>}
    {OUTDOOR_SUPPLIER_REFERENCES.filter(s => s.kind === surface.kind).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="garden-source-link mt-2 block text-[11px] underline">{s.name} ↗</a>)}
  </div>;
}
