import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nanoid } from 'nanoid';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useShadeEditorStore } from '../store/shadeEditorStore';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import { DEMO_PAGE_READY_EVENT, isDemoPagePending } from '../demo/useDemoMode';
import { beginWorkspaceNavigation, cancelWorkspaceNavigation, finishWorkspaceNavigation } from '../designer/workspaceNavigation';
import { isShowcaseReadOnly } from '../lib/showcaseSafety';
import { GROUND_LEVEL_ID } from '../designer/levels';
import { placeShadeSail } from '../designer/shadePlacement';
import {
  SHADE_COLOURS, SHADE_FABRICS, SHADE_MAX_ANCHORS, SHADE_MIN_ANCHORS, SHADE_SAIL_LIMIT, defaultShadeSail, estimateShadeSail,
  type ShadeAnchor, type ShadeFitStatus, type ShadeSail,
} from '../designer/shade';
import './shadeWorkspace.css';

const fmt = (value: number, digits = 2) => value.toLocaleString('en-GB', { maximumFractionDigits: digits });
const FIT_LABEL: Record<ShadeFitStatus, string> = { 'made-to-points': 'made to these points', fits: 'fits', slack: 'hangs slack', 'over-stretch': 'cannot be tensioned' };

export function ShadeLaunchButton({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  return (
    <button type="button" className="shade-launch" aria-label="Shade sails" onClick={() => { onBeforeOpen?.(); window.dispatchEvent(new Event('ppw:open-shade')); }}>
      <span aria-hidden="true">◭</span> Shade sails
    </button>
  );
}

/** Opens on ppw:open-shade or ?panel=shade; closes when another workspace opens or the design changes. */
export function ShadeWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const before = useRef(onBeforeOpen);
  before.current = onBeforeOpen;
  useEffect(() => {
    let pendingRoute = new URLSearchParams(location.search).get('panel') === 'shade';
    const show = (event?: Event) => {
      pendingRoute = false;
      beginWorkspaceNavigation('shade');
      before.current();
      const ui = useDesignerUIStore.getState();
      ui.setTool('hand');
      ui.setMaterialsPanelOpen(false);
      ui.setEnergyPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new Event('ppw:close-house-details'));
      window.dispatchEvent(new Event('ppw:close-catalog'));
      const detail = (event as CustomEvent | undefined)?.detail as { id?: string; anchorId?: string } | undefined;
      if (detail?.id) useShadeEditorStore.getState().select(detail.id, detail.anchorId ?? null);
      setOpen(true);
    };
    const close = (event: Event) => {
      pendingRoute = false;
      if (event.type === 'olb:close-workspaces') finishWorkspaceNavigation('shade');
      else cancelWorkspaceNavigation('shade');
      setOpen(false);
    };
    const unsubscribe = usePropertyStore.subscribe((state, previous) => {
      if (state.property.id === previous.property.id) return;
      if (!isDemoPagePending()) pendingRoute = false;
      cancelWorkspaceNavigation('shade');
      setOpen(false);
    });
    const ready = () => { if (pendingRoute && !isDemoPagePending()) show(); };
    window.addEventListener('ppw:open-shade', show);
    window.addEventListener('ppw:edit-shade', show);
    window.addEventListener(DEMO_PAGE_READY_EVENT, ready);
    const switches = ['ppw:open-services', 'ppw:open-foundation', 'ppw:open-plan-import', 'ppw:open-ai-design', 'ppw:open-city', 'olb:open-project', 'olb:close-workspaces'];
    switches.forEach(name => window.addEventListener(name, close));
    ready();
    return () => {
      unsubscribe();
      finishWorkspaceNavigation('shade');
      window.removeEventListener('ppw:open-shade', show);
      window.removeEventListener('ppw:edit-shade', show);
      window.removeEventListener(DEMO_PAGE_READY_EVENT, ready);
      switches.forEach(name => window.removeEventListener(name, close));
    };
  }, []);
  return open ? createPortal(<ShadePanel onClose={() => { finishWorkspaceNavigation('shade'); setOpen(false); }} />, document.body) : null;
}

