import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isShowcaseReadOnly } from '../../lib/showcaseSafety';
import { EmbeddedDesigner } from '../../demo/EmbeddedDesigner';
import './studio.css';

const MEETING_URL = 'https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour?month=2026-09';

function StudioHeader({ active }: { active?: 'design' | 'shop' | 'merchants' }) {
  return <header className="studio-header">
    <a href="/studio" className="studio-brand"><span aria-hidden="true">P<span>·</span></span><strong>PPW <small>STUDIO</small></strong></a>
    <nav aria-label="Studio navigation">
      <a href="/studio/designer" aria-current={active === 'design' ? 'page' : undefined}>Designer</a>
      <a href="/studio/shop" aria-current={active === 'shop' ? 'page' : undefined}>Shop</a>
      <a href="/studio/merchants" aria-current={active === 'merchants' ? 'page' : undefined}>Merchants</a>
    </nav>
    <a className="studio-meeting" href={MEETING_URL} target="_blank" rel="noreferrer">Meet Victor ↗</a>
  </header>;
}

export default function StudioPage() {
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  // Preserve the read-only session when someone follows a Shop link.
  isShowcaseReadOnly();
  useEffect(() => { document.title = 'PPW Studio · Design, discover, connect'; }, []);
  return <main className="studio-page">
    <StudioHeader />
    <div className="studio-home">
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <p className="studio-eyebrow">YOUR SPACE. EVERY POSSIBILITY.</p>
          <h1>From a floor plan<br />to a place to live.</h1>
          <p className="studio-intro">Design your home, explore real products and bring your merchants into one connected workspace.</p>
          <div className="studio-mode" role="group" aria-label="Choose designer view">
            <button type="button" aria-pressed={mode === '2d'} onClick={() => setMode('2d')}><span aria-hidden="true">▦</span><strong>2D</strong><small>Plan with precision</small></button>
            <button type="button" aria-pressed={mode === '3d'} onClick={() => setMode('3d')}><span aria-hidden="true">◇</span><strong>Premium 3D</strong><small>Explore every angle</small></button>
          </div>
          <Link className="studio-primary" to={`/studio/designer?view=${mode}`}>Open {mode === '3d' ? 'Premium 3D' : '2D designer'} <span aria-hidden="true">→</span></Link>
          <p className="studio-fine">Both views are included in this demo. Your changes stay on this device. No purchases or payments.</p>
        </div>
        <figure className="studio-hero-art"><img src="/showcase/developer-vision.png" alt="Architectural concept of an apartment with a plan, furnishings and material samples" /><figcaption>THE CONNECTED HOME · CONCEPT ART</figcaption></figure>
      </section>
      <section className="studio-paths" aria-label="Explore Studio">
        <Link to="/studio/shop"><span className="studio-path-icon" aria-hidden="true">▤</span><div><small>DISCOVER</small><h2>The Shop</h2><p>Browse the connected merchant catalogue.</p></div><span aria-hidden="true">↗</span></Link>
        <Link to="/pitch/developers"><span className="studio-path-icon" aria-hidden="true">⌂</span><div><small>FOR DEVELOPERS</small><h2>Every apartment. One plan.</h2><p>Explore the client-to-delivery workflow.</p></div><span aria-hidden="true">↗</span></Link>
        <Link to="/pitch/merchants"><span className="studio-path-icon" aria-hidden="true">◇</span><div><small>FOR MERCHANTS</small><h2>Your products. In their home.</h2><p>See the website and partner experience.</p></div><span aria-hidden="true">↗</span></Link>
      </section>
      <footer className="studio-home-footer"><span><i /> Interactive design & catalogue preview</span><Link to="/demo">Designer-only Demo ↗</Link><span>Built with Victor Cassius · Mauritius</span></footer>
    </div>
  </main>;
}

