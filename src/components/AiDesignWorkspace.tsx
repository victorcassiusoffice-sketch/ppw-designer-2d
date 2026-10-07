import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createGuidedDesign, validateDesignDraft, type DesignDraft, type DesignBrief, type DesignCatalogProduct } from '../designer/aiDesignContract';
import { designDraftToProperty } from '../designer/aiDesignProperty';
import { getAllProducts } from '../data/products';
import { useCatalogStore } from '../store/catalogStore';
import { useDesignsStore } from '../store/designsStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { useHistoryStore } from '../store/historyStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { applyPage, createPage, flushCurrentPage } from '../lib/pages';
import { downloadJson } from '../lib/downloadJson';
import { useWorkspaceFocus } from '../hooks/useWorkspaceFocus';
import './aiDesign.css';

const ProviderDraft = lazy(() => import('./AiProviderDraft'));
export function AiDesignButton({ onBeforeOpen }: { onBeforeOpen?: () => void }) {
  return <button type="button" className="ai-design-trigger" aria-label="AI design" title="AI design · draft, review and add a house" onClick={() => { onBeforeOpen?.(); window.dispatchEvent(new CustomEvent('ppw:open-ai-design')); }}><span aria-hidden="true">✧</span> AI</button>;
}

/** User-controlled workbench; drafts never replace the current plan implicitly. */
export function AiDesignWorkspace({ onBeforeOpen }: { onBeforeOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const beforeOpen = useRef(onBeforeOpen); beforeOpen.current = onBeforeOpen;
  useEffect(() => {
    const show = () => {
      beforeOpen.current();
      useDesignerUIStore.getState().setTool('hand');
      useDesignerUIStore.getState().setEnergyPanelOpen(false);
      useDesignerUIStore.getState().setMaterialsPanelOpen(false);
      usePlacementIntentStore.getState().setArmed(null);
      window.dispatchEvent(new CustomEvent('ppw:close-house-details'));
      window.dispatchEvent(new CustomEvent('ppw:close-catalog'));
      setOpen(true);
    };
    const close = () => setOpen(false);
    window.addEventListener('ppw:open-ai-design', show);
    window.addEventListener('ppw:open-plan-import', close);
    window.addEventListener('ppw:open-services', close);
    if (new URLSearchParams(window.location.search).get('panel') === 'ai') show();
    return () => {
      window.removeEventListener('ppw:open-ai-design', show);
      window.removeEventListener('ppw:open-plan-import', close);
      window.removeEventListener('ppw:open-services', close);
    };
  }, []);
  return open ? createPortal(<DesignWorkbench onClose={() => setOpen(false)} />, document.body) : null;
}

function DesignWorkbench({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'guided' | 'ai' | 'import' | 'connect'>('guided');
  const [brief, setBrief] = useState<DesignBrief>({ title: 'My home concept', brief: '', plotWidthM: 20, plotDepthM: 24, bedrooms: 3, storeys: 1, wallHeightM: 2.7 });
  const [draft, setDraft] = useState<DesignDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [importText, setImportText] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const [level, setLevel] = useState('ground');
  const [acknowledged, setAcknowledged] = useState(false);
  const importRevision = useRef(0);
  const applying = useRef(false);
  useEffect(() => () => { importRevision.current++; }, []);
  useEffect(() => { importRevision.current++; setReadingFile(false); }, [mode]);
  const products = useCatalogStore(state => state.products);
  const catalog = useMemo<DesignCatalogProduct[]>(() => [...getAllProducts(), ...products].map(p => ({ id:p.id,name:p.name,supplier:p.supplier,category:p.category,widthM:p.dimensions_cm.length/100,depthM:p.dimensions_cm.width/100,heightM:p.dimensions_cm.height/100,placement:p.placement??'floor' })), [products]);
  useWorkspaceFocus(dialog, onClose);
  function receive(input: unknown, label: string) {
    const result = validateDesignDraft(input, catalog);
    setAcknowledged(false);
    if (!result.ok) { setDraft(null); setErrors(result.errors); return; }
    setDraft(result.draft); setWarnings([...new Set(result.warnings)]); setLevel('ground'); setErrors([]); setSource(label);
  }
  function change<K extends keyof DesignBrief>(key: K, value: DesignBrief[K]) { setBrief(current => ({...current,[key]:value})); setDraft(null); setAcknowledged(false); setErrors([]); }
  function generate() { try { receive(createGuidedDesign(brief), 'Guided layout · rule based'); } catch (error) { setDraft(null); setErrors([error instanceof Error ? error.message : 'Check the plot and room inputs.']); } }
  function importDraft() {
    try { if (importText.length > 500_000) throw new Error('Use a draft smaller than 500 KB.'); const data: unknown = JSON.parse(importText); receive(data && typeof data === 'object' && 'draft' in data ? (data as {draft:unknown}).draft : data, 'Imported draft · validated'); }
    catch (error) { setDraft(null); setErrors([error instanceof Error ? error.message : 'Invalid draft JSON.']); }
  }
  function updateImport(text: string) { importRevision.current++; setReadingFile(false); setImportText(text); setDraft(null); setAcknowledged(false); setErrors([]); }
  async function loadDraftFile(file?: File) {
    if (!file) return;
    const revision = ++importRevision.current;
    setDraft(null); setAcknowledged(false); setErrors([]); setImportText(''); setReadingFile(false);
    if (file.size > 500_000) { setErrors(['Use a JSON file smaller than 500 KB.']); return; }
    setReadingFile(true);
    try {
      const text = await file.text();
      if (revision !== importRevision.current) return;
      setImportText(text);
    } catch { if (revision === importRevision.current) setErrors(['This file could not be read. Paste the draft JSON instead.']); }
    finally { if (revision === importRevision.current) setReadingFile(false); }
  }
  function apply() {
    if (!draft || !acknowledged || applying.current) return;
    const result = validateDesignDraft(draft, catalog);
    if (!result.ok) { setErrors(result.errors); return; }
    applying.current = true;
    try {
    const property = designDraftToProperty(result.draft, catalog);
    const page = createPage(property.name || 'House concept');
    applyPage({ property, walls: [], floorZones: [], wallTreatments: {} });
    useDesignsStore.getState().setCurrent(page); flushCurrentPage();
    useHistoryStore.getState().reset();
    useDesignerUIStore.getState().setViewMode('3d');
    onClose();
    } catch (error) { applying.current = false; setErrors([error instanceof Error ? error.message : 'Could not add this draft. Your previous page is preserved.']); }
  }
  const rooms = draft?.rooms.filter(room => room.levelId === level) ?? [];
  const area = draft?.rooms.reduce((sum,room) => sum + room.widthM * room.depthM, 0) ?? 0;
  return <div className="designer-app design-workbench-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="design-workbench" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ai-design-title" data-testid="ai-design-workbench" onKeyDown={event => event.stopPropagation()}>
      <header><div><small>PPW DESIGN ASSISTANT</small><h1 id="ai-design-title">A brief. A measured beginning.</h1></div><button onClick={onClose} aria-label="Close design assistant">Done ×</button></header>
      <nav aria-label="Design assistant methods">{([['guided','Guided layout'],['ai','AI brief'],['import','Import a draft'],['connect','Connect AI']] as const).map(([id,label]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>)}</nav>
      <div className="design-workbench-content"><section className="design-brief">
        {(mode === 'guided' || mode === 'ai') && <>
          <p>{mode === 'guided' ? 'Start from your dimensions. This local layout builder uses explicit inputs; it does not interpret a written brief.' : 'Describe your priorities. The connected AI proposes a layout using the same measured design format.'}</p>
          <label>Plan name<input value={brief.title} maxLength={100} onChange={e => change('title',e.target.value)} /></label>
          <div className="design-input-grid">{([['plotWidthM','Plot width · m',12,100,.5],['plotDepthM','Plot depth · m',14,100,.5],['bedrooms','Bedrooms',1,8,1],['storeys','Storeys',1,3,1],['wallHeightM','Wall height · m',2.4,4,.1]] as const).map(([key,label,min,max,step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} value={brief[key]} onChange={e => change(key, Number(e.target.value))} /></label>)}</div>
          {mode === 'guided' ? <button className="design-primary" onClick={generate}>Create measured draft</button> : <><label>Your design brief<textarea value={brief.brief} maxLength={3000} rows={4} placeholder="A two-bedroom home, open living space, garden access…" onChange={e => change('brief',e.target.value)} /></label><Suspense fallback={<p>Loading secure AI access…</p>}><ProviderDraft brief={brief} onStart={() => { setDraft(null); setAcknowledged(false); setErrors([]); }} onDraft={value => receive(value, 'AI proposal · validated')} onError={message => setErrors([message])} /></Suspense></>}
        </>}
        {mode === 'import' && <><h2>Bring a draft from your AI</h2><p>Paste the versioned proposal returned by the PPW MCP tools. Geometry and product references are checked before it can be added.</p><label>Draft JSON<textarea rows={10} value={importText} maxLength={500_001} onChange={e => updateImport(e.target.value)} spellCheck={false} /></label><label>Or open a JSON file<input type="file" accept=".json,application/json" onChange={e => { void loadDraftFile(e.target.files?.[0]); e.target.value = ''; }} /></label><button className="design-primary" disabled={readingFile || !importText.trim()} onClick={importDraft}>{readingFile ? 'Reading draft…' : 'Validate draft'}</button></>}
        {mode === 'connect' && <><h2>Your AI. This designer.</h2><p>Connect an MCP client that supports Streamable HTTP. It can read the public catalog, build a guided layout and validate a proposal. Your saved plans stay private.</p><label>MCP server address<input readOnly value={`${window.location.origin}/api/mcp`} onFocus={e=>e.target.select()} /></label><ol><li>Add this address in your AI client's MCP connections.</li><li>Ask it to read the design schema and propose a home with your requirements.</li><li>Use <strong>Import a draft</strong> to check the JSON and add it as a new plan.</li></ol><button onClick={()=>downloadJson('ppw-mcp-connection.json',{mcpServers:{'ppw-designer':{type:'http',url:`${window.location.origin}/api/mcp`}}})}>Download connection example</button><p className="design-fine">Client setup varies. These tools prepare design proposals; they do not place orders, edit merchant records or access other people's projects.</p></>}
        {!!errors.length && <div className="design-errors" role="alert"><strong>Check before continuing</strong><ul>{errors.slice(0,10).map((error,i)=><li key={i}>{error}</li>)}</ul></div>}
      </section><section className="design-review" aria-label="Draft review">
        {draft ? <><div className="design-review-heading"><div><small>{source}</small><h2>{draft.title}</h2></div><select aria-label="Preview floor" value={level} onChange={e=>setLevel(e.target.value)}>{draft.levels.map(floor=><option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></div>
          <svg className="design-draft-map" viewBox={`-1 -1 ${draft.plot.widthM+2} ${draft.plot.depthM+2}`} role="img" aria-label="Measured draft floor plan"><rect width={draft.plot.widthM} height={draft.plot.depthM} fill="#344c3d" rx=".3" />{rooms.map((room,index)=><g key={room.id}><rect x={room.xM} y={room.yM} width={room.widthM} height={room.depthM} fill={index%2?'#f3eddf':'#deded4'} stroke="#526269" strokeWidth=".14" /><text x={room.xM+room.widthM/2} y={room.yM+room.depthM/2} fontSize=".38" textAnchor="middle" fill="#26373b">{room.name.length>24?room.name.slice(0,23)+'…':room.name}</text><text x={room.xM+room.widthM/2} y={room.yM+room.depthM/2+.5} fontSize=".3" textAnchor="middle" fill="#536164">{room.widthM} × {room.depthM} m</text></g>)}</svg>
          <div className="design-review-facts"><span><strong>{draft.levels.length}</strong> storeys</span><span><strong>{draft.rooms.length}</strong> spaces</span><span><strong>{area.toFixed(1)} m²</strong> floor area</span></div><p>{draft.summary}</p>
          <details><summary>Assumptions & professional review</summary><ul>{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>
          <label className="design-ack"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} />I have reviewed this concept. Structure, services and local approvals still need professional design.</label>
          <div className="design-review-actions"><button className="design-primary" disabled={!acknowledged} onClick={apply}>Add as a new plan</button><button onClick={()=>downloadJson('ppw-design-draft.json',draft)}>Export draft</button></div><small>Your current plan is preserved as a separate page. Continue editing the new design in 2D or 3D.</small>
        </> : <div className="design-review-empty"><span aria-hidden="true">⌂</span><h2>Review before you build.</h2><p>Your rooms, access, storeys, roof and garden appear here before anything changes on the canvas.</p><div><span>1 · Draft</span><span>2 · Check</span><span>3 · Edit in 3D</span></div></div>}
      </section></div>
    </div>
  </div>;
}


