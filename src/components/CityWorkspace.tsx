import { useAppPreferences } from '../i18n/AppPreferences';
import { LocaleThemeControls } from './LocaleThemeControls';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useHistoryStore } from '../store/historyStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import {
  beginWorkspaceNavigation,
  cancelWorkspaceNavigation,
  finishWorkspaceNavigation,
} from '../designer/workspaceNavigation';
import { buildingLevels } from '../designer/building';
import {
  CITY_ASSET_KINDS,
  CITY_NETWORK_SYSTEMS,
  CITY_ROAD_PRESETS,
  emptyCity,
  estimateCity,
  sampleCity,
  type CityAsset,
  type CityAssetKind,
  type CityDataCentre,
  type CityModel,
  type CityNetworkSystem,
  type CityPoint,
} from '../designer/city';
import { CITY_SUPPLIER_REFERENCES } from '../data/citySuppliers';
import { isPriceFreeDemoPath } from '../demo/pitchEmbed';
import { DEMO_PAGE_READY_EVENT, isDemoPagePending } from '../demo/useDemoMode';
import { useCityProcurementStore } from '../store/cityProcurementStore';
import { createCityProcurementPackage } from '../designer/cityProcurement';
import { CityPlanView } from './CityPlanView';
import { CityOrdersPanel } from './CityOrdersPanel';
import { StudioIcon } from './StudioIcon';
import './cityWorkspace.css';

const CityThreeView = lazy(() => import('./CityThreeView'));
const UNSAVED_ORDER_MESSAGE =
  'Save the supplier package or discard its edits before leaving Orders. Your entries are still here.';
const DATA_CENTRE: CityDataCentre = {
  racks: 12,
  kWPerRack: 6,
  utilisation: 0.6,
  pue: 1.4,
  annualHours: 8760,
  pvKWp: 0,
  yieldKWhPerKWp: 0,
  batteryKWh: 0,
  batteryUsableFraction: 0.8,
};
const sizes: Record<CityAssetKind, [number, number, number]> = {
  building: [20, 16, 8],
  'data-centre': [36, 24, 6],
  park: [24, 20, 0.2],
  'solar-light': [0.4, 0.4, 6],
  'pv-array': [12, 6, 1.5],
  battery: [3, 2, 2],
  'water-tank': [3, 3, 3],
  transformer: [5, 4, 3],
  'ev-charger': [0.6, 0.6, 1.5],
};

export function CityLaunchButton({
  compact = false,
  onBeforeOpen,
}: {
  compact?: boolean;
  onBeforeOpen?: () => void;
}) {
  const { t } = useAppPreferences();
  return (
    <button
      type="button"
      className="city-launch"
      aria-label={t("City Build")}
      title="City Build · roads, utilities and infrastructure"
      onClick={() => {
        onBeforeOpen?.();
        window.dispatchEvent(new Event('ppw:open-city'));
      }}
    >
      <StudioIcon name="city" size={19} />
      <span>{compact ? t("City") : t("City Build")}</span>
    </button>
  );
}
export function CityWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [initialTab, setInitialTab] = useState<'plan' | 'orders'>('plan');
  const [open, setOpen] = useState(false),
    before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    let routeEntryPending = new URLSearchParams(location.search).get('panel') === 'city';
    const show = (event?: Event) => {
      setInitialTab((event as CustomEvent<{tab?: string}> | undefined)?.detail?.tab === 'orders' ? 'orders' : 'plan');
      routeEntryPending = false;
      beginWorkspaceNavigation('city');
      before.current();
      const ui = useDesignerUIStore.getState();
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new Event('ppw:close-house-details'));
      window.dispatchEvent(new Event('ppw:close-catalog'));
      setOpen(true);
    };
    const hide = () => {
      cancelWorkspaceNavigation('city');
      setOpen(false);
    };
    const close = () => {
      routeEntryPending = false;
      hide();
    };
    const enterRoute = () => {
      if (routeEntryPending && !isDemoPagePending()) show();
    };
    const closeTutorial = () => { finishWorkspaceNavigation('city'); setOpen(false); };
    window.addEventListener('olb:close-workspaces', closeTutorial);
    const others = [
      'olb:open-project',
      'ppw:open-foundation',
      'ppw:open-services',
      'ppw:open-plan-import',
      'ppw:open-ai-design',
    ];
    window.addEventListener('ppw:open-city', show);
    window.addEventListener(DEMO_PAGE_READY_EVENT, enterRoute);
    others.forEach((e) => window.addEventListener(e, close));
    const unsub = usePropertyStore.subscribe((s, old) => {
      if (s.property.id !== old.property.id) {
        // The initial demo swap must not cancel the queued route entry. Later
        // project changes still close City and never reopen it from the URL.
        if (!isDemoPagePending()) routeEntryPending = false;
        hide();
      }
    });
    enterRoute();
    return () => {
      unsub();
      window.removeEventListener('ppw:open-city', show);
      window.removeEventListener(DEMO_PAGE_READY_EVENT, enterRoute);
      window.removeEventListener('olb:close-workspaces', closeTutorial);
      others.forEach((e) => window.removeEventListener(e, close));
      finishWorkspaceNavigation('city');
    };
  }, []);
  return open
    ? createPortal(
        <CityWorkbench initialTab={initialTab}
          onClose={() => {
            finishWorkspaceNavigation('city');
            setOpen(false);
          }}
        />,
        document.body,
      )
    : null;
}

