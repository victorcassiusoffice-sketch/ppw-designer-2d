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
// P5 — per-domain rendering models.
export type { SeatCell, SeatMap, SeatMapOptions } from './seatMap';
export { buildSeatMap } from './seatMap';
export type {
  SceneNode,
  DomainScene,
  SceneCamera,
  OrbitCamera,
  WalkCamera,
  MeshKind,
  Vec3,
} from './scene3d';
export { buildDomainScene } from './scene3d';
export { hasCanvas2d, hasWebGL } from './renderCaps';
