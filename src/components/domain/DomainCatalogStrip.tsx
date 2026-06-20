/**
 * DomainCatalogStrip — domain-aware catalog tabs + product thumbnails
 * (DESIGNER-EXPANSION P4, task 2).
 *
 * Given the active domain it renders:
 *   - a tab row whose labels come from `categoriesFor(domain)` +
 *     `categoryLabel(domain, …)` — so the strip reflects the domain
 *     (wellness "Ice Bath / Sauna …", airplane "Seats / Galley …",
 *     car "Model / Trim / Paint …").
 *   - the products in the selected category, read from `getAllProducts(domain)`.
 *
 * Presentational + domain-parametric: it does not touch the live wellness
 * `ProductPalette` / `SimsBottomToolbar` (those stay exactly as today). The new
 * per-domain builder shell mounts THIS strip for airplane/car flows.
 *
 * `onPick(productId)` lets the host (free-drag space or stepper) react to a
 * product choice. The strip itself holds only the selected-tab UI state.
 */
import { useMemo, useState } from 'react';
import type { DomainId } from '../../lib/domain';
import { categoriesFor, categoryLabel } from '../../lib/domain/categories';
import { getAllProducts } from '../../data/products';
import type { AnyDomainProduct, DomainCategory } from '../../data/products.schema';

export interface DomainCatalogStripProps {
  domain: DomainId;
  /** Called when a product thumbnail is activated. */
  onPick?: (productId: string) => void;
  /** Currently-chosen product id (for highlight), e.g. a filled stepper slot. */
  selectedProductId?: string | null;
}

export function DomainCatalogStrip({
  domain,
  onPick,
  selectedProductId,
}: DomainCatalogStripProps): JSX.Element {
  const categories = useMemo(() => categoriesFor(domain), [domain]);
  const products = useMemo(() => getAllProducts(domain) as AnyDomainProduct[], [domain]);

  const [activeCategory, setActiveCategory] = useState<DomainCategory>(
    () => categories[0],
  );

  // Keep the active tab valid when the domain (and so its categories) changes.
  const currentCategory = categories.includes(activeCategory)
    ? activeCategory
    : categories[0];

  const visible = useMemo(
    () => products.filter((p) => p.category === currentCategory),
    [products, currentCategory],
  );

  return (
    <section
      data-testid="domain-catalog-strip"
      data-domain={domain}
      aria-label={`${domain} catalog`}
      className="domain-catalog-strip"
    >
      <div role="tablist" aria-label="Categories" className="domain-catalog-tabs">
        {categories.map((cat) => {
          const selected = cat === currentCategory;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`domain-cat-tab-${cat}`}
              className={selected ? 'domain-cat-tab is-active' : 'domain-cat-tab'}
              onClick={() => setActiveCategory(cat)}
            >
              {categoryLabel(domain, cat)}
            </button>
          );
        })}
      </div>

      <ul className="domain-catalog-items" data-testid="domain-catalog-items">
        {visible.length === 0 ? (
          <li className="domain-catalog-empty" data-testid="domain-catalog-empty">
            No products in this category yet.
          </li>
        ) : (
          visible.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-testid={`domain-product-${p.id}`}
                aria-pressed={selectedProductId === p.id}
                className={
                  selectedProductId === p.id
                    ? 'domain-product-card is-selected'
                    : 'domain-product-card'
                }
                onClick={() => onPick?.(p.id)}
              >
                <span className="domain-product-name">{p.name}</span>
                <span className="domain-product-price">
                  {p.price.currency} {p.price.value.toLocaleString()}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