export function CityNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 0.1,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => boolean | void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { t, tx } = useAppPreferences();
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);
  return (
    <label className="city-field">
      <span>{tx(label)}</span>
      <input
        aria-label={tx(label)}
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={value == null ? t("Unconfirmed") : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft.trim() && Number.isFinite(n) && n >= min && n <= max) {
            if (n !== value && onChange(n) === false) setDraft(value == null ? '' : String(value));
          } else setDraft(value == null ? '' : String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  const { tx } = useAppPreferences();
  return (
    <div className="city-metric">
      <span>{tx(label)}</span>
      <strong>{value}</strong>
      {note && <small>{tx(note)}</small>}
    </div>
  );
}

function CityWorkbench({ onClose, initialTab = 'plan' }: { onClose: () => void; initialTab?: 'plan' | 'orders' }) {
  const { t, tx, formatNumber } = useAppPreferences();
  const fmt = (n: number | null | undefined, digits = 2) => n == null ? t('Review needed') : formatNumber(n, { maximumFractionDigits: digits });
  const property = usePropertyStore((s) => s.property),
    model = useMemo(() => property.city ?? emptyCity(), [property.city]);
  const estimate = useMemo(() => estimateCity(model), [model]);
  const host = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'plan' | 'suppliers' | 'data' | 'orders' | 'overview'>(initialTab);
  const [view, setView] = useState<'2d' | '3d'>('2d'),
    [tool, setTool] = useState('select'),
    [draft, setDraft] = useState<CityPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [fitNonce, setFitNonce] = useState(0),
    [utilities, setUtilities] = useState(true),
    [message, setMessage] = useState('');
  const [roadPreset, setRoadPreset] = useState<string>(CITY_ROAD_PRESETS[0].id),
    [system, setSystem] = useState<CityNetworkSystem>('water');
  const [assetKind, setAssetKind] = useState<CityAssetKind>('solar-light'),
    [filter, setFilter] = useState('all');
  const [ordersDirty, setOrdersDirty] = useState(false);
  useEffect(() => {
    if (!ordersDirty) setMessage((current) => (current === UNSAVED_ORDER_MESSAGE ? '' : current));
  }, [ordersDirty]);
  useEffect(() => {
    const guard = (event: Event) => { if (ordersDirty) { event.preventDefault(); setMessage(UNSAVED_ORDER_MESSAGE); } };
    window.addEventListener('olb:before-workspace-switch', guard);
    return () => window.removeEventListener('olb:before-workspace-switch', guard);
  }, [ordersDirty]);
  const demo = isPriceFreeDemoPath(location.pathname);
  const road = model.roads.find((x) => x.id === selectedId),
    network = model.networks.find((x) => x.id === selectedId),
    asset = model.assets.find((x) => x.id === selectedId);
  const selected = road ?? network ?? asset;
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  function preserveOrderEdits() {
    if (!ordersDirty) return false;
    setMessage(UNSAVED_ORDER_MESSAGE);
    return true;
  }
  function requestClose() {
    if (!preserveOrderEdits()) onClose();
  }
  useWorkspaceFocus(host, () => {
    if (preserveOrderEdits()) return;
    if (tool !== 'select' || draft.length || selectedId) {
      setTool('select');
      setDraft([]);
      setSelectedId(null);
    } else requestClose();
  });
  function save(next: CityModel) {
    const ok = usePropertyStore.getState().setCity(next);
    if (!ok) {
      setMessage(
        'These values exceed the model limits or do not form valid geometry. Your last valid design is kept.',
      );
      return false;
    }
    useHistoryStore.getState().flush();
    setMessage('');
    return true;
  }
  function updateSelected(changes: object) {
    return save({
      ...model,
      roads: model.roads.map((r) => (r.id === selectedId ? { ...r, ...changes } : r)),
      networks: model.networks.map((r) => (r.id === selectedId ? { ...r, ...changes } : r)),
      assets: model.assets.map((r) => (r.id === selectedId ? { ...r, ...changes } : r)),
    });
  }
  function remove() {
    if (!selectedId) return;
    save({
      ...model,
      roads: model.roads.filter((x) => x.id !== selectedId),
      networks: model.networks.filter((x) => x.id !== selectedId),
      assets: model.assets.filter((x) => x.id !== selectedId),
    });
    setSelectedId(null);
  }
  function changeTool(next: string) {
    setTool(next);
    setDraft([]);
    setSelectedId(null);
    if (next !== 'select') setView('2d');
  }
  function addPoint(p: CityPoint) {
    if (tool === 'road' || tool === 'network') {
      if (
        draft.length &&
        Math.hypot(p.x - draft[draft.length - 1].x, p.y - draft[draft.length - 1].y) < 0.1
      )
        return;
      setDraft([...draft, p]);
      return;
    }
    if (tool !== 'asset') return;
    const [widthM, lengthM, heightM] = sizes[assetKind],
      id = nanoid(10);
    const entry: CityAsset = {
      id,
      name: CITY_ASSET_KINDS.find((k) => k.id === assetKind)!.label,
      kind: assetKind,
      x: p.x,
      y: p.y,
      widthM,
      lengthM,
      heightM,
      rotation: 0,
    };
    if (
      save({
        ...model,
        assets: [...model.assets, entry],
        ...(assetKind === 'data-centre' && !model.dataCentre ? { dataCentre: DATA_CENTRE } : {}),
      })
    ) {
      setSelectedId(id);
      setTool('select');
    }
  }
  function finishRoute() {
    if (draft.length < 2) return;
    const id = nanoid(10);
    const preset = CITY_ROAD_PRESETS.find((x) => x.id === roadPreset)!;
    const next =
      tool === 'road'
        ? {
            ...model,
            roads: [
              ...model.roads,
              {
                id,
                name: 'Road corridor',
                presetId: preset.id,
                points: draft,
                widthM: preset.widthM,
                surfaceDepthM: preset.surfaceDepthM,
                baseDepthM: preset.baseDepthM,
              },
            ],
          }
        : {
            ...model,
            networks: [
              ...model.networks,
              {
                id,
                name: CITY_NETWORK_SYSTEMS.find((s) => s.id === system)!.label,
                system,
                points: draft.map((p) => ({ ...p, z: -1 })),
                diameterMm: 100,
                trenchWidthM: 0.6,
                trenchDepthM: 1.2,
              },
            ],
          };
    if (save(next)) {
      setDraft([]);
      setTool('select');
      setSelectedId(id);
    }
  }
  function trySample() {
    if (model.assets.length || model.roads.length || model.networks.length || model.dataCentre)
      return;
    // Sample envelopes are independent of the user's detailed house.
    const example = sampleCity();
    example.assets = example.assets.map((a) => {
      const copy = { ...a };
      delete copy.buildingLink;
      return copy;
    });
    save(example);
    setFitNonce((n) => n + 1);
    setMessage(
      'Illustrative district loaded. Road sections, capacity and equipment envelopes need project specifications. Your detailed building was kept.',
    );
  }
  function addPackage(referenceId?: string) {
    try {
      const ref = CITY_SUPPLIER_REFERENCES.find((x) => x.id === referenceId);
      const projectId = demo ? `demo:${property.id}`.slice(0, 100) : property.id;
      const store = useCityProcurementStore.getState();
      store.ensurePlan(projectId, demo ? 'City demonstration' : property.name);
      const pkg = createCityProcurementPackage(
        demo ? 'Supplier to confirm' : (ref?.supplier ?? 'Supplier to confirm'),
        ref?.category ?? 'Infrastructure',
      );
      const fromSelection = tab === 'plan';
      pkg.lines = [
        {
          id: nanoid(12),
          productRef:
            ref?.id ?? (fromSelection ? selected?.id : undefined) ?? 'project-specification',
          description: demo
            ? 'Infrastructure specification'
            : (ref?.name ??
              (fromSelection ? selected?.name : undefined) ??
              'Equipment specification'),
          quantity:
            fromSelection && network
              ? (estimate.networks.find((n) => n.id === network.id)?.lengthM ?? 1)
              : fromSelection && road
                ? (estimate.roads.find((r) => r.id === road.id)?.footprintM2 ?? 1)
                : 1,
          unit: fromSelection && network ? 'm' : fromSelection && road ? 'm2' : 'each',
        },
      ];
      pkg.notes =
        fromSelection && road
          ? 'Gross individual corridor area. Allocate intersections against the net city total before ordering; do not sum individual roads blindly.'
          : 'Confirm the product unit, specification and final measured quantity with the supplier.';
      store.upsertPackage(projectId, pkg);
      setTab('orders');
      setMessage(
        'Supplier draft prepared. Confirm quantity, dates and recipients before review. Nothing has been sent.',
      );
    } catch {
      setMessage(
        'The supplier draft could not be added. Check the project details or remove unused packages if this plan has reached its limit. Your existing schedule is kept.',
      );
    }
  }
  const data = model.dataCentre ?? DATA_CENTRE;
  const dataChange = (key: keyof CityDataCentre, value: number) =>
    save({ ...model, dataCentre: { ...data, [key]: value } });
  const e = estimate.dataCentre;
  const source = selected?.supplierRef
    ? CITY_SUPPLIER_REFERENCES.find((x) => x.id === selected.supplierRef)
    : undefined;
  function linkBuilding() {
    const points = property.rooms
      .filter((r) => r.kind !== 'outdoor' && r.kind !== 'roof')
      .flatMap((r) => r.polygon);
    if (points.length < 3) {
      setMessage(
        'Draw your building with the existing tools first, then link its measured envelope here.',
      );
      return;
    }
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y),
      minX = Math.min(...xs),
      minY = Math.min(...ys),
      maxX = Math.max(...xs),
      maxY = Math.max(...ys);
    const levels = buildingLevels(property),
      heightM = Math.max(1, ...levels.map((l) => l.elevationM + l.heightM));
    const previous = model.assets.find((a) => a.buildingLink === 'current');
    const id = previous?.id ?? nanoid(10);
    const linked: CityAsset = {
      ...previous,
      id,
      name: previous?.name ?? 'Detailed building · envelope',
      kind: 'building',
      buildingLink: 'current',
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      widthM: maxX - minX,
      lengthM: maxY - minY,
      heightM,
      rotation: 0,
    };
    if (save({ ...model, assets: [...model.assets.filter((a) => a.id !== id), linked] })) {
      setSelectedId(id);
      setMessage(
        'Building envelope snapshot refreshed. Refresh again after changing the building. City envelope edits do not change the building; interiors and roof projections stay in the building tools.',
      );
    }
  }
  return (
    <div
      ref={host}
      className="city-workspace"
      role="dialog"
      aria-modal="true"
      aria-label={t("City Build workspace")}
      data-testid="city-workspace"
    >
      <header className="city-header">
        <div className="city-brand">
          <StudioIcon name="city" size={30} />
          <div>
            <strong>{t("City Build")}</strong>
            <span>{t("Measured planning · Mauritius")}</span>
          </div>
        </div>
        <LocaleThemeControls />
        <button type="button" onClick={requestClose} className="city-action">
          <StudioIcon name="room" size={18} />
          {t("Back to building")}</button>
      </header>
      <nav className="city-tabs" aria-label={t("City sections")}>
        {(
          [
            ['plan', 'Plan', 'plot'],
            ['suppliers', 'Infrastructure', 'garden'],
            ['data', 'Data centre', 'bolt'],
            ['orders', 'Orders', 'cart'],
            ['overview', 'Overview', 'list'],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              if (key !== 'orders' && preserveOrderEdits()) return;
              setTab(key);
              setTool('select');
              setDraft([]);
            }}
          >
            <StudioIcon name={icon} size={18} />
            <span>{tx(label)}</span>
          </button>
        ))}
      </nav>
      {message && (
        <div className="city-message" role="status">
          {tx(message)}
          <button type="button" aria-label={t("Dismiss city message")} onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
      <div className="city-plan-panel" hidden={tab !== 'plan'}>
        <div className="city-tools">
          <div className="city-segment">
            <button aria-pressed={view === '2d'} onClick={() => setView('2d')}>
              2D
            </button>
            <button
              aria-pressed={view === '3d'}
              onClick={() => {
                setView('3d');
                setTool('select');
                setDraft([]);
              }}
            >
              3D
            </button>
          </div>
          <button
            className="city-tool-select"
            aria-pressed={tool === 'select'}
            onClick={() => changeTool('select')}
          >
            <StudioIcon name="cursor" size={17} />
            {t("Select / pan")}</button>
          <button
            className="city-tool-road"
            aria-pressed={tool === 'road'}
            onClick={() => changeTool('road')}
          >
            {t("Draw road")}</button>
          <button
            className="city-tool-network"
            aria-pressed={tool === 'network'}
            onClick={() => changeTool('network')}
          >
            {t("Draw utility")}</button>
          <button
            className="city-tool-asset"
            aria-pressed={tool === 'asset'}
            onClick={() => changeTool('asset')}
          >
            {t("Place equipment")}</button>
          <button
            className="city-tool-fit"
            aria-label={t("Fit city")}
            onClick={() => setFitNonce((n) => n + 1)}
          >
            <StudioIcon name="fit" size={18} />
            {t("Fit")}</button>
          <button
            className="city-tool-undo"
            disabled={!canUndo}
            onClick={() => {
              useHistoryStore.getState().undo();
              setSelectedId(null);
            }}
          >
            {t("Undo")}</button>
        </div>
        <div className="city-design">
          <div className="city-viewport">
            {view === '2d' ? (
              <CityPlanView
                model={model}
                tool={tool}
                draft={draft}
                selectedId={selectedId}
                onPoint={addPoint}
                onSelect={setSelectedId}
                fitNonce={fitNonce}
                showUtilities={utilities}
              />
            ) : (
              <Suspense fallback={<div className="city-loading">{t("Building your city in 3D…")}</div>}>
                <CityThreeView
                  model={model}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  fitNonce={fitNonce}
                  showUtilities={utilities}
                />
              </Suspense>
            )}
            {view === '2d' && (
              <div className="city-map-caption">
                {tool === 'road' || tool === 'network'
                  ? 'Tap corners, then Finish route. Snap 0.5 m.'
                  : tool === 'asset'
                    ? 'Tap the site to place a measured planning envelope.'
                    : 'Drag to pan · pinch / wheel to zoom · select for details'}
              </div>
            )}
          </div>
          <aside className="city-inspector" aria-label={t("City design details")}>
            {tool === 'road' && (
              <section className="city-card">
                <h2>{t("Road section")}</h2>
                <label>
                  {t("Planning template")}<select
                    aria-label={t("Road planning template")}
                    value={roadPreset}
                    onChange={(ev) => setRoadPreset(ev.target.value)}
                  >
                    {CITY_ROAD_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {tx(p.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="city-note">
                  {t("Editable dimensions, not an approved road design. Set layers after drawing.")}</p>
              </section>
            )}
            {tool === 'network' && (
              <section className="city-card">
                <h2>{t("Utility corridor")}</h2>
                <label>
                  {t("System")}<select
                    aria-label={t("Utility system")}
                    value={system}
                    onChange={(ev) => setSystem(ev.target.value as CityNetworkSystem)}
                  >
                    {CITY_NETWORK_SYSTEMS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {tx(s.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="city-note">
                  A sample trench and depth are proposed. Set surveyed elevations and specified
                  diameters after drawing.
                </p>
              </section>
            )}
            {(tool === 'road' || tool === 'network') && (
              <div className="city-inline">
                <button className="city-primary" disabled={draft.length < 2} onClick={finishRoute}>
                  {t("Finish route")}</button>
                <button onClick={() => changeTool('select')}>{t("Cancel drawing")}</button>
              </div>
            )}
            {tool === 'asset' && (
              <section className="city-card">
                <h2>{t("Equipment")}</h2>
                <label>
                  {t("Asset type")}<select
                    aria-label={t("City asset type")}
                    value={assetKind}
                    onChange={(ev) => setAssetKind(ev.target.value as CityAssetKind)}
                  >
                    {CITY_ASSET_KINDS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {tx(a.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="city-note">
                  {t("Start with a planning envelope; enter supplier dimensions and ratings in Details.")}</p>
              </section>
            )}
            {selected && (
              <section className="city-card">
                <div className="city-section-title">
                  <h2>{t("Details")}</h2>
                  <button aria-label={t("Deselect city item")} onClick={() => setSelectedId(null)}>
                    ×
                  </button>
                </div>
                {asset?.buildingLink === 'current' && (
                  <p className="city-note">
                    Building envelope snapshot. Changes here affect only the city envelope. Refresh
                    after editing the detailed building; roof projections are excluded.
                  </p>
                )}
                <label>
                  Name
                  <input
                    aria-label={t("City item name")}
                    key={selected.id + selected.name}
                    defaultValue={selected.name}
                    maxLength={128}
                    onBlur={(ev) => updateSelected({ name: ev.target.value })}
                  />
                </label>
                <div className="city-fields">
                  {asset && (
                    <>
                      <CityNumber
                        label="X (m)"
                        value={asset.x}
                        min={-10000}
                        onChange={(x) => updateSelected({ x })}
                      />
                      <CityNumber
                        label="Y (m)"
                        value={asset.y}
                        min={-10000}
                        onChange={(y) => updateSelected({ y })}
                      />
                      <CityNumber
                        label={t("Width (m)")}
                        value={asset.widthM}
                        min={0.05}
                        onChange={(widthM) => updateSelected({ widthM })}
                      />
                      <CityNumber
                        label={t("Length (m)")}
                        value={asset.lengthM}
                        min={0.05}
                        onChange={(lengthM) => updateSelected({ lengthM })}
                      />
                      <CityNumber
                        label={t("Height (m)")}
                        value={asset.heightM}
                        min={0.01}
                        onChange={(heightM) => updateSelected({ heightM })}
                      />
                      <CityNumber
                        label={t("Rotation (°)")}
                        value={asset.rotation}
                        max={360}
                        step={15}
                        onChange={(rotation) => updateSelected({ rotation })}
                      />
                      {['solar-light', 'ev-charger', 'building', 'data-centre'].includes(
                        asset.kind,
                      ) && (
                        <>
                          <CityNumber
                            label={t("Rated load (W)")}
                            value={asset.powerW}
                            max={100000000}
                            onChange={(powerW) => updateSelected({ powerW })}
                          />
                          <CityNumber
                            label={t("Operating hours / day")}
                            value={asset.hoursPerDay}
                            max={24}
                            onChange={(hoursPerDay) => updateSelected({ hoursPerDay })}
                          />
                        </>
                      )}
                      {asset.kind === 'pv-array' && (
                        <CityNumber
                          label={t("Array capacity (kWp)")}
                          value={asset.solarKWp}
                          max={1000000}
                          onChange={(solarKWp) => updateSelected({ solarKWp })}
                        />
                      )}
                      {asset.kind === 'battery' && (
                        <CityNumber
                          label={t("Storage capacity (kWh)")}
                          value={asset.batteryKWh}
                          max={100000000}
                          onChange={(batteryKWh) => updateSelected({ batteryKWh })}
                        />
                      )}
                      {asset.kind === 'water-tank' && (
                        <CityNumber
                          label={t("Tank capacity (L)")}
                          value={asset.tankCapacityL}
                          max={100000000}
                          onChange={(tankCapacityL) => updateSelected({ tankCapacityL })}
                        />
                      )}
                    </>
                  )}
                  {road && (
                    <>
                      <CityNumber
                        label={t("Road width (m)")}
                        value={road.widthM}
                        min={0.5}
                        max={100}
                        onChange={(widthM) => updateSelected({ widthM })}
                      />
                      <CityNumber
                        label={t("Surface depth (m)")}
                        value={road.surfaceDepthM}
                        min={0.001}
                        max={2}
                        step={0.01}
                        onChange={(surfaceDepthM) => updateSelected({ surfaceDepthM })}
                      />
                      <CityNumber
                        label={t("Base depth (m)")}
                        value={road.baseDepthM}
                        max={5}
                        step={0.01}
                        onChange={(baseDepthM) => updateSelected({ baseDepthM })}
                      />
                    </>
                  )}
                  {network && (
                    <>
                      <CityNumber
                        label={t("Outside diameter (mm)")}
                        value={network.diameterMm}
                        min={1}
                        max={5000}
                        step={1}
                        onChange={(diameterMm) => updateSelected({ diameterMm })}
                      />
                      <CityNumber
                        label={t("Trench width (m)")}
                        value={network.trenchWidthM}
                        min={0.05}
                        max={20}
                        onChange={(trenchWidthM) => updateSelected({ trenchWidthM })}
                      />
                      <CityNumber
                        label={t("Trench depth (m)")}
                        value={network.trenchDepthM}
                        min={0.05}
                        max={30}
                        onChange={(trenchDepthM) => updateSelected({ trenchDepthM })}
                      />
                    </>
                  )}
                </div>
                {(road || network) && (
                  <details>
                    <summary>{t("Route coordinates & elevations")}</summary>
                    <div className="city-route-points">
                      {(road?.points ?? network!.points).map((p, i) => (
                        <div key={i} className="city-fields">
                          <CityNumber
                            label={t('pointAxis', { number: i + 1, axis: 'X' })}
                            value={p.x}
                            min={-10000}
                            onChange={(x) =>
                              updateSelected({
                                points: (road?.points ?? network!.points).map((v, j) =>
                                  i === j ? { ...v, x } : v,
                                ),
                              })
                            }
                          />
                          <CityNumber
                            label={t('pointAxis', { number: i + 1, axis: 'Y' })}
                            value={p.y}
                            min={-10000}
                            onChange={(y) =>
                              updateSelected({
                                points: (road?.points ?? network!.points).map((v, j) =>
                                  i === j ? { ...v, y } : v,
                                ),
                              })
                            }
                          />
                          {network && (
                            <CityNumber
                              label={t('pointElevation', { number: i + 1 })}
                              value={network.points[i].z}
                              min={-30}
                              max={100}
                              onChange={(z) =>
                                updateSelected({
                                  points: network.points.map((v, j) => (i === j ? { ...v, z } : v)),
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {source && (
                  <p className="city-note">
                    {demo ? 'Supplier reference linked' : `${source.supplier} · ${source.name}`}.
                    Envelope and suitability require verification.
                  </p>
                )}
                <p className="city-note">
                  Geometry is a planning envelope. Ratings are unconfirmed until entered; an empty
                  source must not be treated as zero load.
                </p>
                <div className="city-inline">
                  <button onClick={() => setTab('suppliers')}>{t("Supplier reference")}</button>
                  <button onClick={() => addPackage(selected.supplierRef)}>Prepare order</button>
                  <button onClick={remove}>{t("Remove item")}</button>
                </div>
              </section>
            )}
            {!selected && tool === 'select' && (
              <section className="city-card">
                <h2>{t("Your site")}</h2>
                <div className="city-fields">
                  <CityNumber
                    label={t("Site width (m)")}
                    value={model.site.widthM}
                    min={1}
                    onChange={(widthM) => save({ ...model, site: { ...model.site, widthM } })}
                  />
                  <CityNumber
                    label={t("Site length (m)")}
                    value={model.site.lengthM}
                    min={1}
                    onChange={(lengthM) => save({ ...model, site: { ...model.site, lengthM } })}
                  />
                </div>
                <p className="city-note">
                  A city overview shares this project's scale. Back to building keeps every floor,
                  furnishing, foundation and finish tool.
                </p>
                {!model.roads.length &&
                  !model.assets.length &&
                  !model.networks.length &&
                  !model.dataCentre && (
                    <button className="city-primary" onClick={trySample}>
                      {t("Try an eco district")}</button>
                  )}
              </section>
            )}
            <div className="city-inline">
              <button onClick={linkBuilding}>{t("Refresh building envelope")}</button>
            </div>
            <label className="city-check">
              <input
                type="checkbox"
                checked={model.enabled}
                onChange={(ev) => save({ ...model, enabled: ev.target.checked })}
              />
              {t("Include city in estimates")}</label>
            <label className="city-check">
              <input
                type="checkbox"
                checked={utilities}
                onChange={(ev) => setUtilities(ev.target.checked)}
              />
              Reveal utility routes
            </label>
            <details className="city-card">
              <summary>{t("Site elements")}</summary>
              <div className="city-element-list">
                {[...model.roads, ...model.networks, ...model.assets].map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={selectedId === item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setTool('select');
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </details>
          </aside>
        </div>
      </div>
      {tab === 'suppliers' && (
        <div className="city-page">
          <div className="city-page-heading">
            <div>
              <h1>{t("Infrastructure, with a source.")}</h1>
              <p>
                Explore Mauritius supplier references. Link a specification to your design, then
                prepare a supplier package.
              </p>
            </div>
            <label>
              {t("Category")}<select
                aria-label={t("Infrastructure category")}
                value={filter}
                onChange={(ev) => setFilter(ev.target.value)}
              >
                <option value="all">{t("All infrastructure")}</option>
                {['roads', 'solar', 'water', 'electrical', 'digital', 'landscape'].map((c) => (
                  <option key={c} value={c}>
                    {tx(c[0].toUpperCase() + c.slice(1))}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="city-note">
            References are quote-only. Stock, prices, site suitability and exact models need
            supplier confirmation. Attaching a reference keeps your measured envelope unchanged.
          </p>
          <div className="city-catalog">
            {CITY_SUPPLIER_REFERENCES.filter((r) => filter === 'all' || filter === r.category).map(
              (r, i) => (
                <article className="city-card" key={r.id}>
                  <span className="city-eyebrow">
                    {tx(r.category[0].toUpperCase() + r.category.slice(1))} · {r.kind === 'family' ? t("Supplier family") : t("Product reference")}
                  </span>
                  <h2>
                    {demo
                      ? `${r.category[0].toUpperCase()}${r.category.slice(1)} option ${i + 1}`
                      : r.name}
                  </h2>
                  {!demo && <strong>{r.supplier}</strong>}
                  <p>
                    {demo
                      ? 'Source-backed planning option. Supplier specifications are available in the full workspace.'
                      : r.description}
                  </p>
                  {r.sustainabilityNote && <p className="city-eco">{r.sustainabilityNote}</p>}
                  <div className="city-inline">
                    {!demo && (
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                        {t("Supplier source ↗")}</a>
                    )}
                    <button
                      disabled={!selected}
                      onClick={() => {
                        updateSelected({ supplierRef: r.id });
                        setMessage(
                          'Reference linked. Verify your envelope against the supplier specification.',
                        );
                        setTab('plan');
                      }}
                    >
                      {t("Link selected item")}</button>
                    <button onClick={() => addPackage(r.id)}>{t("Prepare package")}</button>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      )}
      {tab === 'data' && (
        <div className="city-page">
          <div className="city-page-heading">
            <div>
              <h1>{t("Design the demand. Then the supply.")}</h1>
              <p>
                Data-centre energy scenario. Inputs remain editable and separate from measured
                operation.
              </p>
            </div>
            <button
              className="city-action"
              onClick={() => {
                setTab('plan');
                setAssetKind('data-centre');
                changeTool('asset');
              }}
            >
              {t("Place data centre")}</button>
          </div>
          <div className="city-data-layout">
            <section className="city-card">
              <h2>{t("IT & facility")}</h2>
              <div className="city-fields">
                <CityNumber
                  label={t("Racks")}
                  value={data.racks}
                  min={1}
                  max={100000}
                  step={1}
                  onChange={(n) => dataChange('racks', n)}
                />
                <CityNumber
                  label={t("kW per rack")}
                  value={data.kWPerRack}
                  min={0.1}
                  max={1000}
                  onChange={(n) => dataChange('kWPerRack', n)}
                />
                <CityNumber
                  label={t("IT utilisation (%)")}
                  value={data.utilisation * 100}
                  max={100}
                  onChange={(n) => dataChange('utilisation', n / 100)}
                />
                <CityNumber
                  label={t("PUE target")}
                  value={data.pue}
                  min={1}
                  max={5}
                  step={0.05}
                  onChange={(n) => dataChange('pue', n)}
                />
                <CityNumber
                  label={t("Operating hours / year")}
                  value={data.annualHours}
                  max={8784}
                  step={1}
                  onChange={(n) => dataChange('annualHours', n)}
                />
              </div>
              <h2>{t("Renewables & storage")}</h2>
              <div className="city-fields">
                <CityNumber
                  label={t("Dedicated PV (kWp)")}
                  value={data.pvKWp}
                  max={10000000}
                  onChange={(n) => dataChange('pvKWp', n)}
                />
                <CityNumber
                  label={t("PV yield (kWh/kWp/year)")}
                  value={data.yieldKWhPerKWp}
                  max={4000}
                  onChange={(n) => dataChange('yieldKWhPerKWp', n)}
                />
                <CityNumber
                  label={t("Dedicated battery (kWh)")}
                  value={data.batteryKWh}
                  max={100000000}
                  onChange={(n) => dataChange('batteryKWh', n)}
                />
                <CityNumber
                  label={t("Usable battery (%)")}
                  value={data.batteryUsableFraction * 100}
                  max={100}
                  onChange={(n) => dataChange('batteryUsableFraction', n / 100)}
                />
              </div>
              <label className="city-check">
                <input
                  type="checkbox"
                  checked={data.wueLPerKWh !== undefined}
                  onChange={(ev) => {
                    const next = { ...data };
                    if (ev.target.checked) next.wueLPerKWh = 0;
                    else delete next.wueLPerKWh;
                    save({ ...model, dataCentre: next });
                  }}
                />
                {t("Include specified water-use intensity")}</label>
              {data.wueLPerKWh !== undefined && (
                <CityNumber
                  label={t("WUE (L per IT kWh)")}
                  value={data.wueLPerKWh}
                  max={100}
                  onChange={(n) => dataChange('wueLPerKWh', n)}
                />
              )}
              <button onClick={() => save({ ...model, dataCentre: data })}>{t("Save scenario")}</button>
              <p className="city-note">
                PV and batteries here are allocated to this scenario, not added again to the city's
                installed asset totals. Zero yield means unconfirmed generation.
              </p>
            </section>
            <section>
              <div className="city-metrics">
                <Metric
                  label={t("Modelled facility load")}
                  value={e ? `${fmt(e.averageFacilityKW)} kW` : 'Save scenario'}
                />
                <Metric
                  label={t("Annual facility energy")}
                  value={e ? `${fmt(e.annualFacilityKWh / 1000)} MWh` : '—'}
                />
                <Metric
                  label={t("Annual PV generation")}
                  value={e ? `${fmt(e.annualSolarKWh / 1000)} MWh` : '—'}
                />
                <Metric
                  label="PUE"
                  value={e ? fmt(data.pue) : '—'}
                  note="Total facility / IT energy"
                />
                <Metric
                  label={t("Battery autonomy estimate")}
                  value={e ? `${fmt(e.batteryAutonomyHours)} hours` : '—'}
                  note="Before losses and reserve requirements"
                />
                <Metric
                  label={t("Water-use scenario")}
                  value={
                    e?.annualWaterL != null
                      ? `${fmt(e.annualWaterL / 1000)} m³/year`
                      : 'Not specified'
                  }
                />
              </div>
              <section className="city-card">
                <h2>{t("Coordinate the full facility")}</h2>
                <p>
                  Use building tools for structure, foundations, openings and finishes. Use utility
                  corridors for water, drainage, power and fibre. Link racks, cooling, UPS, PDUs and
                  firestop references in Infrastructure.
                </p>
                <div className="city-inline">
                  <button
                    onClick={() => {
                      setFilter('digital');
                      setTab('suppliers');
                    }}
                  >
                    {t("Data-centre equipment")}</button>
                  <button onClick={requestClose}>{t("Detailed building tools")}</button>
                </div>
                <p className="city-note">
                  PUE does not subtract solar production. Annual renewable balance does not prove
                  hourly autonomy. Capacity, resilience, cooling, fire strategy and grid connection
                  require engineering review.
                </p>
              </section>
            </section>
          </div>
        </div>
      )}
      {tab === 'orders' && (
        <div className="city-page">
          <CityOrdersPanel
            projectId={property.id}
            projectName={property.name}
            onDirtyChange={setOrdersDirty}
          />
        </div>
      )}
      {tab === 'overview' && (
        <div className="city-page">
          <div className="city-page-heading">
            <div>
              <h1>{t("A clear view of the whole build.")}</h1>
              <p>
                Quantity overview from your current site geometry. Engineering review remains
                separate.
              </p>
            </div>
            <button onClick={() => setTab('orders')} className="city-action">
              {t("Manage supplier schedules")}</button>
          </div>
          <div className="city-metrics">
            <Metric label={t("Site area")} value={`${fmt(estimate.siteAreaM2 / 10000)} ha`} />
            <Metric
              label={t("Road corridor area")}
              value={`${fmt(estimate.roadAreaM2)} m²`}
              note="Intersections counted once"
            />
            <Metric
              label={t("Road surface")}
              value={
                estimate.roadSurfaceM3 == null
                  ? 'Review layers'
                  : `${fmt(estimate.roadSurfaceM3)} m³`
              }
            />
            <Metric
              label={t("Road base")}
              value={
                estimate.roadBaseM3 == null ? 'Review layers' : `${fmt(estimate.roadBaseM3)} m³`
              }
            />
            <Metric
              label={t("Trench excavation")}
              value={
                estimate.trenchUniqueVolumeM3 == null
                  ? 'Review trenches'
                  : `${fmt(estimate.trenchUniqueVolumeM3)} m³`
              }
            />
            <Metric
              label={t("Building footprints")}
              value={`${fmt(estimate.footprintM2)} m²`}
              note="Envelope union, not floor area"
            />
            <Metric label={t("Known PV capacity")} value={`${fmt(estimate.solarKWp)} kWp`} />
            <Metric label={t("Known storage")} value={`${fmt(estimate.batteryKWh)} kWh`} />
            <Metric label={t("Known water storage")} value={`${fmt(estimate.tankCapacityL)} L`} />
          </div>
          <div className="city-data-layout">
            <section className="city-card">
              <h2>{t("Utility takeoff")}</h2>
              {CITY_NETWORK_SYSTEMS.map((s) => (
                <div className="city-summary-row" key={s.id}>
                  <span>
                    <i style={{ background: s.colour }} />
                    {tx(s.label)}
                  </span>
                  <strong>{fmt(estimate.networkLengthsM[s.id])} m</strong>
                </div>
              ))}
              <p className="city-note">
                Lengths include changes in elevation. Fittings, joint allowances, cable design and
                certified capacity require a specification.
              </p>
            </section>
            <section className="city-card">
              <h2>{t("Design review")}</h2>
              {estimate.quantityIncompleteReasons.length > 0 && (
                <ul className="city-error">
                  {estimate.quantityIncompleteReasons.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <ul>
                {estimate.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              <p className="city-note">
                Building estimates stay in Materials; this view does not add those quantities again.
                Costs require current supplier quotes. Scheduling a package does not release an
                order.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