function Number_({ label, value, onChange, min, max, step = 0.01, title }: { label: string; value: number; onChange: (value: number) => boolean; min: number; max: number; step?: number; title?: string }) {
  const [invalid, setInvalid] = useState(false);
  return (
    <label title={title}>
      {label}
      <input type="number" value={value} min={min} max={max} step={step} aria-invalid={invalid || undefined}
        onChange={event => { const next = Number(event.target.value); setInvalid(!Number.isFinite(next) || !onChange(next)); }} />
    </label>
  );
}

function ShadePanel({ onClose }: { onClose: () => void }) {
  const host = useRef<HTMLElement>(null);
  useWorkspaceFocus(host, onClose);
  const property = usePropertyStore(s => s.property);
  const store = usePropertyStore.getState;
  const sailId = useShadeEditorStore(s => s.sailId);
  const anchorId = useShadeEditorStore(s => s.anchorId);
  const select = useShadeEditorStore(s => s.select);
  const model = property.shade;
  const sails = model?.sails ?? [];
  const sail = sails.find(s => s.id === sailId) ?? sails[0];
  useEffect(() => { if (sail && sail.id !== sailId) select(sail.id); }, [sail, sailId, select]);
  const report = useMemo(() => sail ? estimateShadeSail(sail) : null, [sail]);
  const showcase = isShowcaseReadOnly();
  const addSail = () => {
    // A sail is outdoor kit: it lands on a terrace, a hard garden surface or in the garden beside the house, never in a room.
    const centre = placeShadeSail({ rooms: property.rooms, site: property.site, garden: property.garden, levelId: GROUND_LEVEL_ID });
    const id = `shade-${nanoid(8)}`;
    if (store().addShadeSail(defaultShadeSail(id, { x: centre.x, y: centre.y }, () => `pt-${nanoid(6)}`))) select(id);
  };
  const updateAnchor = (anchor: ShadeAnchor, patch: Partial<Omit<ShadeAnchor, 'id'>>) => sail ? store().updateShadeAnchor(sail.id, anchor.id, patch) : false;
  const anchors = sail?.anchors ?? [];
  return (
    <aside ref={host} className="shade-panel" role="dialog" aria-modal="false" aria-label="Shade sails" data-testid="shade-panel">
      <header className="shade-header">
        <div>
          <h2>Shade sails</h2>
          <p>Fixing points, heights and the fabric between them. Drag a point on the plan.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close shade sails">Close</button>
      </header>
      <div className="shade-body">
        <div className="shade-list" role="group" aria-label="Sails">
          {sails.map(entry => <button key={entry.id} type="button" aria-pressed={entry.id === sail?.id} onClick={() => select(entry.id)}>{entry.name}</button>)}
          <button type="button" onClick={addSail} disabled={sails.length >= SHADE_SAIL_LIMIT} data-testid="shade-add-sail">+ Add a sail</button>
        </div>
        {!sail && <p className="shade-empty">Add a sail to start: it lands outside the house, on the terrace or in the garden on the sunny north side, four posts at alternating heights. Then drag each fixing point to where a post or a wall bracket can go; set a point to Wall where it meets the house.</p>}
        {sail && report && <>
          <div className="shade-fields">
            <label className="shade-wide">Name<input value={sail.name} maxLength={128} onChange={event => store().updateShadeSail(sail.id, { name: event.target.value || 'Shade sail' })} /></label>
            <label>Fabric
              <select value={sail.fabric} onChange={event => store().updateShadeSail(sail.id, { fabric: event.target.value as ShadeSail['fabric'] })}>
                {SHADE_FABRICS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <Number_ label="Hardware gap per corner (m)" value={sail.cornerGapM} min={0.05} max={1} step={0.05} onChange={value => store().updateShadeSail(sail.id, { cornerGapM: value })} title="Turnbuckle and fittings between the fixing point and the sail corner" />
            <Number_ label="Edge curve (% of chord)" value={sail.edgeCurvePct} min={0} max={15} step={0.5} onChange={value => store().updateShadeSail(sail.id, { edgeCurvePct: value })} />
            <label>Colour
              <div className="shade-swatches" role="group" aria-label="Colour">
                {SHADE_COLOURS.map(c => <button key={c.hex} type="button" aria-label={c.label} aria-pressed={sail.colour === c.hex} style={{ background: c.hex }} onClick={() => store().updateShadeSail(sail.id, { colour: c.hex })} />)}
              </div>
            </label>
            <label className="shade-wide">
              <span><input type="checkbox" checked={!!sail.made} onChange={event => store().updateShadeSail(sail.id, event.target.checked ? { made: { edgesM: report.edges.map(e => e.chordM) } } : { made: undefined })} /> The sail already exists: check it against these points</span>
            </label>
          </div>
          <table className="shade-table" aria-label="Fixing points">
            <thead><tr><th>Point</th><th>x (m)</th><th>y (m)</th><th>Height (m)</th><th>Fixing</th><th></th></tr></thead>
            <tbody>
              {anchors.map((anchor, index) => (
                <tr key={anchor.id} data-selected={anchor.id === anchorId} onClick={() => select(sail.id, anchor.id)}>
                  <td>{index + 1}</td>
                  <td><input type="number" step={0.05} value={anchor.x} aria-label={`Point ${index + 1} x`} onChange={event => updateAnchor(anchor, { x: Number(event.target.value) })} /></td>
                  <td><input type="number" step={0.05} value={anchor.y} aria-label={`Point ${index + 1} y`} onChange={event => updateAnchor(anchor, { y: Number(event.target.value) })} /></td>
                  <td><input type="number" step={0.05} min={0.5} max={12} value={anchor.heightM} aria-label={`Point ${index + 1} height`} onChange={event => updateAnchor(anchor, { heightM: Number(event.target.value) })} /></td>
                  <td><select value={anchor.support} aria-label={`Point ${index + 1} fixing`} onChange={event => updateAnchor(anchor, { support: event.target.value as ShadeAnchor['support'] })}><option value="post">Post</option><option value="wall">Wall</option></select></td>
                  <td><button type="button" className="shade-row-remove" disabled={anchors.length <= SHADE_MIN_ANCHORS} aria-label={`Remove point ${index + 1}`} onClick={() => store().removeShadeAnchor(sail.id, anchor.id)}>−</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="shade-row-actions">
            <button type="button" disabled={anchors.length >= SHADE_MAX_ANCHORS} onClick={() => {
              const last = anchors[anchors.length - 1], first = anchors[0];
              store().addShadeAnchor(sail.id, { id: `pt-${nanoid(6)}`, x: Math.round(((last.x + first.x) / 2) * 100) / 100, y: Math.round(((last.y + first.y) / 2) * 100) / 100, heightM: Math.round(((last.heightM + first.heightM) / 2) * 100) / 100, support: 'post' });
            }}>+ Add a point</button>
            <button type="button" onClick={() => { store().removeShadeSail(sail.id); select(null); }}>Remove this sail</button>
          </div>
          {sail.made && <table className="shade-table" aria-label="Made sail edges">
            <thead><tr><th>Edge</th><th>Made chord (m)</th><th>Needs stretch</th><th>Fit</th></tr></thead>
            <tbody>
              {report.edges.map(edge => (
                <tr key={edge.index}>
                  <td>{edge.index + 1}</td>
                  <td><input type="number" step={0.01} min={0.3} max={60} value={sail.made!.edgesM[edge.index]} aria-label={`Edge ${edge.index + 1} made chord`} onChange={event => { const edgesM = [...sail.made!.edgesM]; edgesM[edge.index] = Number(event.target.value); store().updateShadeSail(sail.id, { made: { edgesM } }); }} /></td>
                  <td>{edge.requiredStretchPct === null ? '—' : `${fmt(edge.requiredStretchPct, 1)} % of ${fmt(report.fabric.workingStretch * 100, 1)} %`}</td>
                  <td><span className="shade-fit" data-fit={edge.fit}>{FIT_LABEL[edge.fit]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>}
          <div className="shade-report" data-testid="shade-report">
            <h3>Sizes</h3>
            <table className="shade-table" aria-label="Edges">
              <thead><tr><th>Edge</th><th>Point to point</th><th>Sail chord</th><th>Curve</th><th>Curved edge</th><th>Stretch room</th></tr></thead>
              <tbody>
                {report.edges.map(edge => <tr key={edge.index}><td>{edge.index + 1}</td><td>{fmt(edge.spanM)} m</td><td>{fmt(edge.chordM)} m</td><td>{fmt(edge.curveDepthM)} m</td><td>{fmt(edge.curvedEdgeM)} m</td><td>{fmt(edge.stretchHeadroomM)} m</td></tr>)}
              </tbody>
            </table>
            <dl className="shade-metrics">
              <div className="shade-metric"><dt>Shape</dt><dd>{report.form === 'hypar' ? 'Twisted (hypar)' : report.form === 'sloped' ? 'Sloped' : 'Flat'}<small>twist {fmt(report.twistM)} m of {fmt(report.twistTargetM)} m wanted</small></dd></div>
              <div className="shade-metric"><dt>Fabric</dt><dd>{fmt(report.finishedAreaM2, 1)} m²<small>cut about {fmt(report.relaxedCutAreaM2, 1)} m² before stretch</small></dd></div>
              <div className="shade-metric"><dt>Covers</dt><dd>{fmt(report.coverageSharePct, 0)} %<small>of the {fmt(report.footprintAreaM2, 1)} m² between the points</small></dd></div>
              <div className="shade-metric"><dt>Noon shade</dt><dd>{fmt(report.shadow.juneNoonOffsetM, 1)} m south in June<small>{fmt(report.shadow.decemberNoonOffsetM, 1)} m north in December</small></dd></div>
              <div className="shade-metric"><dt>Fit</dt><dd><span className="shade-fit" data-fit={report.fit}>{FIT_LABEL[report.fit]}</span><small>{report.fabric.label}: about {fmt(report.fabric.workingStretch * 100, 1)} % working stretch</small></dd></div>
              <div className="shade-metric"><dt>Hardware</dt><dd>{report.hardware.turnbuckles} turnbuckles · {report.hardware.snapHooks} hooks<small>{report.hardware.posts} posts · {report.hardware.wallBrackets} wall brackets · {fmt(report.hardware.wireEdgeM, 1)} m edge wire</small></dd></div>
            </dl>
            <h3>Points</h3>
            <table className="shade-table" aria-label="Corner loads and posts">
              <thead><tr><th>Point</th><th>Angle</th><th>Load</th><th>Post</th><th>Footing</th></tr></thead>
              <tbody>
                {report.corners.map((corner, index) => <tr key={corner.anchorId}><td>{index + 1}</td><td>{fmt(corner.angleDeg, 0)}°</td><td>{fmt(corner.loadKN)} kN</td>
                  <td>{corner.post ? `${corner.post.steel}, ${fmt(corner.post.exposedHeightM)} m, lean ${corner.post.leanDeg}°` : 'wall bracket'}</td>
                  <td>{corner.post ? `${fmt(corner.post.footingDepthM)} m deep · ${fmt(corner.post.footingDiameterM * 1000, 0)} mm` : '—'}</td></tr>)}
              </tbody>
            </table>
            {report.warnings.map(w => <p key={w.id} className="shade-warning" data-level={w.level}>{w.text}<small>{w.basis}</small></p>)}
            <p className="shade-basis">{report.basis}{showcase ? '' : ' Local makers in Mauritius quote from your fixing points, heights and fabric choice; send them this table.'}</p>
          </div>
        </>}
      </div>
    </aside>
  );
}
