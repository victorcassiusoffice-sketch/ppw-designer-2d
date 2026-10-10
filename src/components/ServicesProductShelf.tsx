import { SERVICE_PRODUCTS } from '../data/serviceProducts';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { isPitchEmbed } from '../demo/pitchEmbed';
import { ProductSourceNote } from './ProductSourceNote';

export function ServicesProductShelf({ onPlace }: { onPlace: () => void }) {
  return <details className="services-products"><summary>Mauritian products · paired 2D / 3D</summary>
    <p>Choose a measured product, then tap its position in Plan. It appears in 3D at the same size. Manufacturer connection positions still need confirmation; generic service ports are planning markers.</p>
    {SERVICE_PRODUCTS.map(product => <article key={product.id}>
      <img src={product.image_url} alt="" width="60" height="60" />
      <strong>{product.name}</strong>
      <span>{product.dimensions_cm.length} × {product.dimensions_cm.width} × {product.dimensions_cm.height} cm</span>
      {!isPitchEmbed() && <span>{product.price.value.toLocaleString('en-GB')} MUR per piece · VAT included</span>}
      <button type="button" onClick={() => { onPlace(); const ui = useDesignerUIStore.getState(); ui.setViewMode('plan'); ui.setTool('hand'); usePlacementIntentStore.getState().setArmed(product.id); }}>Place {product.name}</button>
      <ProductSourceNote product={product} />
    </article>)}
  </details>;
}

