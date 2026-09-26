/** A single small entry point keeps the plan clear until products are needed. */
export function PlanCatalogLauncher({ prefix, onOpen, onSearch }: {
  prefix: 'dock' | 'sims'; onOpen: () => void; onSearch: () => void;
}) {
  return <div className="plan-catalog-launcher">
    <button type="button" data-testid={`${prefix}-catalog-open`} aria-label="Furnish — browse products" aria-expanded="false" aria-controls={prefix === 'dock' ? 'desktop-catalog-products' : 'mobile-catalog-products'} onClick={onOpen}>
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M3 11h4v6h10v-6h4v9H3Zm2 9v2m14-2v2" /></svg>
      <strong>Furnish</strong><span>Products</span><span aria-hidden="true">⌃</span>
    </button>
    <button type="button" data-testid={`${prefix}-search-open`} aria-label="Search product catalog" title="Search products" onClick={onSearch}>
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
    </button>
  </div>;
}
