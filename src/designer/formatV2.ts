/**
 * The parts a design gained with format version 2, besides curved walls (`./arcSegment`):
 *
 * - `products`: the products in use, each with its company, its model number and its true size, so that a design
 *   says what stands in it without a catalogue at hand;
 * - `costLines`: what a job needs, as products and as labour. A cost line holds NO money: a rate lives on the
 *   server and is looked up when a cost is worked out, so that a design that is shared never shows a price;
 * - `members`: who works on the design and in which role. It names people; it does not prove who someone is.
 *   Who may change a design is the server's decision.
 *
 * Each is a list of entries with an `id`. For a list that is NEW with version 2 the rule is kinder than for the
 * old ones: an entry of a kind this build does not know is KEPT as it is and treated as the least (a role it
 * does not know is a viewer; a cost line of a kind it does not know adds to no sum), and a field it does not
 * know inside an entry is carried. So a later version may add a kind to these lists without an older build
 * dropping it.
 *
 * This module imports only the two small modules that import nothing themselves.
 */
import { cleanBulge } from './arcSegment';
import { DESIGN_FORMAT_VERSION } from './designFormat';
import { keepUnknownKeys } from './unknownKeys';

type Loose = Record<string, unknown>;
const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const names = (...list: string[]): ReadonlySet<string> => new Set(list);

/** A short text as stored: trimmed, without control characters, not empty, not longer than `max`. */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return clean.length > 0 && clean.length <= max ? clean : undefined;
}
/** An id as stored: a short text without spaces. */
function id(value: unknown): string | undefined {
  const clean = text(value, 64);
  return clean && !/\s/.test(clean) ? clean : undefined;
}
const amount = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;

/** Cleans a list of entries with ids: at most `limit`, one per id (the first wins), each through `clean`. */
function list<T>(raw: unknown, limit: number, clean: (entry: Loose, key: string) => T | undefined) {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of raw) {
    if (out.length >= limit) break;
    if (!isRecord(entry)) continue;
    const key = id(entry.id);
    if (!key || seen.has(key)) continue;
    const made = clean(entry, key);
    if (made === undefined) continue;
    seen.add(key);
    out.push(made);
  }
  return out.length > 0 ? out : undefined;
}
/** Carries what the build does not know inside an entry. */
function carry<T extends object>(raw: Loose, known: ReadonlySet<string>, clean: T): T {
  keepUnknownKeys(raw, known, clean as unknown as Loose);
  return clean;
}

// ---- products in use ----

/** One product that stands in the design. Every field but `id` is there only when it is known. */
export interface DesignProduct {
  /** The id a placed thing carries in its `productId`. */
  id: string;
  /** The company that makes or sells it, as its catalogue names it. */
  company?: string;
  /** The company's own code for it. */
  modelNumber?: string;
  name?: string;
  category?: string;
  /**
   * Its true size in whole millimetres: `x` along the thing's own length as it lies on the plan before any turn,
   * `y` across it, `z` its height.
   */
  sizeMm?: { x: number; y: number; z: number };
}
export const DESIGN_PRODUCT_LIMIT = 5000;
const PRODUCT_KEYS = names('id', 'company', 'modelNumber', 'name', 'category', 'sizeMm');
const MM_MAX = 100000;

function cleanSizeMm(value: unknown): DesignProduct['sizeMm'] {
  if (!isRecord(value)) return undefined;
  const x = amount(value.x, 1, MM_MAX);
  const y = amount(value.y, 1, MM_MAX);
  const z = amount(value.z, 1, MM_MAX);
  if (x === undefined || y === undefined || z === undefined) return undefined;
  return { x: Math.round(x), y: Math.round(y), z: Math.round(z) };
}

export function cleanDesignProducts(raw: unknown): DesignProduct[] | undefined {
  return list<DesignProduct>(raw, DESIGN_PRODUCT_LIMIT, (entry, key) => {
    const company = text(entry.company, 120);
    const modelNumber = text(entry.modelNumber, 120);
    const name = text(entry.name, 200);
    const category = text(entry.category, 60);
    const sizeMm = cleanSizeMm(entry.sizeMm);
    return carry<DesignProduct>(entry, PRODUCT_KEYS, {
      id: key,
      ...(company ? { company } : {}),
      ...(modelNumber ? { modelNumber } : {}),
      ...(name ? { name } : {}),
      ...(category ? { category } : {}),
      ...(sizeMm ? { sizeMm } : {}),
    });
  });
}

/** What this module needs of a catalogue's product: the fields of the app's own catalogue row. */
export interface CatalogueProduct {
  id: string;
  sku?: string;
  name?: string;
  category?: string;
  supplier?: string;
  /** Centimetres: `length` along the thing, `width` across it, `height` up. */
  dimensions_cm?: { length?: number; width?: number; height?: number };
}

