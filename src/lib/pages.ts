/**
 * pages — separate PLANS, and switching between them without leaking.
 *
 * Vic 2026-08-28, choosing between three readings of "they should be different
 * pages": rooms stay attached areas on ONE canvas with real names, and a PAGE
 * is a separate plan — a different client, a different premises.
 *
 * Built on `designsStore`, which already held named saved Properties plus a
 * `currentId`. That was a page list in all but name; it was simply never
 * surfaced as one, and switching between entries was a destructive
 * `loadProperty` with no dirty check.
 *
 * THE LEAK THIS EXISTS TO PREVENT
 * -------------------------------
 * A page is NOT just a Property. `wallStore` (interior walls, drawn with the
 * wall tool) is a global singleton with no room or page key, so switching
 * plans used to carry the previous plan's interior walls straight onto the new
 * one. `floorZoneStore` and `wallTreatmentStore` have the same shape — both are
 * currently dead scaffolding with no production UI, but they are captured here
 * anyway so they cannot become a leak the moment somebody wires them up.
 *
 * So a page is the whole BUNDLE: property + walls + zones + treatments,
 * saved and restored together.
 */

import { usePropertyStore, normaliseLoadedProperty, type Property } from '../store/propertyStore';
import { useDesignsStore, DRAFT_ID } from '../store/designsStore';
import { useWallStore, type WallSegment } from '../store/wallStore';
import { useFloorZoneStore, type FloorZone } from '../store/floorZoneStore';
import { useWallTreatmentStore } from '../store/wallTreatmentStore';
import { useHistoryStore } from '../store/historyStore';

export interface PageBundle {
  property: Property;
  walls: WallSegment[];
  floorZones: FloorZone[];
  wallTreatments: Record<string, unknown>;
}

/** Everything that makes up the plan currently on the canvas. */
export function captureCurrentPage(): PageBundle {
  return {
    property: usePropertyStore.getState().property,
    walls: useWallStore.getState().walls,
    floorZones: useFloorZoneStore.getState().zones,
    wallTreatments: useWallTreatmentStore.getState().treatments as Record<string, unknown>,
  };
}

/**
 * Put a whole plan on the canvas.
 *
 * Order matters: the property goes down first so anything reacting to it sees
 * the new rooms before the walls that belong to them arrive.
 *
 * LEGACY WALL MIGRATION (Sims world 2026-08-29)
 * ---------------------------------------------
 * Free-standing walls now live ON the property (`property.walls`, metres),
 * where history, autosave and the server see them. A bundle saved before that
 * still carries its walls as mm `wallStore` segments. When such a bundle lands
 * on a property that has no walls of its own, the segments are converted onto
 * the property and `wallStore` is left EMPTY — the same wall must never exist
 * in both systems. A property that already has its own walls keeps them, and
 * the legacy segments fall through to `wallStore` exactly as before.
 */
export function applyPage(bundle: Partial<PageBundle>): void {
  const legacyWalls = bundle.walls ?? [];
  let migrated = false;
  if (bundle.property) {
    const normalised = normaliseLoadedProperty(bundle.property) ?? bundle.property;
    usePropertyStore.getState().loadProperty(normalised);
    migrated = legacyWalls.length > 0 && usePropertyStore.getState().importLegacyWalls(legacyWalls);
  }
  // Always replace, even with an empty array. Skipping a missing key is what
  // would let the previous page's walls survive onto this one.
  useWallStore.getState().replace(migrated ? [] : legacyWalls);
  useFloorZoneStore.getState().replace(bundle.floorZones ?? []);
  useWallTreatmentStore
    .getState()
    .replace((bundle.wallTreatments ?? {}) as Parameters<
      ReturnType<typeof useWallTreatmentStore.getState>['replace']
    >[0]);
}

/** The page currently being edited, or the draft slot when nothing is named. */
export function currentPageId(): string {
  return useDesignsStore.getState().currentId ?? DRAFT_ID;
}

/**
 * Persist the canvas into the page it belongs to.
 *
 * Autosave used to write only to `__draft__`, so edits to a NAMED page were
 * never actually saved back to it — switching away silently discarded them.
 */
export function flushCurrentPage(): void {
  const id = currentPageId();
  const bundle = captureCurrentPage();
  useDesignsStore.getState().savePageBundle(id, bundle);
}

/**
 * Switch to another page.
 *
 * Flushes the outgoing page first, so nothing is lost, then applies the
 * incoming bundle and clears the undo history — history frames from the
 * previous plan would otherwise let a Ctrl+Z on the new page apply the old
 * plan's state, which is a spectacular way to destroy someone's work.
 */
export function switchToPage(id: string): boolean {
  const store = useDesignsStore.getState();
  const target = store.designs[id];
  if (!target) return false;
  if (currentPageId() === id) return true;

  flushCurrentPage();
  store.setCurrent(id);
  applyPage({
    property: target.property,
    // Persisted as `unknown[]` on the SavedDesign so the store does not have
    // to import three spatial types; the owning stores validate on replace.
    walls: (target.walls ?? []) as WallSegment[],
    floorZones: (target.floorZones ?? []) as FloorZone[],
    wallTreatments: (target.wallTreatments ?? {}) as Record<string, unknown>,
  });
  useHistoryStore.getState().reset();
  return true;
}

/**
 * Promote the unsaved draft into a real, named page.
 *
 * Without this, starting a second plan from unsaved work strands that work in
 * the `__draft__` slot: it is still on disk, but it has no tab, so from the
 * customer's point of view pressing "+" LOST their plan. Anything drawn earns
 * a tab before we navigate away from it.
 *
 * Returns the new page id, or null when there was nothing worth keeping.
 */
export function promoteDraftToPage(name?: string): string | null {
  if (currentPageId() !== DRAFT_ID) return null;
  const property = usePropertyStore.getState().property;
  const hasContent =
    property.rooms.some((r) => (r.polygon?.length ?? 0) >= 3)
    || property.rooms.some((r) => (r.placedItems?.length ?? 0) > 0)
    // A free wall is drawn work too — an open run with no room around it
    // must earn its tab the same way a closed one does.
    || (property.walls?.length ?? 0) > 0;
  if (!hasContent) return null;

  const title = (name ?? property.name ?? '').trim() || 'Untitled plan';
  const id = useDesignsStore.getState().savePropertyAs(title, property);
  useDesignsStore.getState().savePageBundle(id, captureCurrentPage());
  useDesignsStore.getState().setCurrent(id);
  return id;
}

/** Start a brand-new empty page, keeping the current one saved. */
export function createPage(name: string): string {
  // Keep whatever is on screen reachable BEFORE clearing the canvas.
  promoteDraftToPage();
  flushCurrentPage();
  usePropertyStore.getState().resetToDefault();
  useWallStore.getState().replace([]);
  useFloorZoneStore.getState().replace([]);

  const property = { ...usePropertyStore.getState().property, name };
  usePropertyStore.getState().renameProperty(name);

  const id = useDesignsStore.getState().savePropertyAs(name, property);
  useDesignsStore.getState().setCurrent(id);
  useHistoryStore.getState().reset();
  return id;
}
