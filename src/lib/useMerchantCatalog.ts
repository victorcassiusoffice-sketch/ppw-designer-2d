import { useEffect } from 'react';
import { fetchApiProducts } from '../data/apiCatalogAdapter';
import { useCatalogStore } from '../store/catalogStore';

/** All three catalog surfaces share one live list, including Retry results. */
export function useMerchantCatalog() {
  const products = useCatalogStore((state) => state.products);
  useEffect(() => {
    if (useCatalogStore.getState().status === 'idle') void fetchApiProducts();
  }, []);
  return products;
}
