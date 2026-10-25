import type { Product } from '../data/products.schema';
import type { KeyboardEvent } from 'react';
import { MACRO_CATEGORY_LABEL, macroOf, type MacroCategory } from './mobile/catalogMacros';
import { isPitchEmbed } from '../demo/pitchEmbed';
import { catalogRoomRelevance, matchesCatalogBrowse, type CatalogBrowse } from './catalogMetadata';

export type CatalogSort = 'catalog' | 'name' | 'footprint' | 'price-asc' | 'price-desc';

/** Scoped CSS variables retain the shop palette in plan and follow the 3D workspace. */
export const CATALOG_CHROME = {
  DOCK_BG: 'var(--catalog-bg)',
  DOCK_BG_RAISED: 'var(--catalog-raised)',
  DOCK_BORDER: 'var(--catalog-border)',
  DOCK_TEXT: 'var(--catalog-text)',
  DOCK_ACCENT: 'var(--catalog-accent)',
  CHROME_TEXT_2: 'var(--catalog-caption)',
};

/** The workspace can open either visible dock without coupling it to product placement. */
export function catalogRequestCategory(event: Event): MacroCategory | undefined {
  const category = (event as CustomEvent<{ category?: unknown }>).detail?.category;
  return typeof category === 'string' && Object.prototype.hasOwnProperty.call(MACRO_CATEGORY_LABEL, category)
    ? category as MacroCategory : undefined;
}

const normaliseSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Search the existing range, retaining its original order unless the user chooses a sort. */
export function filterCatalog(products: readonly Product[], category: MacroCategory, query: string, sort: CatalogSort = 'catalog', browse: CatalogBrowse = { mode: 'category', value: 'all' }): Product[] {
  const terms = normaliseSearch(query).split(/\s+/).filter(Boolean);
  const filtered = products.filter((product) => {
    if (browse.mode === 'category' && category !== 'all' && macroOf(product) !== category) return false;
    if (!matchesCatalogBrowse(product, browse)) return false;
    if (!terms.length) return true;
    const text = normaliseSearch([
      product.name, product.sku, product.supplier, product.category,
      MACRO_CATEGORY_LABEL[macroOf(product)], product.placement ?? '', product.notes,
    ].join(' '));
    return terms.every((term) => text.includes(term));
  });
  if (sort === 'catalog' && browse.mode === 'room') filtered.sort((a, b) => catalogRoomRelevance(a, browse.value) - catalogRoomRelevance(b, browse.value));
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'footprint') filtered.sort((a, b) =>
    a.dimensions_cm.length * a.dimensions_cm.width - b.dimensions_cm.length * b.dimensions_cm.width);
  if (!isPitchEmbed() && (sort === 'price-asc' || sort === 'price-desc')) filtered.sort((a, b) => {
    if (Boolean(a.price_on_request) !== Boolean(b.price_on_request)) return a.price_on_request ? 1 : -1;
    // Different currencies are grouped, never silently converted or compared.
    return a.price.currency.localeCompare(b.price.currency) || (a.price.value - b.price.value) * (sort === 'price-asc' ? 1 : -1) || a.name.localeCompare(b.name);
  });
  return filtered;
}

export function catalogPrice(product: Product): string {
  if (isPitchEmbed()) return '';
  if (product.price_on_request) return 'Price on request';
  return `${product.price.value.toLocaleString('en-MU', { maximumFractionDigits: 0 })} ${product.price.currency}`;
}

/** Roving tab focus also reveals categories outside the horizontal viewport. */
export function handleCatalogCategoryKey(event: KeyboardEvent<HTMLButtonElement>): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
  if (!tabs.length) return;
  event.preventDefault();
  const index = tabs.indexOf(event.currentTarget);
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  const next = tabs[nextIndex];
  next.focus();
  next.click();
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
