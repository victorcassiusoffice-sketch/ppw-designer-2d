/**
 * Multi-domain Configurator — domain type model (Phase 1 foundation).
 *
 * The Designer began life as a single-domain tool: a top-down wellness-ROOM
 * builder. The expansion (DESIGNER-EXPANSION-7PHASE-2026-06-20) generalises the
 * SAME engine to additional configurable subjects — first AIRPLANES (cabin /
 * interior layout) and CARS (trim / paint / wheel / interior configurator).
 *
 * This file is the seam. It introduces the `Domain` concept that later phases
 * parametrise on:
 *   - catalog source + category scope            (Phase 2)
 *   - default build-space / template             (Phase 3)
 *   - UI + config flow                           (Phase 4)
 *   - 2D / 3D render mode                         (Phase 5)
 *   - pricing + merchant attribution             (Phase 6)
 *
 * Phase 1 is purely ADDITIVE: nothing imports this yet, so wellness-room
 * behaviour is byte-for-byte unchanged. Each later phase wires one concern
 * through the registry behind a flag.
 */

/** The configurable subjects the engine can build. Closed set, grows per phase. */
export type DomainId = 'wellness-room' | 'airplane' | 'car';

/** Primary on-canvas render technique for a domain. */
export type RenderMode =
  | 'topdown-2d' // Konva floor plan (room, airplane cabin section)
  | 'turntable-3d' // Babylon orbit view of a single subject (car exterior)
  | 'cabin-3d'; // Babylon interior walkthrough (airplane cabin)

/** How a user composes the design within a domain. */
export type PlacementModel =
  | 'free' // drag-place items anywhere in the space (room, airplane cabin)
  | 'slot' // items snap into predefined slots (seat map, wheel wells)
  | 'stepper'; // guided step config, no free placement (car build flow)

/** The kind of starting "space" a domain instantiates. */
export type SpaceKind =
  | 'polygon-room' // arbitrary floor polygon (existing wellness room)
  | 'fuselage-section' // a cabin section: length x cross-section
  | 'vehicle-config'; // a base vehicle + slot set (car / future bike)

/**
 * A domain's full behavioural descriptor. One immutable record per domain,
 * held in the registry. Later phases read fields off this rather than
 * branching on `DomainId` directly, so adding a 4th domain (e.g. 'yacht')
 * is a registry entry, not a code sweep.
 */
export interface DomainConfig {
  id: DomainId;
  /** Human label for pickers / headings. */
  label: string;
  /** One-line value prop shown on the domain picker card. */
  tagline: string;
  /**
   * Catalog scope key. Phase 2's catalog loader uses this to filter/seed the
   * product set for the domain (wellness merchant SKUs vs airplane interior
   * vs car parts/accessories).
   */
  catalogScope: string;
  /** The default build-space the domain instantiates (Phase 3). */
  spaceKind: SpaceKind;
  /** How the user places/configures items (Phase 4). */
  placement: PlacementModel;
  /** 2D primary + optional 3D mirror render modes (Phase 5). */
  render: { primary2d: RenderMode; mirror3d?: RenderMode };
  /**
   * Whether the domain is shippable to live. wellness-room ships today;
   * airplane + car stay `false` until their phases pass GATE-1 + Vic flips
   * them on. The domain picker shows disabled domains as "coming soon".
   */
  enabled: boolean;
}
