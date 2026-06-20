/**
 * Multi-domain Configurator — public surface (Phase 1 foundation).
 * Re-exports the domain type model + registry so later phases import from
 * a single stable path: `import { getDomain, DEFAULT_DOMAIN } from '@/lib/domain'`.
 */
export type {
  DomainId,
  DomainConfig,
  RenderMode,
  PlacementModel,
  SpaceKind,
} from './types';
export {
  DEFAULT_DOMAIN,
  isDomainId,
  getDomain,
  listDomains,
  listEnabledDomains,
} from './domainRegistry';
export type {
  BuildSpace,
  PolygonRoomSpace,
  FuselageSectionSpace,
  VehicleConfigSpace,
} from './templates';
export { getDefaultSpace, serializeSpace, deserializeSpace } from './templates';
