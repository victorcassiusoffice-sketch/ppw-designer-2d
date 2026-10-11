/** The look this page was served with. middleware.ts serves olb.html (data-brand="olb")
 * on onelivebuild.com; designer.ppwellness.co gets index.html (no attribute). */
export type Brand = 'olb' | 'ppw';

export function currentBrand(): Brand {
  return typeof document !== 'undefined' && document.documentElement.dataset.brand === 'olb' ? 'olb' : 'ppw';
}

export const ONE_LIVE_BUILD = 'One Live Build';

/** The shop moves to its own address (row D6-ONELIVEBUILD-1010-19); there "/" stays the shop. */
export function isShopHost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'shopbuild.onelivebuild.com';
}
