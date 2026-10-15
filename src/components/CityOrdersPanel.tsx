import { useAppPreferences } from '../i18n/AppPreferences';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CityProcurementPackageSchema, cityProcurementCsv, createCityProcurementPackage, type CityProcurementLine, type CityProcurementPackage, type CityProcurementUnit } from '../designer/cityProcurement';
import { useCityProcurementStore } from '../store/cityProcurementStore';
import { loadCityProcurement, saveCityProcurement } from '../lib/cityProcurementClient';
import { inspectToken, readActiveMerchantSession, SESSION_STORAGE_KEY } from './RequireMerchant';
import { isShowcaseReadOnly } from '../lib/showcaseSafety';
import { isPriceFreeDemoPath } from '../demo/pitchEmbed';
import { downloadJson } from '../lib/downloadJson';
import './cityOrders.css';

type Draft = Omit<CityProcurementPackage, 'lines'> & { lines: Array<Omit<CityProcurementLine, 'quantity'> & { quantity: string }> };
type View = 'packages' | 'timeline' | 'connection';
const units: CityProcurementUnit[] = ['each', 'm', 'm2', 'm3', 'kg', 'kW', 'kWh'];
const unitLabel = (value: CityProcurementUnit) => value === 'm2' ? 'm²' : value === 'm3' ? 'm³' : value;
const slugIsValid = (value: string) => /^[a-z0-9][a-z0-9-]{0,99}$/.test(value);
const draftOf = (pkg: CityProcurementPackage): Draft => ({ ...pkg, lines: pkg.lines.map(line => ({ ...line, quantity: String(line.quantity) })) });
function currentMerchantSlug(): string {
  try { const value: unknown = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null'); return value && typeof value === 'object' && 'slug' in value && typeof value.slug === 'string' && slugIsValid(value.slug) ? value.slug : ''; } catch { return ''; }
}
function activeSession(slug: string) {
  const session = readActiveMerchantSession(slug); const payload = session && inspectToken(session.token);
  return session && payload?.slug === slug && payload.exp > Date.now() ? session : null;
}
function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Local drafts first. Explicit authenticated saves do not dispatch orders or invoices. */
export function CityOrdersPanel({ projectId, projectName, onDirtyChange }: { projectId: string; projectName: string; onDirtyChange?: (dirty: boolean) => void }) {
  const cleanDemo = typeof window !== 'undefined' && isPriceFreeDemoPath(window.location.pathname);
  // Public demo uses an isolated draft, never the merchant project's private contacts.
  const localProjectId = cleanDemo ? `demo:${projectId}`.slice(0, 100) : projectId;
  return <CityOrdersEditor key={localProjectId} projectId={localProjectId} projectName={cleanDemo ? 'City demo' : projectName} cleanDemo={cleanDemo} onDirtyChange={onDirtyChange} />;
}

function CityOrdersEditor({ projectId, projectName, cleanDemo, onDirtyChange }: { projectId: string; projectName: string; cleanDemo: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const { t, tx, formatDate } = useAppPreferences();
  const dateLabel = (date: string) => formatDate(new Date(`${date}T00:00:00+04:00`), { dateStyle: 'medium' });
  const plan = useCityProcurementStore(state => state.plans[projectId]);
  const cloud = useCityProcurementStore(state => state.cloud[projectId]);
  const ensurePlan = useCityProcurementStore(state => state.ensurePlan);
  const upsertPackage = useCityProcurementStore(state => state.upsertPackage);
  const removePackage = useCityProcurementStore(state => state.removePackage);
  const setPlan = useCityProcurementStore(state => state.setPlan);
  const setCloud = useCityProcurementStore(state => state.setCloud);
  const [view, setView] = useState<View>('packages');
  const [editor, setEditor] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyCallback = useRef(onDirtyChange); dirtyCallback.current = onDirtyChange;
  useEffect(() => { dirtyCallback.current?.(dirty); }, [dirty]);
  useEffect(() => () => { dirtyCallback.current?.(false); }, []);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [includeRecipients, setIncludeRecipients] = useState(false);
  const [slug, setSlug] = useState(() => cleanDemo ? '' : currentMerchantSlug());
  const [, setSessionTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadConfirmed, setLoadConfirmed] = useState(false);
  const [cloudBody, setCloudBody] = useState<string | null>(null);
  const pending = useRef<{ key: string; requestId: string } | null>(null);
  const readOnly = isShowcaseReadOnly();
  const session = slugIsValid(slug) ? activeSession(slug) : null;
  useEffect(() => { ensurePlan(projectId, projectName.trim().slice(0, 200) || 'City project'); }, [ensurePlan, projectId, projectName]);
  useEffect(() => {
    if (!editor && plan?.packages.length) setEditor(draftOf(plan.packages[plan.packages.length - 1]));
  }, [editor, plan]);

  const packageName = (pkg: CityProcurementPackage | Draft, index?: number) => cleanDemo ? t('packageNumber', { number: (index ?? plan?.packages.findIndex(item => item.id === pkg.id) ?? 0) + 1 }) : pkg.supplierName;
  const events = useMemo(() => (plan?.packages ?? []).flatMap((pkg, index) => [
    { date: pkg.orderOn, kind: 'Order target', pkg, index }, { date: pkg.invoiceOn, kind: 'Invoice target', pkg, index }, { date: pkg.deliveryOn, kind: 'Delivery target', pkg, index },
  ]).filter((event): event is typeof event & { date: string } => Boolean(event.date)).sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)), [plan]);

  const choose = (pkg: CityProcurementPackage) => {
    if (dirty) { setNotice('Save this package or discard your changes before switching packages.'); return; }
    setEditor(draftOf(pkg)); setErrors([]); setNotice('');
  };
  const patch = (change: Partial<Draft>) => {
    setEditor(previous => previous ? { ...previous, ...change, state: change.state ?? 'draft' } : null);
    setDirty(true); setErrors([]); setNotice('');
  };
  const editLine = (id: string, change: Partial<Draft['lines'][number]>) => { if (editor) patch({ lines: editor.lines.map(line => line.id === id ? { ...line, ...change } : line) }); };
  const addPackage = () => {
    if (dirty) { setNotice('Save this package or discard your changes before adding another.'); return; }
    if (!plan) return;
    const pkg = createCityProcurementPackage(`Supplier package ${plan.packages.length + 1}`, 'Equipment');
    try { upsertPackage(projectId, pkg); setEditor(draftOf(pkg)); setView('packages'); setErrors([]); setNotice('New draft created on this device. Add equipment and target dates.'); }
    catch (error) { setErrors([error instanceof Error ? error.message : 'The draft could not be created.']); }
  };
  const savePackage = () => {
    if (!editor) return;
    const parsed = CityProcurementPackageSchema.safeParse({ ...editor, lines: editor.lines.map(line => ({ ...line, quantity: line.quantity.trim() === '' ? NaN : Number(line.quantity) })) });
    if (!parsed.success) {
      const labels: Record<string, string> = { supplierName: 'Supplier', category: 'Category', orderOn: 'Order date', invoiceOn: 'Invoice date', deliveryOn: 'Delivery date', recipientEmail: 'Order recipient email', invoiceRecipientEmail: 'Invoice recipient email', lines: 'Equipment' };
      setErrors(parsed.error.issues.slice(0, 8).map(issue => `${labels[String(issue.path[0])] ?? 'Package'}: ${issue.message}`)); return;
    }
    try { upsertPackage(projectId, parsed.data); setEditor(draftOf(parsed.data)); setDirty(false); setErrors([]); setNotice('Package saved on this device. No order, invoice or email has been sent.'); }
    catch { setErrors(['The plan has reached its equipment limit. Remove unused packages or lines before saving.']); }
  };
  const discard = () => {
    const saved = plan?.packages.find(pkg => pkg.id === editor?.id);
    setEditor(saved ? draftOf(saved) : null); setDirty(false); setErrors([]); setNotice('Unsaved changes discarded.');
  };
  const changeView = (next: View) => { setView(next); setNotice(''); };
  const exportPlan = (format: 'csv' | 'json') => {
    if (!plan || dirty) { setNotice('Save the current package before exporting.'); return; }
    const packages = plan.packages.map((pkg, index) => ({ ...pkg,
      supplierName: cleanDemo ? `Supplier package ${index + 1}` : pkg.supplierName,
      lines: cleanDemo ? pkg.lines.map((line, i) => ({ ...line, productRef: '', description: `Equipment ${i + 1}` })) : pkg.lines,
    }));
    const exported = { ...plan, packages };
    if (format === 'csv') downloadCsv('City-Build-draft-schedule.csv', cityProcurementCsv(exported, includeRecipients));
    else downloadJson('City-Build-draft-schedule.json', { ...exported, packages: packages.map(pkg => ({ ...pkg, recipientEmail: includeRecipients ? pkg.recipientEmail : '', invoiceRecipientEmail: includeRecipients ? pkg.invoiceRecipientEmail : '' })), execution: 'manual-review-required', exportNote: 'Planning document only. No order, invoice or email has been sent.' });
    setNotice(`Draft ${format.toUpperCase()} downloaded${includeRecipients ? ' with the chosen recipients' : ' without recipient emails'}.`);
  };
  const secureSave = async () => {
    if (!plan || busy || dirty || readOnly) return;
    const active = activeSession(slug); if (!active) { setNotice('Sign in to the merchant account, then refresh sign-in.'); return; }
    const revision = cloud?.merchantSlug === slug ? cloud.revision : 0;
    const key = JSON.stringify({ slug, plan, revision });
    if (pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() };
    setBusy(true); setErrors([]);
    try {
      const saved = await saveCityProcurement(slug, plan, revision, active.token, pending.current.requestId);
      setCloud(projectId, { merchantSlug: slug, revision: saved.revision, savedAt: saved.updatedAt });
      setCloudBody(JSON.stringify(plan)); pending.current = null;
      setNotice(`Saved securely as revision ${saved.revision}. Execution still requires manual review; nothing has been sent.`);
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Cloud save failed. Your local draft is retained.']); }
    finally { setBusy(false); }
  };
  const secureLoad = async () => {
    if (!plan || busy || dirty || !loadConfirmed || readOnly) return;
    const active = activeSession(slug); if (!active) { setNotice('Sign in to the merchant account, then refresh sign-in.'); return; }
    setBusy(true); setErrors([]);
    try {
      const saved = await loadCityProcurement(slug, plan.id, active.token);
      if (saved.plan.projectId !== projectId) throw new Error('The saved plan belongs to another project. Your local draft was retained.');
      setPlan(saved.plan); setCloud(projectId, { merchantSlug: slug, revision: saved.revision, savedAt: saved.updatedAt });
      setEditor(null); setCloudBody(JSON.stringify(saved.plan)); setLoadConfirmed(false); pending.current = null;
      setNotice(`Loaded secure revision ${saved.revision}. No orders or messages were sent.`);
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Cloud load failed. Your local draft is retained.']); }
    finally { setBusy(false); }
  };

  if (!plan) return <p className="city-note">{t("Preparing your local procurement workspace…")}</p>;
  const synced = cloudBody === JSON.stringify(plan) && !dirty;
  return <section className="city-orders" aria-label={t("City equipment and ordering")}>
    <header className="city-orders-header"><div><p className="city-orders-eyebrow">{t("Equipment & delivery planning")}</p><h3>{t("One schedule. Every supplier.")}</h3><p className="city-note">{t("Choose dates and recipients, review quantities, then prepare your supplier handover.")}</p></div><span className="city-orders-status">{dirty ? t("Unsaved package edits") : synced ? `Cloud revision ${cloud?.revision}` : t("Local draft")}</span></header>
    <div className="city-orders-summary"><span><strong>{plan.packages.length}</strong> {t("packages")}</span><span><strong>{plan.packages.reduce((n, pkg) => n + pkg.lines.length, 0)}</strong> {t("equipment lines")}</span><span><strong>{plan.packages.filter(pkg => pkg.state === 'reviewed').length}</strong> {t("reviewed")}</span></div>
    <nav className="city-orders-tabs" aria-label={t("Procurement views")}>{(['packages', 'timeline', 'connection'] as const).map(item => <button type="button" key={item} aria-pressed={view === item} onClick={() => changeView(item)}>{item === 'packages' ? t("Packages") : item === 'timeline' ? t("Timeline") : t("Connection")}</button>)}</nav>
    {notice && <p role="status" className="city-note city-orders-message">{tx(notice)}</p>}
    {errors.length > 0 && <div className="city-error" role="alert"><strong>{t("Check before saving")}</strong><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div>}

    {view === t("packages") && <div className="city-orders-layout">
      <aside className="city-card city-orders-packages"><div className="city-orders-row"><h4>{t("Supplier packages")}</h4><button type="button" className="city-action" onClick={addPackage} disabled={busy || plan.packages.length >= 100}>{t("+ Add draft")}</button></div>
        {plan.packages.length === 0 ? <p className="city-note">Start with one supplier or work package: roads, water, energy, digital infrastructure or landscaping.</p> : <ul>{plan.packages.map((pkg, i) => <li key={pkg.id}><button type="button" aria-pressed={editor?.id === pkg.id} onClick={() => choose(pkg)} disabled={busy}><strong>{packageName(pkg, i)}</strong><span>{pkg.category} · {pkg.lines.length} lines · {tx(pkg.state === 'reviewed' ? 'Reviewed draft' : 'Draft')}</span><small>{pkg.deliveryOn ? `Delivery target ${dateLabel(pkg.deliveryOn)}` : t("Delivery date not set")}</small></button></li>)}</ul>}
      </aside>
      <article className="city-card city-orders-editor">{!editor ? <div className="city-orders-empty"><span aria-hidden="true">▤</span><h4>{t("Build your equipment schedule")}</h4><p>Select a package or add a draft. Your dates stay editable until your team approves the supplier handover.</p></div> : <>
        <div className="city-orders-row"><h4>{cleanDemo ? packageName(editor) : t("Package details")}</h4><span className="city-orders-status">{editor.state === 'reviewed' ? t("Reviewed draft") : t("Draft")}</span></div>
        <div className="city-fields city-orders-fields"><label>{t("Supplier")}<input aria-label={t("Supplier")} value={cleanDemo ? packageName(editor) : editor.supplierName} readOnly={cleanDemo} maxLength={200} disabled={busy} onChange={event => patch({ supplierName: event.target.value })} /></label><label>{t("Category")}<input aria-label={t("Category")} value={editor.category} maxLength={80} disabled={busy} onChange={event => patch({ category: event.target.value })} /></label></div>
        <fieldset disabled={busy}><legend>{t("Equipment quantities")}</legend>
          {editor.lines.length === 0 && <p className="city-note">Add measured quantities and your supplier’s product reference. Prices and stock must be confirmed separately.</p>}
          <div className="city-orders-lines">{editor.lines.map((line, index) => <div className="city-orders-line" key={line.id}>
            <label className="city-orders-line-description">{t('equipmentNumber', { number: index + 1 })}<input aria-label={t('equipmentDescription', { number: index + 1 })} value={cleanDemo ? `Equipment ${index + 1}` : line.description} readOnly={cleanDemo} maxLength={200} onChange={event => editLine(line.id, { description: event.target.value })} /></label>
            {!cleanDemo && <label>{t("Supplier reference")}<input aria-label={t('equipmentReference', { number: index + 1 })} value={line.productRef} maxLength={200} onChange={event => editLine(line.id, { productRef: event.target.value })} /></label>}
            <label>{t("Quantity")}<input aria-label={t('equipmentQuantity', { number: index + 1 })} type="number" min="0.000001" max="1000000000" step="any" inputMode="decimal" value={line.quantity} onChange={event => editLine(line.id, { quantity: event.target.value })} /></label>
            <label>{t("Unit")}<select aria-label={t('equipmentUnit', { number: index + 1 })} value={line.unit} onChange={event => editLine(line.id, { unit: event.target.value as CityProcurementUnit })}>{units.map(unit => <option value={unit} key={unit}>{unitLabel(unit)}</option>)}</select></label>
            <button type="button" className="city-orders-remove" aria-label={t('equipmentRemove', { number: index + 1 })} onClick={() => patch({ lines: editor.lines.filter(item => item.id !== line.id) })}>×</button>
          </div>)}</div>
          <button type="button" className="city-action" disabled={editor.lines.length >= 200} onClick={() => patch({ lines: [...editor.lines, { id: crypto.randomUUID(), productRef: '', description: cleanDemo ? `Equipment ${editor.lines.length + 1}` : '', quantity: '1', unit: 'each' }] })}>{t("+ Add equipment")}</button>
        </fieldset>
        <fieldset disabled={busy}><legend>{t("Target dates · Mauritius time")}</legend><div className="city-fields city-orders-dates">
          <label>{t("Order date")}<input aria-label={t("Order date")} type="date" value={editor.orderOn ?? ''} onChange={event => patch({ orderOn: event.target.value || null })} /></label>
          <label>{t("Invoice date")}<input aria-label={t("Invoice date")} type="date" value={editor.invoiceOn ?? ''} onChange={event => patch({ invoiceOn: event.target.value || null })} /></label>
          <label>{t("Delivery date")}<input aria-label={t("Delivery date")} type="date" value={editor.deliveryOn ?? ''} min={editor.orderOn ?? undefined} onChange={event => patch({ deliveryOn: event.target.value || null })} /></label>
        </div><p className="city-note">Invoice dates are planning targets. A proforma can precede ordering; a valid invoice requires the configured invoice provider.</p></fieldset>
        <fieldset disabled={busy}><legend>{t("Recipients")}</legend><div className="city-fields city-orders-fields">
          <label>{t("Order recipient email")}<input aria-label={t("Order recipient email")} type="email" autoComplete="off" value={editor.recipientEmail} maxLength={254} placeholder="orders@example.com" onChange={event => patch({ recipientEmail: event.target.value })} /></label>
          <label>{t("Invoice recipient email")}<input aria-label={t("Invoice recipient email")} type="email" autoComplete="off" value={editor.invoiceRecipientEmail} maxLength={254} placeholder="accounts@example.com" onChange={event => patch({ invoiceRecipientEmail: event.target.value })} /></label>
        </div><p className="city-note">{t("Stored only with this procurement draft. Entering an email does not send anything.")}</p></fieldset>
        <label className="city-orders-notes">{t("Handover notes")}<textarea aria-label={t("Handover notes")} rows={2} maxLength={2000} value={editor.notes} disabled={busy} onChange={event => patch({ notes: event.target.value })} /></label>
        <label className="city-orders-check"><input type="checkbox" checked={editor.state === 'reviewed'} disabled={busy} onChange={event => patch({ state: event.target.checked ? 'reviewed' : 'draft' })} /><span>{t("I reviewed quantities, dates and recipients. This remains a draft for supplier approval.")}</span></label>
        <div className="city-orders-editor-actions"><button type="button" className="city-action is-primary" onClick={savePackage} disabled={busy}>{t("Save package")}</button><button type="button" className="city-action" onClick={discard} disabled={!dirty || busy}>{t("Discard edits")}</button><button type="button" className="city-orders-remove-package" disabled={busy || dirty} onClick={() => { removePackage(projectId, editor.id); setEditor(null); setNotice('Package removed from the local draft.'); }}>{t("Remove package")}</button></div>
      </>}</article>
    </div>}

    {view === 'timeline' && <div className="city-card"><div className="city-orders-row"><h4>{t("Delivery & invoice timeline")}</h4><span className="city-orders-status">Indian/Mauritius</span></div><p className="city-note">{t("Target dates only. No automatic ordering or sending is active.")}</p>
      {events.length === 0 ? <p className="city-orders-empty">{t("Set dates in a supplier package to build your timeline.")}</p> : <ol className="city-orders-timeline">{events.map(event => <li key={`${event.pkg.id}:${event.kind}`}><time dateTime={event.date}>{dateLabel(event.date)}</time><div><strong>{tx(event.kind)}</strong><span>{packageName(event.pkg, event.index)} · {event.pkg.category}</span><small>{event.pkg.state === 'reviewed' ? t("Reviewed draft · awaiting supplier approval") : t("Draft · review required")}</small></div><button type="button" onClick={() => { choose(event.pkg); setView('packages'); }}>{t("Edit")}</button></li>)}</ol>}
      {plan.packages.some(pkg => !pkg.orderOn || !pkg.invoiceOn || !pkg.deliveryOn) && <p className="city-note">{plan.packages.filter(pkg => !pkg.orderOn || !pkg.invoiceOn || !pkg.deliveryOn).length} package(s) still need target dates.</p>}
    </div>}

    {view === 'connection' && <div className="city-grid city-orders-connection"><article className="city-card"><h4>{t("Secure merchant storage")}</h4><p className="city-note">Save the draft with your approved merchant account. The supplier connector and invoice provider must be configured before any execution can be enabled.</p>
      {readOnly ? <p className="city-orders-message">{t("Demo mode: explore local schedules and downloads. Cloud writes, orders and email dispatch are disabled.")}</p> : <>
        <label>{t("Merchant identifier")}<input aria-label={t("Merchant identifier")} autoComplete="off" value={slug} maxLength={100} disabled={busy} onChange={event => { setSlug(event.target.value.trim().toLowerCase()); setLoadConfirmed(false); }} placeholder="your-company" /></label>
        <div className="city-orders-row"><span className="city-note">{session ? t("Sign-in found; the server verifies access.") : t("Merchant sign-in required.")}</span><button type="button" className="city-action" disabled={!slugIsValid(slug) || busy} onClick={() => { setSessionTick(value => value + 1); setNotice('Sign-in status refreshed.'); }}>{t("Refresh sign-in")}</button></div>
        {slugIsValid(slug) && <a href={`/merchant/${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer">{t("Open merchant sign-in ↗")}</a>}
        <div className="city-orders-cloud-actions"><button type="button" className="city-action is-primary" disabled={!session || busy || dirty} onClick={() => void secureSave()}>{busy ? t("Working…") : pending.current ? t("Retry secure save") : t("Save draft securely")}</button>
          <label className="city-orders-check"><input type="checkbox" checked={loadConfirmed} disabled={busy || dirty} onChange={event => setLoadConfirmed(event.target.checked)} /><span>{t("Replace this local draft with its saved cloud revision.")}</span></label><button type="button" className="city-action" disabled={!session || busy || dirty || !loadConfirmed} onClick={() => void secureLoad()}>{t("Load saved revision")}</button></div>
      </>}
      {cloud && !cleanDemo && <p className="city-note">Last saved: revision {cloud.revision}. Local changes require a new secure save.</p>}
    </article><article className="city-card"><h4>{t("Before orders are released")}</h4><ul className="city-orders-readiness"><li>Supplier confirms the exact SKU, quantity, quote and availability.</li><li>Your team approves delivery windows and the final recipient list.</li><li>A connected supplier system accepts the order.</li><li>The invoice provider applies the relevant fiscalisation workflow.</li></ul><p className="city-note">This workspace records planning dates and review status. It does not reserve stock or create a fiscal invoice.</p></article></div>}

    <footer className="city-card city-orders-export"><div><h4>{t("Download the draft schedule")}</h4><label className="city-orders-check"><input type="checkbox" checked={includeRecipients} onChange={event => setIncludeRecipients(event.target.checked)} /><span>{t("Include recipient emails in downloads")}</span></label><small>{t("Only saved packages are exported. Dates are planning targets.")}</small></div><div className="city-orders-row"><button type="button" className="city-action" disabled={dirty || busy} onClick={() => exportPlan('csv')}>{t("Download CSV")}</button><button type="button" className="city-action" disabled={dirty || busy} onClick={() => exportPlan('json')}>{t("Download JSON")}</button></div></footer>
  </section>;
}

export default CityOrdersPanel;
