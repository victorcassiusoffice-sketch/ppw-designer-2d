/**
 * Multi-domain Configurator — domain registry (Phase 1 foundation).
 *
 * Single source of truth for the domains the engine supports. Later phases
 * read DomainConfig fields off this registry instead of branching on the
 * literal `DomainId`, so the engine stays open for extension (add a domain =
 * add a registry entry) and closed for modification.
 *
 * ADDITIVE ONLY in Phase 1 — no existing module imports this, so the live
 * wellness-room behaviour is unchanged. Airplane + car are registered but
 * `enabled: false` until their build phases pass.
 */
import type { DomainConfig, DomainId } from './types';

const WELLNESS_ROOM: DomainConfig = {
  id: 'wellness-room',
  label: 'Wellness Room',
  tagline: 'Design a recovery, therapy or eco-wellness space from real merchant products.',
  catalogScope: 'wellness',
  spaceKind: 'polygon-room',
  placement: 'free',
  render: { primary2d: 'topdown-2d' },
  enabled: true,
};

const AIRPLANE: DomainConfig = {
  id: 'airplane',
  label: 'Airplane Cabin',
  tagline: 'Lay out a cabin section — seats, galleys, lavatories, lighting and panels.',
  catalogScope: 'aviation-interior',
  spaceKind: 'fuselage-section',
  placement: 'free',
  render: { primary2d: 'topdown-2d', mirror3d: 'cabin-3d' },
  enabled: false,
};

const CAR: DomainConfig = {
  id: 'car',
  label: 'Car',
  tagline: 'Configure a vehicle — trim, paint, wheels and interior.',
  catalogScope: 'automotive',
  spaceKind: 'vehicle-config',
  placement: 'stepper',
  render: { primary2d: 'topdown-2d', mirror3d: 'turntable-3d' },
  enabled: false,
};

/** Insertion order is the display order in the domain picker. */
const REGISTRY: Record<DomainId, DomainConfig> = {
  'wellness-room': WELLNESS_ROOM,
  airplane: AIRPLANE,
  car: CAR,
};

/** The domain the app boots into — preserves today's wellness-room default. */
export const DEFAULT_DOMAIN: DomainId = 'wellness-room';

/** Narrowing guard for untrusted strings (URL params, persisted state). */
export function isDomainId(value: string): value is DomainId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

/** Throws on an unknown id — callers pass a validated DomainId or guard first. */
export function getDomain(id: DomainId): DomainConfig {
  const cfg = REGISTRY[id];
  if (!cfg) throw new Error(`Unknown domain: ${id}`);
  return cfg;
}

/** All registered domains, in display order. */
export function listDomains(): DomainConfig[] {
  return Object.values(REGISTRY);
}

/** Only the domains currently shippable to live (picker shows the rest as soon). */
export function listEnabledDomains(): DomainConfig[] {
  return listDomains().filter((d) => d.enabled);
}
