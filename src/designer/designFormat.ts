/**
 * The design format: the names of its parts, in ONE place.
 *
 * A design is one JSON object (the `Property` of `src/store/propertyStore.ts`). Every loader of a part of it takes
 * from here the names it knows. A name that is NOT here is not dropped: it is carried through as it is
 * (`keepUnknownKeys` in `./unknownKeys`), so a field written by a newer build, or by the desktop game, survives
 * being opened and saved by this one.
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
