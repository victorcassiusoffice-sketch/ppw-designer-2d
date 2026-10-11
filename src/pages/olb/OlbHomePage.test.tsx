/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import OlbHomePage, { OLB_DECKS } from './OlbHomePage';
import { currentBrand } from '../../brand/brand';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); delete document.documentElement.dataset.brand; });

describe('onelivebuild.com front page', () => {
  it('opens the designer, the demo, the shop and all four pitch decks, with the One Live Build logo', () => {
    act(() => root.render(<MemoryRouter><OlbHomePage /></MemoryRouter>));
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    for (const href of ['/designer', '/demo', '/products', '/studio', ...OLB_DECKS.map((d) => d.href)]) expect(hrefs).toContain(href);
    expect(OLB_DECKS.map((d) => d.href)).toEqual(['/pitch/developers', '/pitch/merchants', '/pitch/construction', '/pitch/plumbing']);
    const logo = container.querySelector('img.olb-lockup')!;
    expect(logo.getAttribute('src')).toBe('/brand/olb/olb-lockup.svg');
    expect(logo.getAttribute('alt')).toBe('One Live Build');
    expect(container.querySelector('h1')!.textContent).toBe('Every build,one live plan.');
    expect(container.textContent).toContain('Peak Performance Wellness Ltd');
    expect(document.title).toBe('One Live Build');
  });
  it('carries no prices, no WhatsApp and no meeting links', () => {
    act(() => root.render(<MemoryRouter><OlbHomePage /></MemoryRouter>));
    const text = container.innerHTML;
    expect(text).not.toMatch(/Rs\.?\s?\d|MUR|\$\d|€\d|wa\.me|whatsapp|calendly/i);
  });
  it('reads the brand from the shell attribute', () => {
    expect(currentBrand()).toBe('ppw');
    document.documentElement.dataset.brand = 'olb';
    expect(currentBrand()).toBe('olb');
  });
});
