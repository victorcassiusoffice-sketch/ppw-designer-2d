/**
 * The design format: the names of its parts, in ONE place.
 *
 * A design is one JSON object (the `Property` of `src/store/propertyStore.ts`). Every loader of a part of it takes
 * from here the names it knows. A name that is NOT here is not dropped: it is carried through as it is
 * (`keepUnknownKeys` in `./unknownKeys`), so a field written by a newer build, or by the desktop game, survives
 * being opened and saved by this one.
 *
 * Where this does NOT hold: INSIDE a part that carries its own `version` (the sections below, the plot on the
 * map). Such a part is read whole, key by key, or kept aside whole under `unread`. So whoever adds a field inside
 * one of them raises that part's own version: an older build then keeps the part aside as it is, and shows none
 * of it, in place of reading it and losing the new field. The materials settings are the one exception both
 * ways: they are always read as their version 1, whatever number they say, so a new field goes at their top
 * level (carried) or under a new key of the design, never inside one of their groups.
 *
 * For whoever adds a field:
 * 1. Add its name to the table of its part here, and clean it in that part's loader. If the name is forgotten
 *    here, nothing is lost: the loader's own value wins, and without one the field is carried as it is.
 * 2. A name that IS here and that the loader does not copy is dropped on purpose (a field worked out for the
 *    screen, or one of the first designs that is read and never written).
 *
 * This module imports nothing, on purpose. The design in the browser's storage is loaded while the store is being
 * made, at the moment the page starts, and everything that load uses must exist by then: an import is ready
 * before the module that imports it runs; a `const` further down that module is not
 * (`src/store/__tests__/startUpLoad.test.ts` holds this).
 */

/**
 * The newest version of the design format this build reads. A design carries its number in `formatVersion`; a
 * design without one is version 1 (every design made before the number existed). The number 2 is written only
 * into a design that holds a version 2 part: a curved wall, the table of products in use, cost lines, members
 * (`./formatV2`).
 */
export const DESIGN_FORMAT_VERSION = 2;

const names = (...list: string[]): ReadonlySet<string> => new Set(list);

/** No name at all: everything in the object is carried. */
export const NO_KEYS: ReadonlySet<string> = names();

/** The design itself. */
export const DESIGN_KEYS = names(
  'id',
  'name',
  'activeRoomId',
  'rooms',
  'services',
  'terrainCuts',
  'boundaryComponents',
  'foundation',
  'shade',
  'city',
  'eco',
  'engineering',
  'materials',
  'levels',
  'activeLevelId',
  'walls',
  'site',
  'wallHeightM',
  'wallPaintCoats',
  'wallPaintWastePct',
  'wallPaintPrimer',
  'stairs',
  'roof',
  'garden',
  'unread',
  'formatVersion',
  'products',
  'costLines',
  'members',
);

/**
 * The sections of a design that are read whole or not at all: each has a reader that answers nothing for a value
 * it does not accept. Such a section is not dropped: it is kept aside under `unread`, by its own name. In the
 * order the loader has always written them.
 */
export const SECTION_NAMES = [
  'services',
  'terrainCuts',
  'boundaryComponents',
  'foundation',
  'shade',
  'city',
  'eco',
  'engineering',
] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

/**
 * Parts kept aside under `unread` by a reader that is not the loader. The loader does not read them: it carries
 * them. `siteWorld` is the plot on the map (`site.world`) that could not be verified; it is checked after the
 * first picture, by `src/site/hydration.ts`, which offers it to its reader again on every start.
 */
export const CARRIED_ASIDE_NAMES = ['siteWorld'] as const;

/** A room. The last four are the rectangle fields of the first designs: read, migrated, never written. */
export const ROOM_KEYS = names(
  'removedWallEdges',
  'id',
  'name',
  'polygon',
  'placedItems',
  'levelId',
  'kind',
  'openings',
  'floorFinish',
  'floorTiles',
  'wallConstruction',
  'wallPaint',
  'wallCladding',
  'wallArcs',
  'vertices',
  'lengthM',
  'widthM',
  'roomDimensions',
);

/** The materials settings (`materials`): their top level. Their groups are read key by key. */
export const MATERIALS_KEYS = names(
  'version',
  'scope',
  'quotationTaxBasis',
  'unitRates',
  'wall',
  'mortar',
  'plaster',
  'concrete',
  'base',
  'pillars',
  'roof',
);

/** One entry of a room's lists that go by the edges of its outline, and of its floor. */
export const WALL_PAINT_KEYS = names('edgeIndex', 'paintId', 'side', 'colourHex', 'colourName');
export const WALL_CLADDING_KEYS = names('edgeIndex', 'productId');
export const WALL_CONSTRUCTION_KEYS = names(
  'edgeIndex',
  'kind',
  'thicknessMm',
  'materialProductId',
);
export const FLOOR_ZONE_KEYS = names('materialId', 'tileWm', 'tileHm', 'originM', 'runs');
export const FLOOR_FINISH_KEYS = names('materialId');

/** A storey (`levels`). */
export const LEVEL_KEYS = names('id', 'name', 'index', 'kind', 'heightM', 'elevationM');

/** A wall that stands free of any room (`walls`). */
export const FREE_WALL_KEYS = names(
  'id',
  'a',
  'b',
  'bulge',
  'thicknessM',
  'levelId',
  'paintId',
  'paintColourHex',
  'paintColourName',
  'paintFaces',
  'construction',
  'materialProductId',
  'exteriorPaint',
  'claddingId',
  'claddingFaces',
);

/** The plot (`site`). `world` is the plot on the map with its heights: it has its own reader and its own version. */
export const SITE_KEYS = names('widthM', 'depthM', 'originM', 'world');

/** A stair (`stairs`). */
export const STAIR_KEYS = names(
  'id',
  'fromLevelId',
  'toLevelId',
  'x',
  'y',
  'widthM',
  'runM',
  'rotation',
);

/** The roof (`roof`). */
export const ROOF_KEYS = names(
  'style',
  'material',
  'thicknessM',
  'pitchDeg',
  'overhangM',
  'outline',
);

/** The garden (`garden`) and its entries. `pilotPermeable` is worked out for the screen and never stored. */
export const GARDEN_KEYS = names('surfaces', 'fences');
export const GARDEN_SURFACE_KEYS = names(
  'pilotPermeable',
  'id',
  'kind',
  'x',
  'y',
  'widthM',
  'depthM',
  'elevationM',
  'pavingProductId',
  'outline',
  'thicknessM',
  'subBaseDepthM',
  'pool',
);
export const GARDEN_POOL_KEYS = names(
  'shellDepthM',
  'waterDepthM',
  'wallThicknessM',
  'baseThicknessM',
  'excavationMarginM',
  'stage',
  'productReferenceId',
);
export const GARDEN_FENCE_KEYS = names('id', 'a', 'b', 'heightM', 'material');
