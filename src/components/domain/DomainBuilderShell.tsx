/**
 * DomainBuilderShell — per-domain builder entry (DESIGNER-EXPANSION P4).
 *
 * Route: `/build/:domainId`. Resolves the domain from the path param (falling
 * back to wellness-room for junk), syncs the domainStore + any deep-linked
 * `?domain=`, and then routes by the domain's placement model:
 *   - `stepper`        → CarStepperFlow
 *   - `free` / `slot`  → free-place flow (airplane cabin grid)
 *   - wellness-room    → redirect to the live `/designer` app (unchanged)
 *
 * GATE: a domain whose `DomainConfig.enabled` is false renders a "coming soon"
 * panel and NOT its (unfinished) builder — so even a deep link can't reach an
 * incomplete flow. Airplane + car stay disabled until their phases pass.
 */
import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getDomain, isDomainId, DEFAULT_DOMAIN } from '../../lib/domain';
import type { DomainId } from '../../lib/domain';
import { useDomainStore, initDomainFromLocation } from '../../store/domainStore';
import { CarStepperFlow } from './CarStepperFlow';
import { AirplaneCabinFlow } from './AirplaneCabinFlow';

function resolveRouteDomain(raw: string | undefined): DomainId {
  return raw && isDomainId(raw) ? raw : DEFAULT_DOMAIN;
}

export function DomainBuilderShell(): JSX.Element {
  const { domainId } = useParams<{ domainId: string }>();
  const resolved = resolveRouteDomain(domainId);
  const setDomain = useDomainStore((s) => s.setDomain);

  useEffect(() => {
    // Path param is authoritative for this route; honour a deep-linked
    // `?domain=` too (the path wins because we set it last).
    if (typeof window !== 'undefined') initDomainFromLocation(window.location.search);
    setDomain(resolved);
  }, [resolved, setDomain]);

  // Wellness-room has its own dedicated, untouched builder.
  if (resolved === 'wellness-room') return <Navigate to="/designer" replace />;

  const config = getDomain(resolved);

  if (!config.enabled) {
    return (
      <main className="domain-builder coming-soon" data-testid="domain-coming-soon">
        <h1>{config.label}</h1>
        <p>{config.tagline}</p>
        <p className="domain-coming-soon-note">This configurator is coming soon.</p>
        <Link to="/build" data-testid="domain-back-to-picker">
          ← Back to picker
        </Link>
      </main>
    );
  }

  return (
    <main className="domain-builder" data-testid="domain-builder" data-domain={resolved}>
      <header className="domain-builder-head">
        <h1>{config.label}</h1>
        <Link to="/build" data-testid="domain-back-to-picker">
          ← Switch
        </Link>
      </header>
      {config.placement === 'stepper' ? <CarStepperFlow /> : <AirplaneCabinFlow />}
    </main>
  );
}
