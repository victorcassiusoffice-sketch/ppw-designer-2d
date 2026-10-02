import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { inspectToken, readActiveMerchantSession } from '../../components/RequireMerchant';
import { CATALOG_TEMPLATE, merchantEmbedCode, validateCatalogImport, type ImportProduct } from '../../lib/merchants/catalogImport';
import { downloadJson } from '../../lib/downloadJson';
import { isShowcaseReadOnly } from '../../lib/showcaseSafety';
import { MEETING_URL } from '../pitch/workflowModel';
import './merchantConnect.css';

type Receipt = { status: 'published'; id: number } | { status: 'unknown' };
type Ledger = Record<string, Receipt>;
const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;
const ledgerKey = (slug: string) => `ppw_catalog_publish_v1:${slug}`;
function readLedger(slug: string): Ledger {
  try { const raw: unknown = JSON.parse(sessionStorage.getItem(ledgerKey(slug)) ?? '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Ledger : {}; } catch { return {}; }
}
function writeLedger(slug: string, ledger: Ledger) { try { sessionStorage.setItem(ledgerKey(slug), JSON.stringify(ledger)); return true; } catch { return false; } }
function activeSession(slug: string) {
  const session = readActiveMerchantSession(slug);
  const payload = session && inspectToken(session.token);
  return session && payload?.slug === slug && payload.exp > Date.now() ? session : null;
}

export default function MerchantConnectPage() {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const location = useLocation();
  const guarded = Boolean(routeSlug && /^\/merchant\/[^/]+\/connect\/?$/.test(location.pathname));
  const [slug, setSlug] = useState(routeSlug ?? '');
  const [text, setText] = useState(() => {
    const incoming = (location.state as { catalogText?: unknown } | null)?.catalogText;
    return typeof incoming === 'string' && incoming.length <= 1_000_000 ? incoming : '';
  });
  const [step, setStep] = useState(0);
  const [reviewed, setReviewed] = useState<{ products: ImportProduct[]; errors: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [session, setSession] = useState(() => routeSlug ? activeSession(routeSlug) : null);
  const [ledger, setLedger] = useState<Ledger>(() => routeSlug ? readLedger(routeSlug) : {});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const readOnly = isShowcaseReadOnly() || !guarded;
  const ready = Boolean(reviewed?.products.length && !reviewed.errors.length);
  const origin = window.location.origin;
  const embed = merchantEmbedCode(origin);
  const displaySlug = validSlug(slug) ? slug : 'your-company';
  const updateText = (value: string) => { setText(value); setReviewed(null); setConfirmed(false); setNotice(null); };

  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) { setNotice('Use a JSON or CSV file smaller than 1 MB.'); return; }
    try { updateText(await file.text()); } catch { setNotice('This file could not be read. Paste the JSON or CSV instead.'); }
  }
  function review() {
    const result = validateCatalogImport(text);
    setReviewed(result); setConfirmed(false); setStep(1); setNotice(null);
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Copied.'); } catch { setNotice('Clipboard access is unavailable. Select and copy the text, or download the connection pack.'); }
  }
  async function publish() {
    if (busy || operation.current || !guarded || readOnly || !confirmed || !ready || !routeSlug || routeSlug !== slug) return;
    const controller = new AbortController(); operation.current = controller;
    let current = readLedger(slug); setLedger(current); setBusy(true); setNotice(null);
    try {
      for (const product of reviewed!.products) {
        if (current[product.sku]?.status === 'published') continue;
        if (current[product.sku]?.status === 'unknown') throw new Error(`${product.sku}: a previous request has an unknown outcome. Check the merchant catalogue before another import; this tool will not retry it.`);
        const identity = activeSession(slug); setSession(identity);
        if (!identity) throw new Error('Sign in again, then refresh your sign-in here. Your reviewed data is retained.');
        if (controller.signal.aborted) throw new Error('Publishing stopped. Review the catalogue before continuing.');
        current = { ...current, [product.sku]: { status: 'unknown' } };
        if (!writeLedger(slug, current)) throw new Error('Session storage is unavailable. Enable it before publishing so completed products can be tracked.');
        setLedger(current);
        let response: Response;
        const timeout = window.setTimeout(() => controller.abort(), 20000);
        try {
          response = await fetch(`/api/merchants/${encodeURIComponent(slug)}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.token}` }, body: JSON.stringify(product), signal: controller.signal });
        } catch { throw new Error(`${product.sku}: the outcome is unknown. Publishing has stopped. Check your catalogue before trying again; successful earlier products are preserved.`); }
        finally { window.clearTimeout(timeout); }
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) { delete current[product.sku]; writeLedger(slug, current); setLedger({ ...current }); }
          throw new Error(response.status === 409 ? `${product.sku} already exists. Nothing was overwritten. Remove it from this import and review again.` : `${product.sku}: publishing stopped (HTTP ${response.status}). ${response.status >= 500 ? 'The outcome may be unknown; check your catalogue before retrying.' : 'Check your sign-in and product data, then review again.'}`);
        }
        let body: { product?: { id?: number; sku?: string } };
        try { body = await response.json(); } catch { throw new Error(`${product.sku}: the server did not return a readable receipt. Check your catalogue; this tool will not retry it.`); }
        if (!body.product || !Number.isSafeInteger(body.product.id) || body.product.id! <= 0 || body.product.sku !== product.sku) throw new Error(`${product.sku}: no matching product receipt was returned. Check your catalogue; this tool will not retry it.`);
        current = { ...current, [product.sku]: { status: 'published', id: body.product.id! } };
        writeLedger(slug, current); setLedger(current);
      }
      setNotice('All products in this reviewed batch have confirmed publication receipts. Open your merchant catalogue to verify their presentation.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Publishing stopped. Review your catalogue before trying again.'); }
    finally { setBusy(false); setConfirmed(false); operation.current = null; }
  }
  return <main className="merchant-connect">
    <header><Link to="/studio" className="merchant-connect-brand">PPW <span>STUDIO</span></Link><nav aria-label="Merchant setup navigation"><Link to={routeSlug ? `/merchant/${routeSlug}` : '/studio/merchants'}>Merchant workspace</Link><a href={MEETING_URL} target="_blank" rel="noreferrer">Meet Victor ↗</a></nav></header>
    <section className="merchant-connect-intro"><p>MERCHANT CONNECTION</p><h1>Your products.<br /><em>Ready for a real space.</em></h1><span>Prepare verified dimensions and prices, review your catalogue, then connect through your merchant account.</span></section>
    <nav className="merchant-connect-steps" aria-label="Connection steps">{['Prepare', 'Review', 'Connect'].map((label, index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined} disabled={busy || index === 1 && !reviewed} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}</nav>
    {notice && <p role="status" className="merchant-connect-notice">{notice}</p>}
    {step === 0 && <section className="merchant-connect-grid"><article><h2>Start with a small batch.</h2><p>Upload JSON or CSV, or paste it below. Up to 50 new products per batch. Prices use the smallest currency unit: <strong>450000 means Rs 4,500.00</strong>. Dimensions are width × depth × height in millimetres.</p><div className="merchant-connect-actions"><button type="button" onClick={() => downloadJson('PPW-product-template.json', CATALOG_TEMPLATE)}>Download JSON template</button><button type="button" onClick={() => { updateText(JSON.stringify(CATALOG_TEMPLATE, null, 2)); }}>Use example</button><button type="button" onClick={() => fileInput.current?.click()}>Choose JSON or CSV</button><input ref={fileInput} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={(event) => { void loadFile(event.target.files?.[0]); event.target.value = ''; }} /></div><label>Product data<textarea rows={13} value={text} onChange={(event) => updateText(event.target.value)} placeholder='[{"sku":"YOUR-001","name":"Garden chair",…}]' maxLength={1_000_000} spellCheck={false} /></label><button type="button" className="is-primary" onClick={review} disabled={!text.trim()}>Validate and review →</button></article><aside><h2>What makes a useful model?</h2><ul><li>Stable SKUs, exact dimensions and clearly named categories.</li><li>Current prices, currency and stock quantity from your own records.</li><li>HTTPS product images and honest descriptions.</li><li>Optional watts, solar output, storage or inverter ratings from specifications.</li></ul><p>Dimensions create a planning model. A manufacturer’s reviewed 3D model provides extra visual detail. Energy fields also need the existing backend energy columns enabled.</p><p className="merchant-connect-fine">Files stay in this browser until you explicitly publish in an authenticated merchant workspace. This wizard does not connect an ERP or schedule an automatic feed.</p><Link to="/suppliers">New merchant? Apply to join ↗</Link></aside></section>}
    {step === 1 && reviewed && <section className="merchant-connect-review"><div className="merchant-connect-section-title"><div><h2>{reviewed.errors.length ? 'Resolve the highlighted data.' : `${reviewed.products.length} products ready to review.`}</h2><p>Check physical sizes, currency and stock before proceeding. Validation is a format check, not a supplier verification.</p></div><button type="button" onClick={() => setStep(0)}>Edit source</button></div>{reviewed.errors.length > 0 && <div role="alert" className="merchant-connect-errors"><strong>{reviewed.errors.length} issues</strong><ul>{reviewed.errors.slice(0, 30).map((error, index) => <li key={index}>{error}</li>)}</ul>{reviewed.errors.length > 30 && <p>Showing the first 30. Fix these and validate again.</p>}</div>}<div className="merchant-connect-table"><table><thead><tr><th>Product / SKU</th><th>Category</th><th>W × D × H · mm</th><th>Price</th><th>Stock</th><th>This session</th></tr></thead><tbody>{reviewed.products.map((product, index) => <tr key={`${product.sku}:${index}`}><td><strong>{product.name}</strong><small>{product.sku}</small></td><td>{product.category}</td><td>{product.widthMm} × {product.depthMm} × {product.heightMm}</td><td>{product.currency} {(product.priceMinor / 100).toLocaleString('en-MU', { minimumFractionDigits: 2 })}</td><td>{product.inStockQty ?? 'Not supplied'}</td><td>{ledger[product.sku]?.status === 'published' ? 'Published ✓' : ledger[product.sku]?.status === 'unknown' ? 'Check outcome' : 'Not published'}</td></tr>)}</tbody></table></div><div className="merchant-connect-actions"><button type="button" className="is-primary" disabled={!ready} onClick={() => setStep(2)}>Continue to connection →</button><button type="button" disabled={!ready} onClick={() => downloadJson('PPW-reviewed-products.json', reviewed.products)}>Download validated products</button></div></section>}
    {step === 2 && <section className="merchant-connect-grid"><article><h2>{guarded ? 'Publish with your merchant account.' : 'Prepare the connection.'}</h2><label>Merchant identifier<input value={slug} disabled={guarded || busy} onChange={(event) => { setSlug(event.target.value.trim().toLowerCase()); setSession(null); setConfirmed(false); }} maxLength={100} placeholder="your-company" /></label><p>Use your assigned identifier. It chooses the merchant catalogue; it does not grant access.</p><div className="merchant-connect-status"><strong>{readOnly ? 'Preparation only' : session ? `Signed in for ${slug}` : 'Sign-in required'}</strong><span>{readOnly ? 'This public/preview wizard cannot publish. You can validate and download a connection pack.' : 'The server verifies every product request against your merchant session.'}</span></div><div className="merchant-connect-actions">{validSlug(slug) && <a href={`/merchant/${slug}`} target="_blank" rel="noreferrer">Sign in in another tab ↗</a>}<button type="button" disabled={!validSlug(slug)} onClick={() => { setSession(activeSession(slug)); setNotice(activeSession(slug) ? `Sign-in found for ${slug}.` : 'No current sign-in found for this merchant. Your inputs are retained.'); }}>Refresh sign-in</button></div>{!guarded && validSlug(slug) && session && <Link to={`/merchant/${slug}/connect`} state={{ catalogText: text }}>Continue in secure merchant workspace →</Link>}{guarded && !readOnly && <><label className="merchant-connect-confirm"><input type="checkbox" disabled={busy || !ready} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed these {reviewed?.products.length ?? 0} new products, prices and dimensions, and authorize publishing to {slug}. Existing products will not be overwritten.</span></label><button type="button" className="is-primary" disabled={!session || !ready || !confirmed || busy} onClick={() => void publish()}>{busy ? 'Publishing one product at a time…' : 'Publish reviewed products'}</button></>}{!ready && <button type="button" onClick={() => setStep(0)}>Prepare and review products first</button>}<p className="merchant-connect-fine">Publication stops at the first error. Confirmed SKUs are remembered in this tab; uncertain outcomes are not retried automatically. Check your merchant catalogue before another attempt.</p><button type="button" onClick={() => downloadJson('PPW-merchant-connection.json', { version: 1, merchantSlug: validSlug(slug) ? slug : null, products: ready ? reviewed!.products : [], endpoints: { products: `${origin}/api/merchants/${displaySlug}/products`, mcp: `${origin}/api/mcp` }, embed, publication: ledger })}>Download connection pack</button></article><aside><h2>Use the existing connections.</h2><p>Read the merchant catalogue with GET; create new products with POST and your server-verified merchant session. Never place bearer tokens in public HTML.</p><code>GET /api/merchants/{displaySlug}/products<br />POST /api/merchants/{displaySlug}/products</code><p className="merchant-connect-fine">A live stock/price feed needs agreed field mappings and a scheduled integration. This wizard publishes a reviewed batch.</p><h3>Embed the shared designer</h3><textarea aria-label="Designer embed code" rows={4} value={embed} readOnly /><button type="button" onClick={() => void copy(embed)}>Copy embed code</button><p className="merchant-connect-fine">This is the shared demo. Your catalogue filter, branding and approved domains need deployment configuration.</p><h3>Connect an AI client with MCP</h3><code>{origin}/api/mcp</code><button type="button" onClick={() => void copy(`${origin}/api/mcp`)}>Copy MCP address</button><p className="merchant-connect-fine">Use a compatible client and the configured server access method. Drafts are reviewed in the app; MCP does not publish catalogue products or place orders.</p></aside></section>}
  </main>;
}
