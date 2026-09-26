/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeveloperPitchPage from '../DeveloperPitchPage';
import MerchantPitchPage from '../MerchantPitchPage';
import { MEETING_URL } from '../workflowModel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
const visit = (url: string) => window.history.replaceState({}, '', url);
beforeEach(() => { visit('/'); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); visit('/'); });
const renderDeveloper = () => act(() => root.render(<DeveloperPitchPage />));
const renderMerchant = () => act(() => root.render(<MerchantPitchPage />));
const click = (element: HTMLElement) => act(() => element.click());
function button(text: string) {
  const element = [...host.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent?.includes(text));
  if (!element) throw new Error(`Missing button: ${text}`);
  return element;
}
function chapter(index: number) { click(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]); }
const PRICE = /(?:Rs|MUR|USD|\$|€|£)\s?\d/;

describe('interactive pitch chapters', () => {
  it('supports keyboard chapter navigation with correct focus and selected panels', () => {
    renderDeveloper();
    const first = host.querySelector<HTMLButtonElement>('[role="tab"]')!;
    act(() => { first.focus(); first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    const selected = host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!;
    expect(selected.textContent).toContain('Make it yours');
    expect(document.activeElement).toBe(selected);
    expect(host.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(selected.id);
    act(() => selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Build together');
    click(button('Start again'));
    expect(host.querySelector('h1')?.textContent).toContain('make their own');
  });
  it('restores a duplicated local finish study and preserves it across chapters', () => {
    renderDeveloper(); chapter(1);
    click(button('Coastal satin')); click(button('Stone')); click(button('Duplicate this study'));
    click(button('Warm matte')); click(button('Oak')); click(button('Alternative 1'));
    expect(button('Coastal satin').getAttribute('aria-pressed')).toBe('true');
    expect(button('Stone').getAttribute('aria-pressed')).toBe('true');
    chapter(2); chapter(1);
    expect(button('Coastal satin').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('local examples');
  });
  it('opens the working designer by default and preserves it while browsing actual app captures', () => {
    renderDeveloper(); chapter(1);
    const frame = host.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d');
    expect(button('Live designer').getAttribute('aria-pressed')).toBe('true');
    click(button('App screenshots'));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(host.querySelector<HTMLElement>('.pitch-live-stage')?.hidden).toBe(true);
    let capture = host.querySelector<HTMLImageElement>('.pitch-app-capture img')!;
    expect(capture.getAttribute('src')).toBe('/showcase/designer-plan.webp');
    expect(host.querySelector('.pitch-app-capture figcaption')?.textContent).toContain('Captured in the app');
    expect(host.querySelector('.pitch-capture-tools')?.textContent).toContain('Furnish');
    click(button('Premium 3D'));
    capture = host.querySelector<HTMLImageElement>('.pitch-app-capture img')!;
    expect(capture.getAttribute('src')).toBe('/showcase/designer-3d.webp');
    expect(host.querySelector('.pitch-capture-tools')?.textContent).toContain('Move view');
    click(button('Coastal satin')); click(button('Stone'));
    expect(host.querySelector('.pitch-app-capture img')).toBe(capture);
    expect(capture.getAttribute('src')).toBe('/showcase/designer-3d.webp');
    expect(capture.getAttribute('style')).toBeNull();
    expect(host.textContent).toContain('Brief samples only; they do not repaint the screenshots or live designer');
    click(button('Try these tools'));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(host.querySelector<HTMLElement>('.pitch-live-stage')?.hidden).toBe(false);
  });
  it('uses a real plan capture in the materials chapter and opens that plan in the live designer', () => {
    renderDeveloper();
    expect(host.querySelector('.pitch-hero-art img')?.getAttribute('src')).toBe('/showcase/developer-vision.webp');
    expect(host.querySelector('.pitch-hero-art figcaption')?.textContent).toContain('concept imagery');
    chapter(3);
    expect(host.querySelector('.pitch-app-capture img')?.getAttribute('src')).toBe('/showcase/designer-plan.webp');
    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent).toContain('not data extracted from this screenshot');
    click(button('Try these tools'));
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe('/embed/designer?scene=home&view=2d');
    expect(button('2D · to scale').getAttribute('aria-pressed')).toBe('true');
  });
  it('offers the live designer when a capture fails instead of showing a fabricated image', () => {
    renderDeveloper(); chapter(1); click(button('App screenshots'));
    act(() => host.querySelector('.pitch-app-capture img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('.pitch-app-capture img')).toBeNull();
    expect(host.querySelector('.pitch-app-capture')?.textContent).toContain('App view unavailable');
    expect(host.querySelector('.pitch-app-capture')?.textContent).not.toContain('Captured in the app');
    click(button('Premium 3D'));
    expect(host.querySelector('.pitch-app-capture img')?.getAttribute('src')).toBe('/showcase/designer-3d.webp');
    click(button('Try these tools'));
    expect(host.querySelector<HTMLElement>('.pitch-live-stage')?.hidden).toBe(false);
  });
  it('updates the deadline simulation when the finish allowance changes', () => {
    renderDeveloper(); chapter(2);
    expect(host.querySelector('[data-testid="timing-result"]')?.textContent).toContain('5 days in reserve');
    click(button('Mineral plaster'));
    expect(host.querySelector('[data-testid="timing-result"]')?.textContent).toContain('0 days in reserve');
    expect(host.textContent).toContain('No orders, bookings or emails are sent');
    click(button('At deadline'));
    expect(host.querySelector('.pitch-deadline-preview')?.textContent).toContain('freezes the latest approved materials');
    click(button('Site ready'));
    expect(host.querySelector('.pitch-deadline-preview')?.textContent).toContain('Contractor arrival follows received materials');
  });
  it('switches live 2D/3D by a same-origin message without reloading the design iframe', () => {
    renderDeveloper(); chapter(1); click(button('Live designer'));
    const frame = host.querySelector('iframe')!;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d');
    click(button('2D · to scale'));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(frame.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d');
    expect(post).toHaveBeenLastCalledWith({ type: 'ppw:designer-view', view: '2d' }, window.location.origin);
    click(button('Premium 3D'));
    expect(host.querySelector('iframe')).toBe(frame);
    expect(post).toHaveBeenLastCalledWith({ type: 'ppw:designer-view', view: '3d' }, window.location.origin);
  });
  it('carries a selected merchant category into the storefront and offers the shop route', () => {
    renderMerchant(); chapter(1); click(button('Furniture'));
    expect(host.textContent).toContain('Give every product a sense of scale');
    click(button('Try a storefront'));
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d');
    expect(host.querySelector<HTMLSelectElement>('select')?.value).toBe('furniture');
    click(button('Connected shop'));
    expect(host.querySelector('a[href="/products"]')?.textContent).toContain('Browse the product shop');
  });
  it('keeps both pitches outer view pills in sync with controls inside the embedded designer', () => {
    for (const [render, index] of [[renderDeveloper, 1], [renderMerchant, 2]] as const) {
      render(); chapter(index);
      if (index === 1) click(button('Live designer'));
      const frame = host.querySelector('iframe')!;
      act(() => window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'ppw:designer-view-state', view: '2d' } })));
      expect(button('2D · to scale').getAttribute('aria-pressed')).toBe('true');
      expect(button('Premium 3D').getAttribute('aria-pressed')).toBe('false');
      expect(host.querySelector('iframe')).toBe(frame);
    }
  });
  it('explains secure identity through stages without collecting documents or submitting forms', () => {
    renderMerchant(); chapter(4);
    click(button('Verify with a secure provider'));
    expect(host.querySelector('.pitch-finance-copy')?.textContent).toContain('does not collect IDs');
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).toContain('no application is submitted');
    expect(host.querySelector('a[href="/studio/merchants"]')).not.toBeNull();
    expect(host.querySelectorAll(`a[href="${MEETING_URL}"]`)).toHaveLength(2);
  });
  it('keeps public sales paths, the exact meeting link and the external name on both pitches', () => {
    expect(MEETING_URL).toBe('https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour');
    for (const render of [renderDeveloper, renderMerchant]) {
      render();
      expect(host.querySelector(`a[href="${MEETING_URL}"]`)?.textContent).toContain('Meet Victor');
      expect(host.querySelector('a[href="/studio"]')).not.toBeNull();
      expect(host.querySelector('a[href="/demo"]')).not.toBeNull();
      expect(document.title).toContain('Experience | PPW Studio');
      expect(host.textContent).not.toMatch(/\bVic\b/);
      expect(host.textContent).not.toMatch(PRICE);
    }
  });
  it('describes what the designer does today and labels the rest integration required', () => {
    renderDeveloper();
    expect(host.textContent).toContain('2D plan + Premium 3D · live');
    expect(host.textContent).toContain('integration required');
    chapter(4);
    for (const line of ['2D plan and Premium 3D on the same plan', 'Colour-true paint', 'TintEX and Sofap ranges with real tin prices', 'plain-English energy meter', 'Duraco water tank', 'Courts range and the Cap Tamarin two-bedroom scene', 'Read-only demo: nothing is ordered from the demo']) expect(host.textContent).toContain(line);
    expect(host.textContent).toContain('Workflow preview / integration required');
    expect(host.textContent).toContain('E-signature, secure identity and finance providers');
    expect(host.textContent).not.toMatch(PRICE);
    renderMerchant(); chapter(1);
    click(button('Paint')); expect(host.textContent).toContain('TintEX and Sofap ranges');
    click(button('Garden')); expect(host.textContent).toContain('Duraco water tank');
    click(button('Solar')); expect(host.textContent).toContain('plain-English energy meter');
    expect(host.textContent).not.toMatch(PRICE);
  });
});

describe('client overlays via ?client=', () => {
  it('turns the developer page into the Cap Tamarin variant with its scene and number-free operating models', () => {
    visit('/pitch/developers?client=cap-tamarin'); renderDeveloper();
    expect(host.querySelector('h1')?.textContent).toBe('Let your buyers make their Cap Tamarin home their own, before it is built.');
    expect(host.querySelector('.pitch-hero-art img')?.getAttribute('src')).toBe('/showcase/developer-vision.webp');
    expect(host.querySelector('.pitch-hero-art figcaption')?.textContent).toContain('concept imagery');
    expect(host.textContent).not.toMatch(PRICE);
    chapter(1);
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe('/embed/designer?scene=captamarin&view=3d');
    expect(host.querySelector('.pitch-live-footer a')?.getAttribute('href')).toBe('/demo?scene=captamarin&view=3d');
    click(button('2D · to scale'));
    expect(host.querySelector('.pitch-live-footer a')?.getAttribute('href')).toBe('/demo?scene=captamarin&view=2d');
    chapter(4);
    const models = host.querySelector('[data-testid="operating-models"]')!;
    expect(models.textContent).toContain('Managed by PPW');
    expect(models.textContent).toContain('Run by your team');
    expect(models.textContent).not.toMatch(/\d/);
    expect(models.textContent).toContain('complexes and masterplans, a unit inside a block, landscaping');
    expect(host.textContent).not.toMatch(PRICE);
    expect(host.textContent).not.toMatch(/\bVic\b/);
  });
  it('keeps the default developer page for an unknown client', () => {
    visit('/pitch/developers?client=someone-else'); renderDeveloper();
    expect(host.querySelector('h1')?.textContent).toContain('make their own');
    chapter(1);
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d');
    chapter(4);
    expect(host.querySelector('[data-testid="operating-models"]')).toBeNull();
  });
  it('turns the merchant page into the Spa Concept variant: internal tool first, Build preselected, honest in-build labels, no price', () => {
    visit('/pitch/merchants?client=spa-concept'); renderMerchant();
    expect(host.querySelector('h1')?.textContent).toBe('Design a hammam or sauna in 3D, and know the wood the moment you do.');
    expect(host.textContent).toContain('later, locked phase');
    expect(host.querySelector('.pitch-chip.is-build')?.textContent).toContain('in build');
    chapter(1);
    expect(button('Build').getAttribute('aria-pressed')).toBe('true');
    const inBuild = host.querySelector('[data-testid="in-build"]')!;
    for (const line of ['Wood and cladding quantity', 'Staff dashboard', 'Permission locks', 'Hold-for-review ordering']) expect(inBuild.textContent).toContain(line);
    expect(inBuild.querySelectorAll('.pitch-chip.is-build')).toHaveLength(4);
    expect(host.textContent).not.toMatch(PRICE);
    chapter(2);
    expect(button('Standalone studio').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('Later, locked phase');
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe('/embed/designer?scene=home&view=3d');
  });
  it('keeps the default merchant page for an unknown client', () => {
    visit('/pitch/merchants?client=nobody'); renderMerchant();
    expect(host.querySelector('h1')?.textContent).toContain('From browsing');
    chapter(1);
    expect(button('Paint').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[data-testid="in-build"]')).toBeNull();
  });
});
