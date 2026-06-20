/**
 * Per-domain Sims-parity readiness rubric (DESIGNER-EXPANSION P7).
 *
 * A lightweight, machine-checkable rubric proving each domain can do the four
 * things the configurator must support end-to-end:
 *   - canEnter          — the domain is in the registry + picker
 *   - canPlaceOrConfig  — it yields a default build-space + a placement model
 *   - canPrice          — its catalog prices to a positive subtotal
 *   - canRouteOut       — it produces a `?ref=ppw` merchant hand-off URL
 *
 * `enabledForLive` mirrors `DomainConfig.enabled` — TRUE only for domains Vic
 * has flipped on (wellness-room today). Flipping airplane/car to live is a
 * [VIC-VERIFY] step, NOT a rubric requirement: a domain can be fully "ready"
 * (all four true) while still gated off live.
 *
 * Pure aggregation over the real registry / template / catalog / pricing
 * modules — no UI, deterministic, unit-testable.
 */
import { getDomain, getDefaultSpace } from './index';
import type { DomainId } from './index';
import { getAllProducts } from '../../data/products';
import { priceDesign, buildMerchantHandoffUrl } from '../pricing/domainPricing';

export interface DomainReadiness {
  domain: DomainId;
  canEnter: boolean;
  canPlaceOrConfig: boolean;
  canPrice: boolean;
  canRouteOut: boolean;
  enabledForLive: boolean;
  /** True when all four capability checks pass (independent of live-enable). */
  ready: boolean;
}

export function evaluateDomainReadiness(domain: DomainId): DomainReadiness {
  const config = getDomain(domain);

  // canEnter — registry entry with a usable label + placement model.
  const canEnter = !!config.label && !!config.placement;

  // canPlaceOrConfig — a concrete default build-space instantiates.
  let canPlaceOrConfig = false;
  try {
    const space = getDefaultSpace(domain);
    canPlaceOrConfig = !!space && typeof space.kind === 'string';
  } catch {
    canPlaceOrConfig = false;
  }

  // canPrice — the catalog prices the first product to a positive subtotal.
  let canPrice = false;
  const products = getAllProducts(domain);
  if (products.length > 0) {
    const pricing = priceDesign(domain, [{ productId: products[0].id, quantity: 1 }]);
    canPrice = pricing.subtotal > 0 && pricing.lines.length === 1;
  }

  // canRouteOut — a referral hand-off URL with the ?ref=ppw attribution param.
  let canRouteOut = false;
  try {
    const url = buildMerchantHandoffUrl(domain, { designId: 'rubric-check' });
    canRouteOut = new URL(url).searchParams.get('ref') === 'ppw';
  } catch {
    canRouteOut = false;
  }

  const ready = canEnter && canPlaceOrConfig && canPrice && canRouteOut;
  return {
    domain,
    canEnter,
    canPlaceOrConfig,
    canPrice,
    canRouteOut,
    enabledForLive: config.enabled,
    ready,
  };
}

/** Evaluate every registered domain. */
export function evaluateAllDomains(domains: readonly DomainId[]): DomainReadiness[] {
  return domains.map(evaluateDomainReadiness);
}