/** The ids of the products that stand in the design, each once, in the order they are first met. */
export function productIdsInUse(property: unknown): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const rooms = isRecord(property) && Array.isArray(property.rooms) ? property.rooms : [];
  for (const room of rooms) {
    const items = isRecord(room) && Array.isArray(room.placedItems) ? room.placedItems : [];
    for (const item of items) {
      const productId = isRecord(item) ? id(item.productId) : undefined;
      if (productId && !seen.has(productId)) {
        seen.add(productId);
        ids.push(productId);
      }
    }
  }
  return ids;
}

/**
 * The table of the products in use, made new: one entry for each product that stands in the design. What the
 * catalogue knows is written from the catalogue; a product the catalogue does not have keeps the entry the design
 * came with; a product no longer placed has no entry. Nothing when no product stands in the design.
 */
export function designProductsFor(
  property: unknown,
  catalogue: readonly CatalogueProduct[],
): DesignProduct[] | undefined {
  const stored = new Map<string, DesignProduct>();
  for (const entry of cleanDesignProducts(isRecord(property) ? property.products : undefined) ?? [])
    stored.set(entry.id, entry);
  const known = new Map<string, CatalogueProduct>();
  for (const product of catalogue) if (!known.has(product.id)) known.set(product.id, product);
  const out: DesignProduct[] = [];
  for (const productId of productIdsInUse(property).slice(0, DESIGN_PRODUCT_LIMIT)) {
    const row = known.get(productId);
    const before = stored.get(productId);
    if (!row) {
      // A product the catalogue does not have: the entry the design came with, or none (an id alone says nothing).
      if (before) out.push(before);
      continue;
    }
    // Only what the catalogue does know takes the place of what the design came with.
    const d = row.dimensions_cm;
    const fromCatalogue = cleanDesignProducts([
      {
        id: productId,
        company: row.supplier,
        modelNumber: row.sku,
        name: row.name,
        category: row.category,
        sizeMm: { x: (d?.length ?? 0) * 10, y: (d?.width ?? 0) * 10, z: (d?.height ?? 0) * 10 },
      },
    ])?.[0];
    const entry: DesignProduct = { ...before, ...fromCatalogue, id: productId };
    if (Object.keys(entry).length > 1) out.push(entry);
  }
  return out.length > 0 ? out : undefined;
}

// ---- cost lines ----

/** The kinds of cost line this build knows. Another kind is kept as it is and adds to no sum. */
export const COST_LINE_KINDS = ['product', 'labour'] as const;

/**
 * One line of what a job needs. There is no rate, no amount and no currency here, on purpose: money is worked
 * out on the server from a rate set, at the moment it is asked for.
 */
export interface CostLine {
  id: string;
  /** `product` or `labour`; a kind this build does not know is kept as it is. */
  kind: string;
  /** For a product line: the product, by the id a placed thing carries. */
  productId?: string;
  /** For a labour line: the trade that does the work, as the roles name it (`builder`, `plumber`, ...). */
  trade?: string;
  /** How many: units of the product, or units of the work. */
  quantity?: number;
  /** Labour: how many people. */
  people?: number;
  /** Labour: hours for each person. */
  hours?: number;
  /** Which set of rates on the server prices this line. A reference, never a rate. */
  rateSetId?: string;
  /** Whether sales tax is added to this line. */
  vat?: boolean;
  /** Who pays: a member's id. */
  payer?: string;
  note?: string;
}
export const COST_LINE_LIMIT = 5000;
const COST_LINE_KEYS = names(
  'id',
  'kind',
  'productId',
  'trade',
  'quantity',
  'people',
  'hours',
  'rateSetId',
  'vat',
  'payer',
  'note',
);
/** Names that would put money into a design. A cost line never carries them, whoever wrote them. */
const MONEY_KEYS = names(
  'rate',
  'price',
  'priceMinor',
  'amount',
  'amountMinor',
  'total',
  'totalMinor',
  'unitPrice',
  'cost',
  'currency',
);

