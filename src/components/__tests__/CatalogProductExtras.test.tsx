/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllProducts } from '../../data/products';
import { CatalogBrowseTabs, CatalogProductImage, CatalogSwatches } from '../CatalogProductExtras';
import { catalogThumbnailUrls } from '../catalogMetadata';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('catalogue controls', () => {
  it('loads the actual photo lazily and labels model, plan and symbol fallbacks when photos fail', () => {
    const product = getAllProducts().find(row => catalogThumbnailUrls(row).some(url => url.includes('/catalog-models/')))!;
    act(() => root.render(<CatalogProductImage product={product} />));
    const urls = catalogThumbnailUrls(product);
    expect(host.querySelector('img')?.getAttribute('src')).toBe(urls[0]);
    expect(host.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(host.querySelector('[data-image-kind]')?.getAttribute('data-image-kind')).toBe('photo');
    expect(host.querySelector('.catalog-image-label')).toBeNull();
    for (let i = 1; i < urls.length; i++) {
      act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
      expect(host.querySelector('img')?.getAttribute('src')).toBe(urls[i]);
    }
    act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('img')).toBeNull(); expect(host.querySelector('svg')).not.toBeNull();
    expect(host.textContent).toContain('Illustration');
  });
  it('changes to the declared SKU and dimensions, without inventing a material variant or starting placement', () => {
    const product = getAllProducts()[0];
    const variant = { ...product, id: 'declared-variant', sku: 'DECLARED-SKU', dimensions_cm: { length: 90, width: 60, height: 42 } };
    const declared = { ...product, variants: [{ sku: variant.sku, label: 'Walnut', colour_hex: '#694225', finish: 'Matte' }] };
    const select = vi.fn(); const placement = vi.fn();
    act(() => root.render(<div onPointerDown={placement}><CatalogSwatches product={declared} products={[product, variant]} onSelect={select} /></div>));
    const button = host.querySelector('button')!;
    act(() => { button.dispatchEvent(new Event('pointerdown', { bubbles: true })); button.click(); });
    expect(select).toHaveBeenCalledOnce(); expect(select).toHaveBeenCalledWith(variant); expect(placement).not.toHaveBeenCalled();
    act(() => root.render(<CatalogSwatches product={product} products={[product, variant]} onSelect={select} />));
    expect(host.querySelector('button')).toBeNull();
  });
  it('keeps room choices and an explicit close action reachable without opening a placement tool', () => {
    const change = vi.fn(), close = vi.fn();
    act(() => root.render(<CatalogBrowseTabs value={{ mode: 'room', value: 'all' }} onChange={change} onClose={close} />));
    const room = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Bathroom')!;
    act(() => room.click()); expect(change).toHaveBeenCalledOnce(); expect(change).toHaveBeenCalledWith({ mode: 'room', value: 'bath' });
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Close product catalog"]')!.click());
    expect(close).toHaveBeenCalledOnce();
  });
});
