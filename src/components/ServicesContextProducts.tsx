import { useCatalogStore } from '../store/catalogStore';
import type { Room } from '../store/propertyStore';
import { getProductById } from '../data/products';
import { cmToM, rotatedFootprint } from '../lib/geometry';

/** Passive existing-product footprints provide coordination context below the
 * routes. Dimensions and placement come from the same catalog as the plan;
 * unknown products are omitted, never guessed or used as service fittings. */
export function ServicesContextProducts({ rooms }: { rooms: Room[] }) {
  useCatalogStore(state => state.version);
  return <g className="services-context-products" pointerEvents="none" aria-label="Existing product footprints">
    {rooms.flatMap(room => room.placedItems.map(item => {
      const product = getProductById(item.productId);
      if (!product) return null;
      const width = cmToM(product.dimensions_cm.length);
      const depth = cmToM(product.dimensions_cm.width);
      if (!(width > 0 && depth > 0)) return null;
      const footprint = rotatedFootprint({ lengthM: width, widthM: depth }, item.rotation);
      const cx = item.x + footprint.w / 2;
      const cy = item.y + footprint.h / 2;
      return <g key={`${room.id}-${item.instanceId}`} transform={`translate(${cx} ${cy}) rotate(${item.rotation})`}>
        <title>{product.name}</title>
        <rect x={-width / 2} y={-depth / 2} width={width} height={depth} rx={Math.min(.045,width*.1,depth*.1)} fill="#92a796" fillOpacity=".23" stroke="#728c77" strokeWidth=".012" />
        <line x1={-width*.36} y1={-depth*.34} x2={width*.36} y2={-depth*.34} stroke="#728c77" strokeWidth=".008" opacity=".7" />
      </g>;
    }))}
  </g>;
}
