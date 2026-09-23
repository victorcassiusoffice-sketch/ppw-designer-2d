import type { Product } from '../data/products.schema';
import type { KeyboardEvent } from 'react';
import { MACRO_CATEGORY_LABEL, macroOf, type MacroCategory } from './mobile/catalogMacros';

export type CatalogSort = 'catalog' | 'name' | 'footprint';

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
export function filterCatalog(products: readonly Product[], category: MacroCategory, query: string, sort: CatalogSort = 'catalog'): Product[] {
  const terms = normaliseSearch(query).split(/\s+/).filter(Boolean);
  const filtered = products.filter((product) => {
    if (category !== 'all' && macroOf(product) !== category) return false;
    if (!terms.length) return true;
    const text = normaliseSearch([
      product.name, product.sku, product.supplier, product.category,
      MACRO_CATEGORY_LABEL[macroOf(product)], product.placement ?? '', product.notes,
    ].join(' '));
    return terms.every((term) => text.includes(term));
  });
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'footprint') filtered.sort((a, b) =>
    a.dimensions_cm.length * a.dimensions_cm.width - b.dimensions_cm.length * b.dimensions_cm.width);
  return filtered;
}

export function catalogPrice(product: Product): string {
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
