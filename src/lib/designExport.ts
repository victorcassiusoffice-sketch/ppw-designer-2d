import { getAllProducts } from '../data/products';
import { useCatalogStore } from '../store/catalogStore';
import { designForExport } from '../designer/formatV2';

/**
 * The design as it leaves the app: a file, a hand-over, a save to the server. Its table of the products in use is
 * made new from the catalogue the app has at this moment (the range that comes with the app, and what the server
 * listed), and its format version is set. The design in the app is not changed.
 */
export function exportedDesign<T extends object>(property: T): T {
  return designForExport(property, [...getAllProducts(), ...useCatalogStore.getState().products]);
}
