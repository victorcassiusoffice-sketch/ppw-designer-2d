/**
 * A whole design as a file: the design object this app keeps, saved as JSON (the desktop game saves and loads
 * the same object), or the project hand-over file, which carries one under `snapshot`.
 *
 * This reader only LOOKS: it says whether a parsed JSON value is a design, and refuses one that is too large to
 * open here. It changes nothing. The caller cleans the design with `normaliseLoadedProperty`, as every design
 * that is opened is cleaned, and adds it as a new page; the page on screen is never replaced.
 *
 * A Designer draft (rectangular rooms by corner, width and depth) is not a design: its rooms have no outline,
 * so this reader answers null for it and the draft's own reader takes it.
 */

/** A design bigger than this is not opened from a file. Far above any house; a guard against a file made to hang the page. */
export const DESIGN_FILE_LIMITS = { rooms: 400, pointsPerRoom: 2000, itemsPerRoom: 5000 } as const;

export interface DesignFile {
  /** `design`: the file is the design itself. `handover`: a project hand-over file with the design inside. */
  kind: 'design' | 'handover';
  /** The design as it is in the file. Not cleaned yet. */
  property: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPoint = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.x === 'number' &&
  typeof value.y === 'number' &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y);

/** A design has at least one room, and every room has an id and an outline of points (empty for the outdoors). */
function looksLikeDesign(value: unknown): value is Record<string, unknown> & { rooms: unknown[] } {
  if (!isRecord(value) || !Array.isArray(value.rooms) || value.rooms.length === 0) return false;
  return value.rooms.every(
    (room) =>
      isRecord(room) &&
      typeof room.id === 'string' &&
      room.id !== '' &&
      Array.isArray(room.polygon) &&
      room.polygon.every(isPoint) &&
      (room.placedItems === undefined || Array.isArray(room.placedItems)),
  );
}

/**
 * The design in a parsed JSON file, or null when the value is not one.
 * Throws, with a plain reason, for a design that is too large to open here.
 */
export function readDesignFile(value: unknown): DesignFile | null {
  const inside = isRecord(value) && isRecord(value.snapshot) ? value.snapshot : value;
  if (!looksLikeDesign(inside)) return null;
  if (inside.rooms.length > DESIGN_FILE_LIMITS.rooms)
    throw new Error(
      `This design has more than ${DESIGN_FILE_LIMITS.rooms} rooms and is not opened here.`,
    );
  for (const room of inside.rooms as Array<{ polygon: unknown[]; placedItems?: unknown[] }>) {
    if (room.polygon.length > DESIGN_FILE_LIMITS.pointsPerRoom)
      throw new Error(
        `A room of this design has more than ${DESIGN_FILE_LIMITS.pointsPerRoom} corners and is not opened here.`,
      );
    if ((room.placedItems?.length ?? 0) > DESIGN_FILE_LIMITS.itemsPerRoom)
      throw new Error(
        `A room of this design holds more than ${DESIGN_FILE_LIMITS.itemsPerRoom} things and is not opened here.`,
      );
  }
  return { kind: inside === value ? 'design' : 'handover', property: inside };
}

/**
 * How many placed things of a design name a product that a catalogue does not have.
 * Such a thing stays in the design; it is drawn when the catalogue has its product (a merchant's product, for
 * one, is known only once the server's list has been read).
 */
export function countUnknownProducts(
  property: { rooms: ReadonlyArray<{ placedItems?: ReadonlyArray<{ productId?: unknown }> }> },
  knownIds: ReadonlySet<string>,
): number {
  let unknown = 0;
  for (const room of property.rooms)
    for (const item of room.placedItems ?? [])
      if (typeof item.productId !== 'string' || !knownIds.has(item.productId)) unknown++;
  return unknown;
}

/**
 * A design as the text of a file: the design object itself and nothing round it, so that this app (the plan
 * import) and the desktop game open it as it is.
 */
export function designFileText(property: unknown): string {
  return `${JSON.stringify(property, null, 2)}\n`;
}

/**
 * A file name for a design, from its name: letters and digits kept, everything else a dash, never empty.
 * "Maison d'été 2" gives "maison-d-ete-2.json".
 */
export function designFileName(name: unknown): string {
  const plain = (typeof name === 'string' ? name : '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return `${plain || 'design'}.json`;
}

export { DESIGN_FORMAT_VERSION } from './designFormat';

export { designFormatVersion } from './formatV2';
