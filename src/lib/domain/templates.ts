/**
 * Multi-domain Configurator — per-domain build-space templates (Phase 3).
 *
 * Every domain starts a NEW design from a different kind of "space":
 *   - wellness-room   → a polygon room  (the existing Model-A room)
 *   - airplane        → a fuselage cabin section (length × cross-section)
 *   - car             → a vehicle config (base model + empty option slots)
 *
 * The `spaceKind` discriminator already lives on each domain's registry
 * entry (`DomainConfig.spaceKind`). This module turns that discriminator
 * into a concrete, JSON-serializable DEFAULT space via `getDefaultSpace`.
 *
 * ADDITIVE ONLY: the live wellness-room default design is unchanged. The
 * wellness template below produces the SAME shape `propertyStore` seeds a
 * fresh room with — a blank polygon (draw-your-own, the 2026-06-09
 * blank-canvas-on-open behaviour) plus the 5×4 m default the store falls
 * back to. `templates.test.ts` asserts that equivalence so the
 * "byte-identical to today" firewall is proven, not just asserted.
 *
 * Phase 4 wires these templates into the UI (domain picker → "new design"
 * instantiates the domain's template). Until then nothing live changes.
 */
import type { DomainId } from './types';
import type { Polygon, RoomDims } from '../geometry';
import { CAR_CATEGORIES } from '../../data/products.schema';
import type { CarCategory } from '../../data/products.schema';

/**
 * Wellness polygon-room space — mirrors `propertyStore`'s Room geometry.
 * `polygon` empty (`[]`) is the blank-canvas fresh start; `defaultDims` is
 * the rectangle the store re-seeds from when a room needs a usable default.
 */
export interface PolygonRoomSpace {
  kind: 'polygon-room';
  /** Closed polygon in metres (no repeated end vertex). `[]` = blank canvas. */
  polygon: Polygon;
  /** Default rectangle the room re-seeds from (matches store DEFAULT_ROOM_DIMS). */
  defaultDims: RoomDims;
}

/**
 * Airplane fuselage cabin-section space — a flat seat-grid floor plane the
 * user lays cabin monuments onto. MOCK dimensions (narrow-body-ish) until a
 * real aviation-interior merchant + reference cabin lands (Vic-gated).
 */
export interface FuselageSectionSpace {
  kind: 'fuselage-section';
  /** Cabin section length along the fuselage axis, centimetres. */
  lengthCm: number;
  /** Internal cabin cross-section width, centimetres. */
  crossSectionWidthCm: number;
  /** Flat seat-grid floor plane: seat rows × seats-per-row at a fixed pitch. */
  floorGrid: { rows: number; cols: number; pitchCm: number };
}

/**
 * Car vehicle-config space — a base vehicle id plus an empty option slot-set
 * keyed by every `CarCategory`. The stepper flow (Phase 4) fills one slot per
 * step; `null` means "not yet chosen". MOCK base model id from the P2 seed.
 */
export interface VehicleConfigSpace {
  kind: 'vehicle-config';
  /** Base vehicle id the config starts from (a `category: 'model'` product). */
  baseVehicleId: string;
  /** Option slot-set keyed by CarCategory; each holds a chosen productId or null. */
  slots: Record<CarCategory, string | null>;
}

/** The starting build-space for any domain. Discriminated on `kind`. */
export type BuildSpace = PolygonRoomSpace | FuselageSectionSpace | VehicleConfigSpace;

/**
 * The wellness default rectangle. Kept in lock-step with `propertyStore`'s
 * `DEFAULT_ROOM_DIMS` (a 5×4 m room); `templates.test.ts` cross-checks it.
 */
const WELLNESS_DEFAULT_DIMS: RoomDims = { lengthM: 5, widthM: 4 };

const WELLNESS_ROOM_SPACE: PolygonRoomSpace = {
  kind: 'polygon-room',
  // Blank canvas — a fresh wellness design opens with no polygon so the
  // customer draws their own room (Sims build-mode). Identical to the
  // store's `makeBlankRoom()` polygon.
  polygon: [],
  defaultDims: WELLNESS_DEFAULT_DIMS,
};

const AIRPLANE_SECTION_SPACE: FuselageSectionSpace = {
  kind: 'fuselage-section',
  lengthCm: 600, // ~6 m cabin section
  crossSectionWidthCm: 350, // narrow-body internal cabin width
  floorGrid: { rows: 7, cols: 6, pitchCm: 80 }, // 7 rows × 6 seats (3-3), 80 cm pitch
};

/** First MOCK base model from the P2 car seed (`products.car.json`). */
const CAR_DEFAULT_BASE_VEHICLE_ID = 'car-model-compact-ev';

/** Build the empty option slot-set keyed by every CarCategory (all unchosen). */
function emptyCarSlots(): Record<CarCategory, string | null> {
  return CAR_CATEGORIES.reduce(
    (slots, category) => {
      slots[category] = null;
      return slots;
    },
    {} as Record<CarCategory, string | null>,
  );
}

/**
 * The default starting build-space for a domain. A NEW design in `domain`
 * instantiates (a deep copy of) this template. Pure + deterministic — no
 * random ids, so it round-trips through JSON byte-for-byte.
 */
export function getDefaultSpace(domain: DomainId): BuildSpace {
  switch (domain) {
    case 'airplane':
      return cloneSpace(AIRPLANE_SECTION_SPACE);
    case 'car':
      return {
        kind: 'vehicle-config',
        baseVehicleId: CAR_DEFAULT_BASE_VEHICLE_ID,
        slots: emptyCarSlots(),
      };
    case 'wellness-room':
    default:
      return cloneSpace(WELLNESS_ROOM_SPACE);
  }
}

/** Deep copy a build-space so callers can mutate without touching the template. */
function cloneSpace<T extends BuildSpace>(space: T): T {
  return JSON.parse(JSON.stringify(space)) as T;
}

/** Serialize a build-space to a JSON string (persistence / design save). */
export function serializeSpace(space: BuildSpace): string {
  return JSON.stringify(space);
}

/**
 * Parse a serialized build-space back into a typed `BuildSpace`. Throws on a
 * payload that isn't one of the known space kinds, so a corrupt/foreign save
 * fails loudly rather than flowing in as `any`.
 */
export function deserializeSpace(json: string): BuildSpace {
  const parsed = JSON.parse(json) as { kind?: unknown };
  if (
    parsed.kind === 'polygon-room' ||
    parsed.kind === 'fuselage-section' ||
    parsed.kind === 'vehicle-config'
  ) {
    return parsed as BuildSpace;
  }
  throw new Error(`Unknown build-space kind: ${String(parsed.kind)}`);
}
