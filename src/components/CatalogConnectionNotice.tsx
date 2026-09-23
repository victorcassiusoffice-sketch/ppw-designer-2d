import { fetchApiProducts } from '../data/apiCatalogAdapter';
import { useCatalogStore } from '../store/catalogStore';

export function CatalogConnectionNotice(): JSX.Element | null {
  const status = useCatalogStore((state) => state.status);
  const loaded = useCatalogStore((state) => state.products.length);
  const total = useCatalogStore((state) => state.total);
  if (status !== 'partial' && status !== 'offline') return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 px-2 py-1 text-[11px] text-ppw-charcoal" role="status" data-testid="catalog-connection">
      <span>{status === 'partial' ? `${loaded}${total === null ? '' : ` of ${total}`} live products loaded` : 'Live catalog unavailable · saved products shown'}</span>
      <button type="button" onClick={() => void fetchApiProducts()} className="min-h-8 rounded px-2 font-semibold text-ppw-teal underline" data-testid="catalog-retry">Retry</button>
    </div>
  );
}