export function cleanCostLines(raw: unknown): CostLine[] | undefined {
  return list<CostLine>(raw, COST_LINE_LIMIT, (entry, key) => {
    const kind = id(entry.kind);
    if (!kind) return undefined;
    const productId = id(entry.productId);
    const trade = id(entry.trade);
    const quantity = amount(entry.quantity, 0, 1e9);
    const people = amount(entry.people, 0, 100000);
    const hours = amount(entry.hours, 0, 1e6);
    const rateSetId = id(entry.rateSetId);
    const payer = id(entry.payer);
    const note = text(entry.note, 500);
    const line: CostLine = {
      id: key,
      kind,
      ...(productId ? { productId } : {}),
      ...(trade ? { trade } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(people !== undefined ? { people } : {}),
      ...(hours !== undefined ? { hours } : {}),
      ...(rateSetId ? { rateSetId } : {}),
      ...(typeof entry.vat === 'boolean' ? { vat: entry.vat } : {}),
      ...(payer ? { payer } : {}),
      ...(note ? { note } : {}),
    };
    // What this build does not know is carried, except anything that names money.
    const known = new Set([...COST_LINE_KEYS, ...MONEY_KEYS]);
    return carry<CostLine>(entry, known, line);
  });
}

// ---- members and roles ----

/** The roles this build knows, the one with the most rights first. Another role is kept and is a viewer here. */
export const MEMBER_ROLES = [
  'owner',
  'builder',
  'plumber',
  'electrician',
  'painter',
  'viewer',
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface DesignMember {
  /** The member in this design: an opaque id, never an email address. */
  id: string;
  /** One of `MEMBER_ROLES`; a role this build does not know is kept as it is. */
  role: string;
  /** The name to show. */
  name?: string;
}
export const MEMBER_LIMIT = 200;
const MEMBER_KEYS = names('id', 'role', 'name');

/** The role this build acts on: the stored one when it knows it, else the least. */
export function roleOf(member: Pick<DesignMember, 'role'>): MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(member.role)
    ? (member.role as MemberRole)
    : 'viewer';
}

export function cleanMembers(raw: unknown): DesignMember[] | undefined {
  return list<DesignMember>(raw, MEMBER_LIMIT, (entry, key) => {
    // An id that looks like an email address is not kept: a design is passed on, an address is personal.
    if (key.includes('@')) return undefined;
    const role = id(entry.role);
    if (!role) return undefined;
    const name = text(entry.name, 80);
    return carry<DesignMember>(entry, MEMBER_KEYS, { id: key, role, ...(name ? { name } : {}) });
  });
}

// ---- the version a design needs ----

/** The format version a design says it has: a whole number of 1 or more, else 1. */
export function designFormatVersion(property: unknown): number {
  const said = isRecord(property) ? property.formatVersion : undefined;
  return typeof said === 'number' && Number.isInteger(said) && said >= 1 ? said : 1;
}

const some = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

/** How many curved walls a design holds: curved edges of rooms and curved free walls. */
export function countCurvedWalls(property: unknown): number {
  if (!isRecord(property)) return 0;
  let count = 0;
  for (const room of Array.isArray(property.rooms) ? property.rooms : [])
    if (isRecord(room) && Array.isArray(room.wallArcs)) count += room.wallArcs.length;
  for (const wall of Array.isArray(property.walls) ? property.walls : [])
    if (isRecord(wall) && cleanBulge(wall.bulge) !== undefined) count += 1;
  return count;
}

/** The lowest version that can read everything in the design: 2 when it holds a version 2 part, else 1. */
export function versionNeeded(property: unknown): number {
  if (!isRecord(property)) return 1;
  return countCurvedWalls(property) > 0 ||
    some(property.products) ||
    some(property.costLines) ||
    some(property.members)
    ? 2
    : 1;
}

/**
 * The number to write into a design: what it needs, and never less than what it said (a design from a newer
 * build keeps its number). Nothing for version 1: a design without a version 2 part carries no number, as every
 * design did before the number existed.
 */
export function versionToWrite(property: unknown): number | undefined {
  const version = Math.max(designFormatVersion(property), versionNeeded(property));
  return version >= 2 ? version : undefined;
}

/**
 * The design as it leaves the app (a file, the server): its table of products is made new from the catalogue and
 * its version number is set. The design itself is not changed: a copy is given back, or the same object when
 * nothing differs.
 */
export function designForExport<T extends object>(
  property: T,
  catalogue: readonly CatalogueProduct[],
): T {
  const before = property as unknown as Loose;
  const next: Loose = { ...before };
  const products = designProductsFor(property, catalogue);
  if (products) next.products = products;
  else delete next.products;
  const version = versionToWrite(next);
  if (version !== undefined) next.formatVersion = version;
  else delete next.formatVersion;
  return JSON.stringify(next) === JSON.stringify(before) ? property : (next as unknown as T);
}

/**
 * What a design holds that this build keeps and does not show yet, in words for the person who opens it. Empty
 * when there is nothing to say.
 */
export function keptNotShown(property: unknown): string[] {
  const words: string[] = [];
  const curved = countCurvedWalls(property);
  if (curved > 0)
    words.push(
      `${curved} curved ${curved === 1 ? 'wall is' : 'walls are'} kept, and shown and measured as straight: this app does not draw curved walls yet.`,
    );
  if (isRecord(property)) {
    const lines = Array.isArray(property.costLines) ? property.costLines.length : 0;
    if (lines > 0)
      words.push(
        `${lines} cost ${lines === 1 ? 'line is' : 'lines are'} kept in the design; this app has no page for them yet.`,
      );
    const members = Array.isArray(property.members) ? property.members.length : 0;
    if (members > 0)
      words.push(
        `${members} ${members === 1 ? 'member is' : 'members are'} named in the design; this app does not act on roles yet.`,
      );
  }
  return words;
}

/** True when the design is in a newer format than this build reads in full. */
export const isNewerFormat = (property: unknown): boolean =>
  designFormatVersion(property) > DESIGN_FORMAT_VERSION;
