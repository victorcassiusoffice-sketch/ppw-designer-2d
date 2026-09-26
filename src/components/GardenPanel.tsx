import { useEffect, useState } from 'react';
import { usePropertyStore } from '../store/propertyStore';
import { useGardenEditorStore } from '../store/gardenEditorStore';
import {
  FENCE_MATERIALS, GARDEN_SURFACES, fenceLengthM,
  type FenceMaterial, type GardenPlacement, type GardenSurfaceKind,
} from '../designer/garden';
import { OUTDOOR_PAVING_PRODUCTS, findOutdoorPavingProduct, pavingSizeLabel, type OutdoorPavingProduct } from '../data/outdoorPaving';
import { estimateGardenPaving } from '../designer/gardenPaving';
import './GardenPanel.css';

const BUTTON = 'garden-button inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-ppw-rim bg-white px-3 text-[12px] font-medium text-[#37362f] hover:bg-[#f3f1ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ppw-inkDeep';
const FIELD = 'garden-field h-11 min-w-0 rounded-lg border border-ppw-rim bg-white px-2 text-[13px]';
const mur = (value: number) => `Rs ${value.toLocaleString('en-MU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PavingSource({ product }: { product: OutdoorPavingProduct }) {
  return <p className="garden-muted text-[11px] leading-relaxed">
    {product.brand} · {pavingSizeLabel(product)} · {mur(product.unitPriceMur)}/piece, VAT included.<br />
    <a className="garden-source-link underline underline-offset-2" href={product.sourceUrl} target="_blank" rel="noreferrer">Espace Maison · {product.sku} ↗</a><br />
    Price checked {product.checkedAt}. Confirm price and availability with the shop.
  </p>;
}

function Metres({ label, value, min = -10000, max = 10000, onCommit }: {
  label: string; value: number; min?: number; max?: number; onCommit: (n: number) => boolean | void;
}) {
  const [text, setText] = useState(String(Number(value.toFixed(2))));
  useEffect(() => setText(String(Number(value.toFixed(2)))), [value]);
  return <label className="garden-muted flex min-w-0 flex-col gap-1 text-[11px] text-[#5b5852]">
    {label} (m)
    <input
      type="number" inputMode="decimal" step="0.1" min={min} max={max} value={text}
      className="garden-field h-11 min-w-0 rounded-lg border border-ppw-rim bg-white px-2 text-[16px] tabular-nums text-[#37362f] md:text-[13px]"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const number = Number(text);
        if (!text.trim() || !Number.isFinite(number) || number < min || number > max || onCommit(number) === false) {
          setText(String(Number(value.toFixed(2))));
        }
      }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    />
  </label>;
}

export interface GardenPanelProps {
  onRequestPlacement?: (intent: GardenPlacement) => void;
  onClose?: () => void;
  /** Opt in inside the navy 3D inspector; plan panels keep their light theme. */
  architectural?: boolean;
}

/** The same persisted ground-level landscape can be edited in plan or 3D. */
export function GardenPanel({ onRequestPlacement, onClose, architectural = false }: GardenPanelProps) {
  const property = usePropertyStore((s) => s.property);
  const selectedId = useGardenEditorStore((s) => s.selectedId);
  const setSelectedId = useGardenEditorStore((s) => s.select);
  const [fenceMaterial, setFenceMaterial] = useState<FenceMaterial>('timber');
  const [pavingId, setPavingId] = useState(OUTDOOR_PAVING_PRODUCTS[0].id);
  const surfaces = property.garden?.surfaces ?? [];
  const fences = property.garden?.fences ?? [];
  const surface = surfaces.find((entry) => entry.id === selectedId);
  const fence = fences.find((entry) => entry.id === selectedId);
  const totalArea = surfaces.reduce((sum, entry) => sum + entry.widthM * entry.depthM, 0);
  const totalFence = fences.reduce((sum, entry) => sum + fenceLengthM(entry), 0);
  const newPaving = findOutdoorPavingProduct(pavingId) ?? OUTDOOR_PAVING_PRODUCTS[0];
  const pavingEstimate = surface ? estimateGardenPaving(surface) : null;
  const pavingEstimates = surfaces.flatMap((entry) => { const estimate = estimateGardenPaving(entry); return estimate ? [estimate] : []; });
  const pavingTotal = pavingEstimates.reduce((sum, entry) => sum + entry.totalMur, 0);

  function defaultOrigin(widthM: number, depthM: number) {
    const points = property.rooms.filter((room) => !room.levelId || room.levelId === 'ground').flatMap((room) => room.polygon);
    const x = points.length ? Math.max(...points.map((point) => point.x)) + 1 : 0;
    const y = points.length ? Math.min(...points.map((point) => point.y)) : 0;
    const site = property.site;
    if (!site) return { x, y };
    return {
      x: Math.max(site.originM.x, Math.min(x, site.originM.x + site.widthM - widthM)),
      y: Math.max(site.originM.y, Math.min(y, site.originM.y + site.depthM - depthM)),
    };
  }

  function addSurface(kind: GardenSurfaceKind, pavingProductId?: string) {
    const widthM = Math.min(kind === 'path' ? 1.2 : 4, property.site?.widthM ?? 500);
    const depthM = Math.min(kind === 'soil' ? 2 : 4, property.site?.depthM ?? 500);
    const id = usePropertyStore.getState().addGardenSurface({ kind, ...defaultOrigin(widthM, depthM), widthM, depthM, elevationM: 0, ...(pavingProductId ? { pavingProductId } : {}) });
    if (id) {
      setSelectedId(id);
      onRequestPlacement?.({ kind: 'surface', id });
    }
  }

  function addFence() {
    const length = Math.min(4, property.site?.widthM ?? 500);
    const origin = defaultOrigin(length, 0.2);
    const id = usePropertyStore.getState().addGardenFence({
      a: origin, b: { x: origin.x + length, y: origin.y }, heightM: 1.2, material: fenceMaterial,
    });
    if (id) {
      setSelectedId(id);
      onRequestPlacement?.({ kind: 'fence', id });
    }
  }

  return <section data-testid="garden-panel" aria-label="Garden design" className={`garden-panel flex min-w-0 flex-col gap-3 bg-[#faf9f5] p-3 text-[#37362f]${architectural ? ' garden-panel--architectural' : ''}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0"><h2 className="text-sm font-semibold">Garden & outdoors</h2><p className="garden-muted text-[11px] text-[#5b5852]">Ground level · saved with your design</p></div>
      {onClose && <button type="button" className={BUTTON} onClick={onClose}>Done</button>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(GARDEN_SURFACES) as GardenSurfaceKind[]).map((kind) => <button
        key={kind} type="button" className={BUTTON} onClick={() => addSurface(kind)} data-testid={`garden-add-${kind}`}
      ><span className="garden-swatch h-4 w-4 shrink-0 rounded" style={{ background: GARDEN_SURFACES[kind].hex }} aria-hidden />+ {GARDEN_SURFACES[kind].label}</button>)}
    </div>
    <fieldset className="garden-product-card min-w-0 rounded-lg border border-ppw-rim p-2.5" data-testid="garden-paving-range">
      <legend className="px-1 text-[12px] font-semibold">Espace Maison paving</legend>
      <label className="flex min-w-0 flex-col gap-1 text-[11px]">Pedestrian cement slabs
        <select aria-label="New paving product" className={`${FIELD} w-full`} value={pavingId} onChange={(event) => setPavingId(event.target.value)}>
          {OUTDOOR_PAVING_PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.tileWidthM * 100} × {product.tileDepthM * 100} cm</option>)}
        </select>
      </label>
      <div className="mt-2"><PavingSource product={newPaving} /></div>
      <button type="button" className={`${BUTTON} mt-2 w-full`} data-testid="garden-add-paving" onClick={() => addSurface('path', newPaving.id)}>+ Paving patch</button>
    </fieldset>
    <div className="flex gap-2">
      <select aria-label="New fence material" className="garden-field h-11 min-w-0 flex-1 rounded-lg border border-ppw-rim bg-white px-2 text-[13px]" value={fenceMaterial} onChange={(event) => setFenceMaterial(event.target.value as FenceMaterial)}>
        {(Object.keys(FENCE_MATERIALS) as FenceMaterial[]).map((kind) => <option key={kind} value={kind}>{FENCE_MATERIALS[kind].label}</option>)}
      </select>
      <button type="button" className={BUTTON} onClick={addFence} data-testid="garden-add-fence">+ Boundary</button>
    </div>
    <p className="garden-muted text-[11px] leading-relaxed text-[#5b5852]">Add a surface, then drag its edges in the plan or use Draw area to set two corners. Raise a surface for a terrace or planting bed. Outdoor furniture comes from the product catalog.</p>

    {(surfaces.length > 0 || fences.length > 0) && <>
      <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium">Edit landscape
        <select aria-label="Landscape element" data-testid="garden-element-select" className="garden-field h-11 min-w-0 rounded-lg border border-ppw-rim bg-white px-2 text-[13px]" value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="" disabled>Choose an element</option>
          {surfaces.map((entry, index) => <option key={entry.id} value={entry.id}>{findOutdoorPavingProduct(entry.pavingProductId)?.name ?? GARDEN_SURFACES[entry.kind].label} {index + 1} · {(entry.widthM * entry.depthM).toFixed(1)} m²</option>)}
          {fences.map((entry, index) => <option key={entry.id} value={entry.id}>{FENCE_MATERIALS[entry.material].label} {index + 1} · {fenceLengthM(entry).toFixed(1)} m</option>)}
        </select>
      </label>
      {(surface || fence) && <div className="flex flex-wrap gap-2">
        {onRequestPlacement && <button type="button" className={`${BUTTON} flex-1`} data-testid="garden-move" onClick={() => onRequestPlacement({ kind: surface ? 'surface' : 'fence', id: selectedId! })}>Place in view</button>}
        {surface && onRequestPlacement && <button type="button" className={`${BUTTON} flex-1`} data-testid="garden-resize" onClick={() => onRequestPlacement({ kind: 'surface', id: surface.id, mode: 'resize' })}>Draw area</button>}
        <button type="button" className={`${BUTTON} garden-button--remove border-[#ba725f]`} data-testid="garden-remove" onClick={() => { usePropertyStore.getState().removeGardenElement(selectedId!); setSelectedId(null); }}>Remove</button>
      </div>}
      {surface && <div className="grid grid-cols-2 gap-2" data-testid="garden-surface-edit">
        <Metres label="X" value={surface.x} onCommit={(x) => usePropertyStore.getState().updateGardenSurface(surface.id, { x })} />
        <Metres label="Y" value={surface.y} onCommit={(y) => usePropertyStore.getState().updateGardenSurface(surface.id, { y })} />
        <Metres label="Width" min={0.2} max={500} value={surface.widthM} onCommit={(widthM) => usePropertyStore.getState().updateGardenSurface(surface.id, { widthM })} />
        <Metres label="Depth" min={0.2} max={500} value={surface.depthM} onCommit={(depthM) => usePropertyStore.getState().updateGardenSurface(surface.id, { depthM })} />
        <Metres label="Raise terrain" min={0} max={2} value={surface.elevationM} onCommit={(elevationM) => usePropertyStore.getState().updateGardenSurface(surface.id, { elevationM })} />
        <label className="garden-muted flex min-w-0 flex-col gap-1 text-[11px]">Surface<select aria-label="Surface material" className="garden-field h-11 min-w-0 rounded-lg border border-ppw-rim bg-white px-2 text-[13px]" value={surface.kind} onChange={(event) => usePropertyStore.getState().updateGardenSurface(surface.id, { kind: event.target.value as GardenSurfaceKind, pavingProductId: undefined })}>
          {(Object.keys(GARDEN_SURFACES) as GardenSurfaceKind[]).map((kind) => <option key={kind} value={kind}>{GARDEN_SURFACES[kind].label}</option>)}
        </select></label>
        {surface.kind === 'path' && <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[11px]">Paving product
          <select aria-label="Paving product for selected patch" data-testid="garden-paving-product" className={FIELD} value={surface.pavingProductId ?? ''}
            onChange={(event) => usePropertyStore.getState().updateGardenSurface(surface.id, { pavingProductId: event.target.value || undefined })}>
            <option value="">Generic paving · no product price</option>
            {surface.pavingProductId && !findOutdoorPavingProduct(surface.pavingProductId) && <option value={surface.pavingProductId}>Saved product · details unavailable</option>}
            {OUTDOOR_PAVING_PRODUCTS.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.tileWidthM * 100} × {product.tileDepthM * 100} cm</option>)}
          </select>
        </label>}
        {pavingEstimate && <div className="garden-product-card col-span-2 rounded-lg border border-ppw-rim p-2.5" data-testid="garden-paving-estimate" aria-live="polite">
          <p className="text-[12px] font-semibold tabular-nums">{pavingEstimate.areaM2.toFixed(2)} m² · {pavingEstimate.pieces} pieces · {mur(pavingEstimate.totalMur)}</p>
          <PavingSource product={pavingEstimate.product} />
          <p className="garden-muted mt-2 text-[11px] leading-relaxed">{pavingEstimate.columns} × {pavingEstimate.rows} straight rows. Edge cuts use whole pieces; offcuts are not reused. No joint gap, breakage allowance, delivery or laying cost included. Colour preview is illustrative.</p>
        </div>}
      </div>}
      {fence && <div className="grid grid-cols-2 gap-2" data-testid="garden-fence-edit">
        <Metres label="Start X" value={fence.a.x} onCommit={(x) => usePropertyStore.getState().updateGardenFence(fence.id, { a: { ...fence.a, x } })} />
        <Metres label="Start Y" value={fence.a.y} onCommit={(y) => usePropertyStore.getState().updateGardenFence(fence.id, { a: { ...fence.a, y } })} />
        <Metres label="End X" value={fence.b.x} onCommit={(x) => usePropertyStore.getState().updateGardenFence(fence.id, { b: { ...fence.b, x } })} />
        <Metres label="End Y" value={fence.b.y} onCommit={(y) => usePropertyStore.getState().updateGardenFence(fence.id, { b: { ...fence.b, y } })} />
        <Metres label="Height" min={0.3} max={3} value={fence.heightM} onCommit={(heightM) => usePropertyStore.getState().updateGardenFence(fence.id, { heightM })} />
        <label className="garden-muted flex min-w-0 flex-col gap-1 text-[11px]">Boundary<select aria-label="Fence material" className="garden-field h-11 min-w-0 rounded-lg border border-ppw-rim bg-white px-2 text-[13px]" value={fence.material} onChange={(event) => usePropertyStore.getState().updateGardenFence(fence.id, { material: event.target.value as FenceMaterial })}>
          {(Object.keys(FENCE_MATERIALS) as FenceMaterial[]).map((kind) => <option key={kind} value={kind}>{FENCE_MATERIALS[kind].label}</option>)}
        </select></label>
      </div>}
    </>}
    <p className="garden-quantities border-t border-ppw-rim pt-2 text-[11px] tabular-nums" data-testid="garden-quantities">Surfaces {totalArea.toFixed(1)} m² · boundaries {totalFence.toFixed(1)} m<br />
      {pavingEstimates.length > 0 && <span data-testid="garden-paving-total">Paving material estimate {mur(pavingTotal)} · VAT included<br /></span>}
      <span className="garden-muted text-[#5b5852]">Generic surfaces and boundaries have no product price. Overlapping patches are counted separately. Paving estimates are separate from the product cart.</span>
    </p>
  </section>;
}
