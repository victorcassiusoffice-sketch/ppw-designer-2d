/**
 * Merchant DEMO catalogs (Courts Mammouth push, 2026-09-05).
 *
 * A demo is one merchant's REAL range — names, prices, dimensions and photos
 * lifted from their public catalog — bundled at build time and shown ONLY
 * when the designer was opened with `/designer?demo=<slug>`. The point is a
 * pitch: a director sees their own sofas, treadmills and air conditioners
 * drop into a room at their own prices, not a stranger's catalog.
 *
 * WHY A REGISTRY, NOT MORE ROWS IN products.json
 * ---------------------------------------------
 * The bundled seed is what every customer sees. Courts' range must not leak
 * into the public catalog before Courts is a signed merchant, so a demo's
 * products live in their own module and are merged into `getAllProducts()` /
 * `getProductById()` only while the demo is ACTIVE. Activation is remembered
 * per tab (`sessionStorage`), so a reload inside the pitch keeps the range
 * and a fresh tab is back to the plain catalog.
 *
 * The seed count assertions (`productsSeed.test.ts`: 41) stay true because
 * nothing is active until `setActiveDemo()` runs.
 */
import type { Product } from '../data/products.schema';
import type { Property } from '../store/propertyStore';

export interface DemoDefinition {
  /** URL slug: `/designer?demo=<slug>`. Lower-case, letters and dashes. */
  slug: string;
  /** The merchant's trading name, as shown in the demo pill. */
  merchant: string;
  /** Name of the page the pre-built plan is loaded into. */
  pageName: string;
  /** The merchant's range. Ids MUST be prefixed `<slug>-` so they never collide with seed ids. */
  products: Product[];
  /**
   * Display currency the pitch should open in (the store's default is not
   * the merchant's). Absent = leave whatever the visitor had.
   */
  currency?: 'MUR' | 'USD' | 'EUR' | 'GBP';
  /** Builds the pre-designed plan — a fresh object every call (the store normalises in place). */
  buildProperty: () => Property;
}

export const DEMO_STORAGE_KEY = 'ppw_demo_v1';

const REGISTRY = new Map<string, DemoDefinition>();

/** Register a demo. Re-registering the same slug replaces it (HMR-safe). */
export function registerDemo(def: DemoDefinition): void {
  if (!/^[a-z][a-z0-9-]*$/.test(def.slug)) {
    throw new Error(`demo slug must be lower-case letters/digits/dashes: ${def.slug}`);
  }
  for (const p of def.products) {
    if (!p.id.startsWith(`${def.slug}-`)) {
      throw new Error(`demo product id must start with "${def.slug}-": ${p.id}`);
    }
  }
  REGISTRY.set(def.slug, def);
}

export function getDemo(slug: string): DemoDefinition | undefined {
  return REGISTRY.get(slug);
}

export function registeredDemoSlugs(): string[] {
  return Array.from(REGISTRY.keys());
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** In-memory mirror so a test (node env, no sessionStorage) and a browser behave the same. */
let activeSlug: string | null = null;
let hydrated = false;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const raw = storage()?.getItem(DEMO_STORAGE_KEY) ?? null;
  activeSlug = raw && REGISTRY.has(raw) ? raw : null;
}

/** The slug of the active demo, or null. Only a REGISTERED slug can be active. */
export function activeDemoSlug(): string | null {
  hydrate();
  return activeSlug;
}

/** Activate a registered demo (or `null` to leave demo mode). Returns whether it took. */
export function setActiveDemo(slug: string | null): boolean {
  hydrate();
  if (slug !== null && !REGISTRY.has(slug)) return false;
  activeSlug = slug;
  const s = storage();
  try {
    if (slug === null) s?.removeItem(DEMO_STORAGE_KEY);
    else s?.setItem(DEMO_STORAGE_KEY, slug);
  } catch {
    // Private mode / quota: the in-memory mirror still carries the session.
  }
  return true;
}

export function activeDemo(): DemoDefinition | null {
  const slug = activeDemoSlug();
  return slug ? REGISTRY.get(slug) ?? null : null;
}

/** The active demo's products, or an empty list. Never the seed. */
export function demoProducts(): Product[] {
  return activeDemo()?.products ?? [];
}

/**
 * Resolve a demo product by id across EVERY registered demo, active or not.
 *
 * Deliberately wider than `demoProducts()`: a show-home page saved during a
 * pitch stays in `designsStore` after the demo tab is closed, and it must keep
 * rendering in a plain tab rather than degrade to "Unknown product". Ids are
 * slug-namespaced, so the lookup is cheap and collision-free.
 */
export function demoProductById(id: string): Product | undefined {
  const dash = id.indexOf('-');
  if (dash <= 0) return undefined;
  // Slugs may themselves contain dashes; try the longest registered prefix.
  for (const [slug, demo] of REGISTRY) {
    if (!id.startsWith(`${slug}-`)) continue;
    const hit = demo.products.find((p) => p.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Test seam: forget everything (registry AND activation). */
export function __resetDemosForTests(): void {
  REGISTRY.clear();
  activeSlug = null;
  hydrated = false;
  try {
    storage()?.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // ignore
  }
}
