import { CatalogConnectionNotice } from './CatalogConnectionNotice';
import type { RefObject } from 'react';
import { isPitchEmbed } from '../demo/pitchEmbed';
import { CATALOG_FUNCTIONS, CATALOG_ROOMS, CATALOG_GROUP_LABELS, type CatalogBrowse } from './catalogMetadata';
import type { CatalogSort } from './catalogPresentation';
import type { Product } from '../data/products.schema';
import { MACRO_CATEGORY_LABEL, macroOf, visibleMacroCategories, type MacroCategory } from './mobile/catalogMacros';
import { MacroIcon } from './mobile/MacroIcon';

/** One home-store page, then one category. The two pages never stack over the house. */
export function CatalogHome({ products, onCategory, prefix }: {
  products: readonly Product[];
  onCategory: (category: MacroCategory) => void;
  prefix: 'dock' | 'sims';
}) {
  return <div className="catalog-home" aria-label="Home store categories">
    {visibleMacroCategories(products).map((category) => {
      const count = category === 'all' ? products.length : products.filter((product) => macroOf(product) === category).length;
      if (!count && category !== 'all') return null;
      return <button type="button" key={category} data-testid={`${prefix}-cat-${category}`} className="catalog-home-tile"
        onClick={() => onCategory(category)}>
        <MacroIcon macro={category} size={24} />
        <span>{category === 'all' ? 'All products' : MACRO_CATEGORY_LABEL[category]}</span>
        <small>{count} {count === 1 ? 'product' : 'products'}</small>
      </button>;
    })}
  </div>;
}

interface ShelfControls {
  prefix: 'dock' | 'sims';
  house: boolean;
  home: boolean;
  products: readonly Product[];
  category: MacroCategory;
  browse: CatalogBrowse;
  query: string;
  sort: CatalogSort;
  searchRef: RefObject<HTMLInputElement>;
  onFilter: (category: MacroCategory, browse: CatalogBrowse) => void;
  onSearch: (query: string) => void;
  onSort: (sort: CatalogSort) => void;
  onBack: () => void;
  onClose: () => void;
}

export function CatalogShelfHeader({ prefix, house, home, products, category, browse, query, sort, searchRef,
  onFilter, onSearch, onSort, onBack, onClose }: ShelfControls) {
  const filter = browse.mode === 'category' ? category : browse.value;
  const closeLabel = house ? 'Close home store' : 'Close product catalog';
  return <header className="catalog-shelf-header">
    {house && !home && <button type="button" className="catalog-browser-back" aria-label="Back to home store categories" title="Categories" onClick={onBack}>←</button>}
    {home ? <strong>Home store</strong> :
      <select className="catalog-filter" data-testid={prefix + '-filter'} aria-label="Browse products by category, function or room"
        value={browse.mode + '/' + filter} onChange={event => {
          const [mode, value] = event.target.value.split('/');
          if (mode === 'category') onFilter(value as MacroCategory, { mode, value: 'all' });
          else if (mode === 'function' || mode === 'room') onFilter('all', { mode, value });
        }}>
        <optgroup label="Categories">{visibleMacroCategories(products).map(macro =>
          <option key={macro} value={'category/' + macro}>{macro === 'all' ? 'All products' : MACRO_CATEGORY_LABEL[macro]}</option>)}</optgroup>
        <optgroup label="By function">{CATALOG_FUNCTIONS.filter(value => value !== 'all').map(value =>
          <option key={value} value={'function/' + value}>{CATALOG_GROUP_LABELS[value]}</option>)}</optgroup>
        <optgroup label="By room">{CATALOG_ROOMS.filter(value => value !== 'all').map(value =>
          <option key={value} value={'room/' + value}>{CATALOG_GROUP_LABELS[value]}</option>)}</optgroup>
      </select>}
    <input ref={searchRef} type="search" data-testid={prefix + '-search'} aria-label="Search product catalog" placeholder="Search products"
      value={query} onKeyDown={event => event.stopPropagation()} onChange={event => onSearch(event.target.value)} />
    {!home && <label className="catalog-sort" title="Sort products">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 6h15M3 11h10M3 16h5m10-6v10m-4-4 4 4 4-4" /></svg>
      <select value={sort} data-testid={prefix + '-sort'} aria-label="Sort products" onChange={event => onSort(event.target.value as CatalogSort)}>
        <option value="catalog">Catalog order</option><option value="name">Name A–Z</option><option value="footprint">Smallest first</option>
        {!isPitchEmbed() && <><option value="price-asc">Price low–high</option><option value="price-desc">Price high–low</option></>}
      </select>
    </label>}
    <CatalogConnectionNotice />
    <button type="button" className="catalog-browser-close" aria-label={closeLabel} aria-expanded="true" aria-controls={prefix === 'dock' ? 'desktop-catalog-products' : 'mobile-catalog-products'} title={closeLabel}
      data-testid={prefix === 'dock' ? 'dock-collapse' : 'sims-toolbar-minimize'} onClick={() => {
        onClose();
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(house ? '[data-testid="house-mode-furnish"]' : '[data-testid="' + prefix + '-catalog-open"]')?.focus({ preventScroll: true }));
      }}>×</button>
  </header>;
}
