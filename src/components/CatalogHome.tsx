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
    {visibleMacroCategories([...products]).map((category) => {
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

export function CatalogHeader({ home, category, onBack, onClose }: {
  home: boolean;
  category: MacroCategory;
  onBack: () => void;
  onClose: () => void;
}) {
  return <header className="catalog-browser-header">
    {!home && <button type="button" className="catalog-browser-back" onClick={onBack} aria-label="Back to home store categories">← Categories</button>}
    <div><strong>{home ? 'Home store' : category === 'all' ? 'All products' : MACRO_CATEGORY_LABEL[category]}</strong>
      <span>{home ? 'Choose a category for your house' : 'Choose a product to furnish your house'}</span></div>
    <button type="button" className="catalog-browser-close" onClick={() => { onClose(); document.querySelector<HTMLButtonElement>('[data-testid="house-mode-furnish"]')?.focus({ preventScroll: true }); }} aria-label="Close home store">Close <span aria-hidden="true">×</span></button>
  </header>;
}
