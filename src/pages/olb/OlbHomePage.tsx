import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { OlbLockup } from '../../brand/OlbLockup';
import './olbHome.css';

/** The four pitches, each with its own headline (no new claims here). */
export const OLB_DECKS = [
  { href: '/pitch/developers', label: 'For developers', line: 'Every apartment. One plan.' },
  { href: '/pitch/merchants', label: 'For merchants', line: 'Your products. In their home.' },
  { href: '/pitch/construction', label: 'Construction & materials', line: 'A floor plan becomes cement, sand and a layout for each floor.' },
  { href: '/pitch/plumbing', label: 'Plumbing companies', line: 'A bathroom planning session.' },
] as const;

/** onelivebuild.com's front page (behind the passcode like the rest of the site's own pages).
 * designer.ppwellness.co keeps the shop as its front door. */
export default function OlbHomePage() {
  useEffect(() => {
    document.title = 'One Live Build';
  }, []);
  return (
    <main className="olb-home">
      <header className="olb-home-header">
        <Link to="/" aria-label="One Live Build home">
          <OlbLockup height={32} />
        </Link>
        <nav aria-label="One Live Build">
          <Link to="/designer">Designer</Link>
          <Link to="/demo">Demo</Link>
          <Link to="/products">Shop</Link>
        </nav>
      </header>
      <section className="olb-home-hero">
        <div className="olb-home-copy">
          <p className="olb-home-eyebrow">By Peak Performance Wellness</p>
          <h1>
            Every build,
            <br />
            one live plan.
          </h1>
          <p className="olb-home-lead">Suppliers, designer, customer and workers on one drawing.</p>
          <div className="olb-home-actions">
            <Link className="olb-home-primary" to="/designer">
              Open the designer <span aria-hidden="true">→</span>
            </Link>
            <Link className="olb-home-secondary" to="/demo">
              Try the demo
            </Link>
          </div>
        </div>
        <figure className="olb-home-art">
          <img src="/brand/olb/hero-1200x630.jpg" alt="A block house on a sandy plot with palms" width={1200} height={630} />
        </figure>
      </section>
      <section className="olb-home-decks" aria-labelledby="olb-home-decks-title">
        <h2 id="olb-home-decks-title">Pitch decks</h2>
        <ul>
          {OLB_DECKS.map((deck) => (
            <li key={deck.href}>
              <Link to={deck.href}>
                <small>{deck.label}</small>
                <strong>{deck.line}</strong>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className="olb-home-footer">
        <span>Peak Performance Wellness Ltd · Mauritius</span>
        <Link to="/studio">Studio</Link>
      </footer>
    </main>
  );
}
