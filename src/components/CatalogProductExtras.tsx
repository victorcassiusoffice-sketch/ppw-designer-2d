import { useState } from 'react';
import type { Product } from '../data/products.schema';
import { thumbnailFor } from '../data/products';
import { availabilityInfo, catalogThumbnailImages, catalogVariants, CATALOG_FUNCTIONS, CATALOG_ROOMS, CATALOG_GROUP_LABELS, type CatalogBrowse, type CatalogThumbnailImage } from './catalogMetadata';
import { handleCatalogCategoryKey } from './catalogPresentation';

/** Actual photo first, then clearly labelled static fallbacks. Never starts WebGL. */
export function CatalogProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const images = catalogThumbnailImages(product);
  return <CatalogImage key={images.map(image => image.url).join('|')} images={images} product={product} className={className} />;
}
function CatalogImage({ images, product, className }: { images: CatalogThumbnailImage[]; product: Product; className: string }) {
  const [index, setIndex] = useState(0);
  const image = images[index], label = image?.label ?? 'Illustration';
  return <span className={`catalog-product-visual ${className}`} data-image-kind={image?.kind ?? 'illustration'}>
    {image ? <img className="catalog-model-thumbnail" src={image.url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setIndex(value => value + 1)} />
      : <span className="catalog-model-thumbnail" aria-hidden="true" dangerouslySetInnerHTML={{ __html: thumbnailFor(product.category) }} />}
    {label && <span className="catalog-image-label">{label}</span>}
  </span>;
}
export function CatalogAvailability({ product, detail = false }: { product: Product; detail?: boolean }) {
  const info = availabilityInfo(product);
  return <div className={detail ? 'catalog-availability-detail' : 'catalog-availability'}>
    <span title={info.note} data-testid="catalog-availability">{info.label}</span>
    {detail && <><p>{info.note}</p>{info.quantity !== undefined && <p>Reported quantity: {info.quantity}</p>}</>}
  </div>;
}
export function CatalogSwatches({ product, products, onSelect, selectedSku = product.sku }: { product: Product; products: readonly Product[]; onSelect: (product: Product) => void; selectedSku?: string }) {
  const variants = catalogVariants(product, products);
  if (!variants.length) return null;
  return <div className="catalog-swatches" aria-label={`Variants of ${product.name}`}>
    {variants.map(variant => <button type="button" key={variant.sku} aria-label={`${variant.label}${variant.finish ? ` · ${variant.finish}` : ''}`} title={variant.label} aria-pressed={variant.product.sku === selectedSku}
      onPointerDown={event => event.stopPropagation()} onClick={() => onSelect(variant.product)}>
      <span style={{ background: /^#[a-f\d]{6}$/i.test(variant.colour_hex ?? '') ? variant.colour_hex : undefined }} />{variant.label}
    </button>)}
  </div>;
}
export function CatalogBrowseTabs({ value, onChange, onClose, closeLabel = 'Close product catalog' }: { value: CatalogBrowse; onChange: (value: CatalogBrowse) => void; onClose?: () => void; closeLabel?: string }) {
  const options = value.mode === 'function' ? CATALOG_FUNCTIONS : CATALOG_ROOMS;
  return <div className="catalog-browse">
    <div className="catalog-browse-top"><div role="tablist" aria-label="Browse products by">
      {(['category', 'function', 'room'] as const).map(mode => <button type="button" role="tab" key={mode} aria-selected={value.mode === mode}
        tabIndex={value.mode === mode ? 0 : -1} onKeyDown={handleCatalogCategoryKey}
        onClick={() => onChange({ mode, value: 'all' })}>{mode === 'category' ? 'Categories' : mode === 'function' ? 'By function' : 'By room'}</button>)}
    </div>{value.mode !== 'category' && onClose && <button type="button" className="catalog-browse-close" aria-label={closeLabel} onClick={onClose}>×</button>}</div>
    {value.mode !== 'category' && <div role="tablist" aria-label={value.mode === 'function' ? 'Product functions' : 'Rooms'}>
      {options.map(group => <button type="button" role="tab" key={group} aria-selected={value.value === group} tabIndex={value.value === group ? 0 : -1} onKeyDown={handleCatalogCategoryKey} onClick={() => onChange({ ...value, value: group })}>{CATALOG_GROUP_LABELS[group]}</button>)}
    </div>}
  </div>;
}