export function StudioDesignerPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('view') === '2d' ? '2d' : '3d';
  isShowcaseReadOnly();
  return <main className="studio-page studio-workspace">
    <header className="studio-designer-toolbar" data-testid="studio-designer-toolbar">
      <a href="/studio" className="studio-designer-brand" title="Back to Studio"><strong>PPW</strong><span>Studio</span></a>
      <nav aria-label="Studio navigation"><a href="/studio/shop">Shop</a><a href="/studio/merchants">Merchants</a></nav>
      <div className="studio-view-toggle" role="group" aria-label="Designer view"><button type="button" aria-pressed={mode === '2d'} onClick={() => setParams({ view: '2d' })}>2D</button><button type="button" aria-pressed={mode === '3d'} onClick={() => setParams({ view: '3d' })}>Premium 3D</button></div>
      <span className="studio-designer-status">Demo · saved locally</span>
      <Link className="studio-designer-expand" to={`/demo?view=${mode}`} target="_blank" rel="noreferrer" aria-label="Open designer alone in a new tab">Expand ↗</Link>
    </header>
    <EmbeddedDesigner scene="home" view={mode} onViewChange={view => setParams({ view })} className="studio-designer-frame" title="Demo — interactive home designer" />
  </main>;
}

/** Real catalogue and cart routes stay connected to their existing backend. */
export function StudioShopFrame({ children }: { children: ReactNode }) {
  isShowcaseReadOnly();
  return <div className="studio-page studio-shop"><StudioHeader active="shop" /><div className="studio-shop-notice"><span><strong>Shop preview</strong> Browse products and build an estimate. Ordering and payments are disabled.</span><Link to="/studio/designer">Back to your design →</Link></div>{children}</div>;
}

export function PreviewShopRoute({ children }: { children: ReactNode }) {
  return isShowcaseReadOnly() ? <StudioShopFrame>{children}</StudioShopFrame> : <>{children}</>;
}

export function StudioMerchantsPage() {
  const [slug, setSlug] = useState('');
  const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  isShowcaseReadOnly();
  return <main className="studio-page"><StudioHeader active="merchants" /><section className="studio-merchant-main">
    <div><p className="studio-eyebrow">THE PEOPLE BEHIND THE PRODUCTS</p><h1>Keep your catalogue<br />connected.</h1><p className="studio-intro">Use your existing merchant workspace to manage product dimensions, photos, pricing and availability. Published catalogue data feeds the Shop and Designer.</p><a className="studio-primary" href={MEETING_URL} target="_blank" rel="noreferrer">Plan your integration with Victor ↗</a></div>
    <div className="studio-merchant-card"><span className="studio-card-kicker">EXISTING MERCHANTS</span><h2>Open your workspace</h2><p>Enter your assigned merchant identifier. Your normal merchant sign-in and permissions still apply.</p><label htmlFor="studio-merchant-slug">Merchant identifier</label><input id="studio-merchant-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().trim())} autoComplete="off" placeholder="your-company" aria-describedby="studio-merchant-hint" /><small id="studio-merchant-hint">Lowercase letters, numbers and single hyphens.</small>
      {validSlug ? <Link className="studio-primary" to={`/merchant/${slug}`}>Continue to secure workspace →</Link> : <button className="studio-primary" disabled>Continue to secure workspace →</button>}
      <div className="studio-merchant-admin"><Link to="/admin/products">Platform administration ↗</Link><span>Authorized staff only</span></div>
    </div>
    <aside className="studio-merchant-info"><strong>Make it yours.</strong><span>Custom products, supplier-approved models, embedded design and collaboration can be configured for your business. Scheduling, automatic order release and finance need an agreed integration.</span><Link to="/pitch/merchants">See the merchant presentation →</Link></aside>
  </section></main>;
}

/** Never mount a payment page during a demo, even after direct navigation. */
export function ShowcaseCheckoutGuard({ children }: { children: ReactNode }) {
  if (!isShowcaseReadOnly()) return <>{children}</>;
  return <main className="studio-page"><StudioHeader /><section className="studio-checkout-message"><span className="studio-checkout-icon" aria-hidden="true">▤</span><p className="studio-eyebrow">YOU ARE IN THE DEMO</p><h1>Explore freely.<br />No orders are placed.</h1><p>Your design and product selections are available to review. Payments, order submission and quote emails are disabled in this preview.</p><div><Link className="studio-primary" to="/studio/designer">Back to Designer →</Link><Link to="/studio/shop">Browse the Shop</Link></div><a href={MEETING_URL} target="_blank" rel="noreferrer">Discuss a live merchant connection with Victor ↗</a></section></main>;
}
