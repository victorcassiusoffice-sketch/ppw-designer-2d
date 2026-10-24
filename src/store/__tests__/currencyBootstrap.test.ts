/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapFx, useCurrencyStore } from '../currencyStore';
import { resetPitchEmbedCache } from '../../demo/pitchEmbed';

afterEach(() => { vi.restoreAllMocks(); history.replaceState({}, '', '/'); resetPitchEmbedCache(); });
describe('price-free presentation boot', () => {
  it.each(['/demo', '/demo?view=3d', '/designer?pitch=1', '/embed/designer?pitch=1'])('does not request irrelevant exchange rates on %s', path => {
    history.replaceState({}, '', path); resetPitchEmbedCache();
    const refresh = vi.spyOn(useCurrencyStore.getState(), 'refreshFx').mockResolvedValue();
    bootstrapFx(); expect(refresh).not.toHaveBeenCalled();
  });
  it.each(['/designer', '/studio', '/shop'])('preserves the existing FX refresh for %s', path => {
    history.replaceState({}, '', path); resetPitchEmbedCache();
    const refresh = vi.spyOn(useCurrencyStore.getState(), 'refreshFx').mockResolvedValue();
    bootstrapFx(); expect(refresh).toHaveBeenCalledOnce();
  });
});
