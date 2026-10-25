/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AnalysisCartSummary } from '../AnalysisCartSummary';
import { isPitchEmbed } from '../../demo/pitchEmbed';
vi.mock('../../store/cartStore', () => ({ useCart: () => ({ totalItemCount: 128, floorLines: [], wallPaintLines: [], claddingLines: [], subtotal: 1 }) }));
vi.mock('../../store/currencyStore', () => ({ useCurrencyStore: () => 'MUR' }));
vi.mock('../../lib/currency', () => ({ formatCurrency: () => 'Formatted total' }));
vi.mock('../../lib/quotedProducts', () => ({ hasQuotedProducts: () => false, quoteAwareAmount: () => 'Formatted total' }));
vi.mock('../../demo/pitchEmbed', () => ({ isPitchEmbed: vi.fn(() => true) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe('analysis product access', () => {
  it('keeps a working basket button but no count or money on the public demo', () => {
    vi.mocked(isPitchEmbed).mockReturnValue(true);
    const host = document.createElement('div'), root = createRoot(host), open = vi.fn();
    window.addEventListener('ppw:open-design-cart', open);
    act(() => root.render(<AnalysisCartSummary />));
    expect(host.textContent).toBe('Products');
    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('Open products');
    act(() => host.querySelector('button')!.click());
    expect(open).toHaveBeenCalledOnce();
    window.removeEventListener('ppw:open-design-cart', open); act(() => root.unmount());
  });
  it('retains the existing count and estimate for the normal designer', () => {
    vi.mocked(isPitchEmbed).mockReturnValue(false);
    const host = document.createElement('div'), root = createRoot(host);
    act(() => root.render(<AnalysisCartSummary />));
    expect(host.textContent).toContain('128 units');
    expect(host.textContent).toContain('Formatted total');
    act(() => root.unmount());
  });
});
