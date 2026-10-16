/** Public Mauritius supplier references checked 2026-10-16. No stock feed, prices or merchant integration implied. */
export const MAURITIUS_POOL_REFERENCES = [
  {
    id: 'nabridas-diamond-10', supplier: 'Nabridas', name: 'Diamond 10 fibreglass pool',
    sourceUrl: 'https://nabridas.mu/all-products/pools-spas/family-pools-7m/diamond-10/',
    checkedAt: '2026-10-16', lengthM: 10.4, widthM: 4.4, declaredVolumeM3: 42,
    minimumDepthM: 1.1, maximumDepthM: 1.8,
    detail: 'Supplier lists gradual depth, integrated bench and filtration. Custom rectangular planning geometry is not the mould or installation drawing.',
  },
] as const;
export const OUTDOOR_SUPPLIER_REFERENCES = [
  { name: 'Gamma Construction · asphalt production', kind: 'tarmac', url: 'https://gammaconstruction.mu/' },
  { name: 'Gamma Materials · ready-mix, aggregates and paving', kind: 'concrete', url: 'https://gammamaterials.mu/' },
  { name: 'Nabridas · pool equipment and safety accessories', kind: 'pool', url: 'https://nabridas.mu/shop/' },
  { name: 'Pool Solutions · pool installation and fibreglass lining', kind: 'pool', url: 'https://poolsolutions.mu/' },
] as const;
export const findPoolReference = (id?: string) => MAURITIUS_POOL_REFERENCES.find(p => p.id === id);
