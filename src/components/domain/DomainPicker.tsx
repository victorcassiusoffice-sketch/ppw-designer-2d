/**
 * DomainPicker — the multi-domain landing surface (DESIGNER-EXPANSION P4).
 *
 * Cards come from `listDomains()`. An ENABLED domain enters its builder
 * (sets the domainStore, then navigates): wellness-room → the live `/designer`
 * app (unchanged); other enabled domains → `/build/:id`. A DISABLED domain
 * shows a non-blocking "coming soon" badge and does not navigate.
 *
 * This is a NEW route (`/build`). The default `/` + `/designer` wellness routes
 * are untouched, so the live wellness experience is byte-for-byte unchanged.
 */
import { useNavigate } from 'react-router-dom';
import { listDomains } from '../../lib/domain';
import type { DomainConfig } from '../../lib/domain';
import { useDomainStore } from '../../store/domainStore';

export function DomainPicker(): JSX.Element {
  const navigate = useNavigate();
  const setDomain = useDomainStore((s) => s.setDomain);
  const domains = listDomains();

  function enter(domain: DomainConfig): void {
    if (!domain.enabled) return;
    setDomain(domain.id);
    // Wellness keeps its existing dedicated builder route; other enabled
    // domains route into the generic per-domain builder shell.
    navigate(domain.id === 'wellness-room' ? '/designer' : `/build/${domain.id}`);
  }

  return (
    <main className="domain-picker" data-testid="domain-picker" aria-label="Choose what to design">
      <header className="domain-picker-head">
        <h1>What do you want to design?</h1>
        <p>Pick a subject to open the configurator.</p>
      </header>

      <ul className="domain-picker-grid" data-testid="domain-picker-grid">
        {domains.map((domain) => (
          <li key={domain.id}>
            <button
              type="button"
              data-testid={`domain-card-${domain.id}`}
              data-enabled={domain.enabled ? 'true' : 'false'}
              className={domain.enabled ? 'domain-card' : 'domain-card is-disabled'}
              aria-disabled={!domain.enabled}
              disabled={!domain.enabled}
              onClick={() => enter(domain)}
            >
              <span className="domain-card-label">{domain.label}</span>
              <span className="domain-card-tagline">{domain.tagline}</span>
              {!domain.enabled && (
                <span className="domain-card-soon" data-testid={`domain-soon-${domain.id}`}>
                  Coming soon
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
